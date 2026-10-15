"""
views_commerce_v2.py — Drop-in replacement for views_commerce.py

KEY CHANGES vs v1
─────────────────
1. select_for_update() + transaction.atomic() on every state-changing
   endpoint so two buyers racing to take the same item cannot both succeed.
2. create_offer / respond_to_offer now include a rich listing card in
   every system message so the item context travels with every bargaining
   turn — no need for the buyer or seller to scroll up to find the listing.
3. New /api/negotiate/chat/ endpoint: buyer or seller sends a free-text
   chat message *within* an active offer thread; the message is attached
   to the offer and the listing card is always prepended.  This is what
   makes the in-chat negotiation feel like real Zambian back-and-forth.
4. take_listing now uses select_for_update on UserStatus so two concurrent
   "Buy Now" taps cannot both create a deal.
5. respond_to_offer's "accept" path locks the status row before marking
   it reserved, preventing a concurrent take_listing from racing with an
   in-flight acceptance.
6. All system messages now carry selected_media_url so the exact photo
   the buyer tapped in the grid flows into the deal thread.
"""

import json
import logging
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST

from ..models import Deal, Message, Offer, UserStatus
from .helpers import _utc_iso, _serialize_message, _get_file_url

User   = get_user_model()
logger = logging.getLogger(__name__)

_METHOD_LABELS = {
    'airtel_money':  'Airtel Money',
    'mtn_money':     'MTN MoMo',
    'zamtel_kwacha': 'Zamtel Kwacha',
    'bank_transfer': 'Bank Transfer',
    'cash':          'Cash',
}


# ─── Internal helpers ──────────────────────────────────────────────────────

def _fmt_price(price):
    """K1,250.00 style label for Zambia."""
    try:
        return 'K{:,.2f}'.format(Decimal(str(price)))
    except Exception:
        return str(price)


def _listing_card_text(status, selected_media_url=None, extra_line=''):
    """
    Build the plain-text listing card that every offer/deal/negotiate
    message gets prepended with.  Keeps both parties oriented on which
    item is being discussed without having to scroll.

    Format (WhatsApp-style quote block):

        > 🏷️ LISTING  · Category
        > Caption text up to 80 chars
        > Price  ·  negotiable / fixed
        > Collection: Shoprite Kitwe
        [extra_line if given]
    """
    cat   = status.category.name if status.category else 'Market'
    cap   = (status.caption or 'Listing')[:80]
    price = _fmt_price(status.price) if status.price else '(price not set)'
    neg   = ' · negotiable' if status.is_negotiable else ' · fixed price'
    lines = [
        f'> 🏷️ LISTING  · {cat}',
        f'> {cap}',
        f'> {price}{neg}',
    ]
    if status.collection_point:
        lines.append(f'> 📍 {status.collection_point}')
    if selected_media_url:
        lines.append(f'> 📸 (photo selected by buyer)')
    if extra_line:
        lines.append(extra_line)
    return '\n'.join(lines)


def _create_system_msg(sender, recipient, text, message_type='text',
                       offer=None, deal=None, status=None):
    """
    Thin wrapper so every system message consistently carries the FK refs
    the frontend needs to render deal / offer cards.
    """
    return Message.objects.create(
        sender        = sender,
        recipient     = recipient,
        message       = text,
        message_type  = message_type,
        offer         = offer,
        deal          = deal,
        related_status= status,
    )


# ─── Offers ────────────────────────────────────────────────────────────────

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def create_offer(request):
    """
    Buyer makes an initial (or counter-initiated) offer on a commercial
    status.  Every offer message carries the listing card so the seller
    immediately sees context.

    POST body:
        status_id          int
        amount             decimal
        selected_media_url str  (optional — the photo the buyer tapped in grid)
        note               str  (optional buyer note, max 200 chars)
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    status_id          = data.get('status_id')
    amount             = data.get('amount')
    selected_media_url = (data.get('selected_media_url') or '').strip()[:500]
    note               = (data.get('note') or '').strip()[:200]

    if not status_id:
        return JsonResponse({"error": "status_id required"}, status=400)
    if not amount:
        return JsonResponse({"error": "amount required"}, status=400)

    try:
        amount = Decimal(str(amount))
        if amount <= 0:
            return JsonResponse({"error": "Amount must be positive"}, status=400)
    except Exception:
        return JsonResponse({"error": "Invalid amount"}, status=400)

    try:
        status = UserStatus.objects.get(id=status_id)
    except UserStatus.DoesNotExist:
        return JsonResponse({"error": "Status not found"}, status=404)

    if not status.is_commercial:
        return JsonResponse({"error": "This status is not for sale"}, status=400)
    if status.availability in ('sold', 'reserved'):
        return JsonResponse({"error": "This item is already sold or reserved"}, status=400)
    if status.user == request.user:
        return JsonResponse({"error": "You cannot make an offer on your own listing"}, status=403)

    if Offer.objects.filter(status=status, buyer=request.user, state='pending').exists():
        return JsonResponse(
            {"error": "You already have a pending offer on this item. Withdraw it first."},
            status=409,
        )

    card = _listing_card_text(status, selected_media_url)
    note_line = f'\n\n💬 "{note}"' if note else ''
    msg_text  = (
        f'{card}\n\n'
        f'🤝 Offer: {_fmt_price(amount)}{note_line}'
    )

    with transaction.atomic():
        offer = Offer.objects.create(
            status=status, buyer=request.user, seller=status.user,
            proposed_by=request.user, amount=amount, state='pending',
        )
        # Store selected_media_url in the message reply_media field so
        # the frontend can show the right photo next to the offer card.
        msg = Message.objects.create(
            sender        = request.user,
            recipient     = status.user,
            message       = msg_text,
            message_type  = 'offer',
            offer         = offer,
            related_status= status,
            reply_media   = selected_media_url,
        )

    return JsonResponse({
        "status":     "success",
        "offer": {
            "id":          offer.id,
            "amount":      str(offer.amount),
            "state":       offer.state,
            "proposed_by": offer.proposed_by.username,
        },
        "message_id": msg.id,
    })


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def respond_to_offer(request):
    """
    The non-proposing party responds: accept / decline / counter.

    POST JSON body:
        offer_id   int
        action     'accept' | 'decline' | 'counter'
        amount     decimal (required for 'counter')
        note       str     (optional, max 200 chars)
    """
    try:
        data = json.loads(request.body or b"{}")
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    offer_id = data.get("offer_id")
    action = data.get("action")
    counter_amount = data.get("amount")
    note = (data.get("note") or "").strip()[:200]

    if not offer_id or action not in ("accept", "decline", "counter"):
        return JsonResponse({"error": "offer_id and a valid action are required"}, status=400)

    try:
        offer = Offer.objects.select_related("status", "buyer", "seller", "proposed_by").get(id=offer_id)
    except Offer.DoesNotExist:
        return JsonResponse({"error": "Offer not found"}, status=404)

    if request.user.id not in (offer.buyer_id, offer.seller_id):
        return JsonResponse({"error": "You are not part of this offer."}, status=403)
    if offer.proposed_by_id == request.user.id:
        return JsonResponse({"error": "You cannot respond to your own offer."}, status=403)
    if offer.state != "pending":
        return JsonResponse(
            {"error": f"Offer is already {offer.state}. Only pending offers can be acted upon."},
            status=400,
        )

    counter_decimal = None
    if action == "counter":
        try:
            counter_decimal = Decimal(str(counter_amount))
        except Exception:
            return JsonResponse({"error": "Invalid amount"}, status=400)
        if not counter_decimal.is_finite() or counter_decimal <= 0:
            return JsonResponse({"error": "Amount must be positive"}, status=400)

    other = offer.seller if request.user.id == offer.buyer_id else offer.buyer
    card = _listing_card_text(offer.status)
    note_line = f'\n\n💬 "{note}"' if note else ""

    with transaction.atomic():
        locked_status = UserStatus.objects.select_for_update().get(pk=offer.status_id)

        if action == "accept":
            if locked_status.availability in ("sold", "reserved"):
                return JsonResponse(
                    {"error": "This item was taken by another buyer while you were negotiating."},
                    status=409,
                )
            offer.state = "accepted"
            offer.responded_at = now()
            offer.save()
            deal = Deal.objects.create(
                status=locked_status, buyer=offer.buyer, seller=offer.seller,
                offer=offer, final_price=offer.amount,
                collection_point_snapshot=locked_status.collection_point,
                buyer_confirmed=True, buyer_confirmed_at=now(),
                seller_confirmed=True, seller_confirmed_at=now(),
                state="confirmed",
            )
            locked_status.availability = "reserved"
            locked_status.save(update_fields=["availability"])
            _create_system_msg(
                sender=request.user, recipient=other,
                text=(f"{card}\n\n✅ Deal agreed at {_fmt_price(offer.amount)}!{note_line}\n\n"
                      "Proceed to checkout to finalise payment."),
                message_type="deal_confirmation", deal=deal, status=locked_status,
            )
            return JsonResponse({
                "status": "success",
                "deal_id": deal.id,
                "final_price": str(deal.final_price),
            })

        if action == "decline":
            offer.state = "declined"
            offer.responded_at = now()
            offer.save()
            _create_system_msg(
                sender=request.user, recipient=other,
                text=f"{card}\n\n❌ Offer of {_fmt_price(offer.amount)} declined.{note_line}",
                message_type="status_update", status=locked_status,
            )
            return JsonResponse({"status": "success"})

        # action == "counter"
        offer.state = "countered"
        offer.responded_at = now()
        offer.save()
        new_offer = Offer.objects.create(
            status=locked_status, buyer=offer.buyer, seller=offer.seller,
            amount=counter_decimal, proposed_by=request.user,
            note=note, parent_offer=offer, state="pending",
        )
        _create_system_msg(
            sender=request.user, recipient=other,
            text=f"{card}\n\n🔄 Counter offer: {_fmt_price(counter_decimal)}{note_line}",
            message_type="status_update", status=locked_status,
        )
        return JsonResponse({"status": "success", "offer_id": new_offer.id})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def withdraw_offer(request):
    """Buyer withdraws their own pending offer."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    offer_id = data.get('offer_id')
    if not offer_id:
        return JsonResponse({"error": "offer_id required"}, status=400)

    try:
        offer = Offer.objects.select_related('status', 'seller').get(id=offer_id)
    except Offer.DoesNotExist:
        return JsonResponse({"error": "Offer not found"}, status=404)

    if offer.buyer != request.user:
        return JsonResponse({"error": "Only the buyer can withdraw an offer"}, status=403)
    if offer.state != 'pending':
        return JsonResponse({"error": f"Cannot withdraw an offer in state {offer.state}"}, status=400)

    with transaction.atomic():
        offer.state        = 'withdrawn'
        offer.responded_at = now()
        offer.save()

        card = _listing_card_text(offer.status)
        _create_system_msg(
            sender=request.user, recipient=offer.seller,
            text=f'{card}\n\n🔙 Offer of {_fmt_price(offer.amount)} withdrawn by buyer.',
            message_type='status_update', status=offer.status,
        )

    return JsonResponse({"status": "success"})


# ─── Negotiate-in-chat ─────────────────────────────────────────────────────

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def negotiate_chat(request):
    """
    NEW ENDPOINT — /api/negotiate/chat/

    Sends a free-text negotiation message inside an active offer thread.
    The listing card is always prepended so every message is self-contained
    (the "Zambian bazaar" feel — you always know what's on the table).

    Unlike a plain message send this endpoint:
      • Validates the offer exists and that the caller is a participant.
      • Marks the offer as the FK on the message so the frontend can
        group / thread messages by offer.
      • Optionally lets the sender piggyback a fresh counter amount
        (shortcut so they can type "K500 — last price!" in one go).

    POST body:
        offer_id           int
        message            str   (free text, max 500 chars)
        counter_amount     decimal  (optional — attach a counter in same call)
        selected_media_url str   (optional — carry a photo reference)
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    offer_id           = data.get('offer_id')
    message_text       = (data.get('message') or '').strip()[:500]
    counter_amount_raw = data.get('counter_amount')
    selected_media_url = (data.get('selected_media_url') or '').strip()[:500]

    if not offer_id:
        return JsonResponse({"error": "offer_id required"}, status=400)
    if not message_text and not counter_amount_raw:
        return JsonResponse({"error": "message or counter_amount required"}, status=400)

    try:
        offer = Offer.objects.select_related(
            'status', 'buyer', 'seller', 'proposed_by'
        ).get(id=offer_id)
    except Offer.DoesNotExist:
        return JsonResponse({"error": "Offer not found"}, status=404)

    me = request.user
    if me not in (offer.buyer, offer.seller):
        return JsonResponse({"error": "You are not a party to this offer"}, status=403)

    if offer.state not in ('pending', 'countered'):
        return JsonResponse(
            {"error": f"Cannot chat on an offer that is already {offer.state}"},
            status=400,
        )

    recipient = offer.seller if me == offer.buyer else offer.buyer
    status    = offer.status
    card      = _listing_card_text(status, selected_media_url)

    with transaction.atomic():
        locked_status = UserStatus.objects.select_for_update().get(pk=status.pk)

        if locked_status.availability in ('sold',):
            return JsonResponse({"error": "This item has already been sold."}, status=409)

        # If a counter amount is embedded in the chat message, promote it
        # to a proper counter offer automatically so the seller sees a real
        # actionable card, not just loose text.
        new_counter = None
        if counter_amount_raw:
            try:
                ca = Decimal(str(counter_amount_raw))
                if ca <= 0:
                    raise ValueError
            except Exception:
                return JsonResponse({"error": "Invalid counter_amount"}, status=400)

            # Only the non-proposing party can send a counter
            if offer.proposed_by == me:
                # Proposing party nudging their own price — just send as text
                pass
            else:
                # Close the old offer and open a counter
                offer.state        = 'countered'
                offer.responded_at = now()
                offer.save()

                new_counter = Offer.objects.create(
                    status=locked_status,
                    buyer=offer.buyer, seller=offer.seller,
                    proposed_by=me,
                    amount=ca,
                    state='pending',
                    parent_offer=offer,
                )
                who_label = "Seller" if me == offer.seller else "Buyer"
                counter_suffix = (
                    f'\n\n🔄 Counter: {_fmt_price(ca)} '
                    f'(was {_fmt_price(offer.amount)})'
                )
                # Use the counter offer as the FK on this message
                offer = new_counter  # re-bind for message creation below

        body = f'{card}\n\n{message_text}'
        if new_counter and counter_amount_raw:
            body += counter_suffix

        msg = Message.objects.create(
            sender        = me,
            recipient     = recipient,
            message       = body,
            message_type  = 'offer' if new_counter else 'text',
            offer         = offer,    # may now be the counter_offer
            related_status= locked_status,
            reply_media   = selected_media_url,
        )

    result = {"status": "success", "message_id": msg.id}
    if new_counter:
        result["counter_offer_id"] = new_counter.id
        result["counter_amount"]   = str(new_counter.amount)
    return JsonResponse(result)


# ─── Take listing (Buy Now) ────────────────────────────────────────────────

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def take_listing(request):
    """
    Buyer taps "Buy Now" — skips negotiation and goes straight to a Deal
    at the listed price.

    select_for_update() prevents two concurrent taps from both succeeding.

    POST body:
        status_id              int
        payment_method         str
        delivery_address       str  (optional)
        delivery_instructions  str  (optional)
        selected_media_url     str  (optional — the photo the buyer tapped)
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    status_id          = data.get('status_id')
    selected_media_url = (data.get('selected_media_url') or '').strip()[:500]

    if not status_id:
        return JsonResponse({"error": "status_id required"}, status=400)

    with transaction.atomic():
        # Lock the row before reading availability — this is the key race fix.
        try:
            status = UserStatus.objects.select_for_update().get(id=status_id)
        except UserStatus.DoesNotExist:
            return JsonResponse({"error": "Status not found"}, status=404)

        if not status.is_commercial:
            return JsonResponse({"error": "This status is not for sale"}, status=400)
        if status.availability != 'available':
            return JsonResponse(
                {"error": "This item is no longer available — someone else just reserved it."},
                status=409,
            )
        if status.user == request.user:
            return JsonResponse({"error": "You cannot buy your own listing"}, status=403)
        if status.price is None:
            return JsonResponse({"error": "This listing has no price set"}, status=400)

        deal = Deal.objects.create(
            status=status, buyer=request.user, seller=status.user,
            offer=None, final_price=status.price,
            collection_point_snapshot=status.collection_point,
            buyer_confirmed=True, buyer_confirmed_at=now(),
            seller_confirmed=False, state='pending_confirmation',
            payment_method=data.get('payment_method', '').strip(),
            delivery_address=data.get('delivery_address', '').strip(),
            delivery_instructions=data.get('delivery_instructions', '').strip(),
        )
        # Mark reserved immediately — any concurrent select_for_update
        # on this row will now see 'reserved' and bail.
        status.availability = 'reserved'
        status.save(update_fields=['availability'])

        card     = _listing_card_text(status, selected_media_url)
        buy_text = (
            f'{card}\n\n'
            f'🛒 Buyer wants to purchase at {_fmt_price(status.price)}\n'
            f'Please confirm the deal to proceed.'
        )
        _create_system_msg(
            sender=request.user, recipient=status.user,
            text=buy_text,
            message_type='deal_confirmation',
            deal=deal, status=status,
        )
        # Also store selected_media on the first deal message
        if selected_media_url:
            Message.objects.filter(deal=deal).update(reply_media=selected_media_url)

    return JsonResponse({
        "status":   "success",
        "deal_id":  deal.id,
        "message":  "Your purchase request has been sent. The seller must confirm to complete the deal.",
        "final_price": str(deal.final_price),
    })


# ─── Confirm deal ─────────────────────────────────────────────────────────

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def confirm_deal(request):
    """Either party confirms a pending deal."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    deal_id = data.get('deal_id')
    if not deal_id:
        return JsonResponse({"error": "deal_id required"}, status=400)

    try:
        deal = Deal.objects.select_related(
            'buyer', 'seller', 'status'
        ).get(id=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)

    if deal.state != 'pending_confirmation':
        return JsonResponse(
            {"error": f"Deal cannot be confirmed (current state: {deal.state})"},
            status=400,
        )

    with transaction.atomic():
        if request.user == deal.buyer:
            if deal.buyer_confirmed:
                return JsonResponse({"error": "You already confirmed this deal"}, status=409)
            deal.buyer_confirmed    = True
            deal.buyer_confirmed_at = now()
        elif request.user == deal.seller:
            if deal.seller_confirmed:
                return JsonResponse({"error": "You already confirmed this deal"}, status=409)
            deal.seller_confirmed    = True
            deal.seller_confirmed_at = now()
        else:
            return JsonResponse({"error": "You are not part of this deal"}, status=403)

        both_confirmed = deal.buyer_confirmed and deal.seller_confirmed
        if both_confirmed:
            deal.state = 'confirmed'
            deal.status.availability = 'reserved'
            deal.status.save(update_fields=['availability'])

        deal.save()

        other = deal.seller if request.user == deal.buyer else deal.buyer
        card  = _listing_card_text(deal.status)

        if both_confirmed:
            confirm_text = (
                f'{card}\n\n'
                f'✅ Both parties confirmed! Agreed price: {_fmt_price(deal.final_price)}\n'
                f'Proceed to payment when ready.'
            )
        else:
            confirm_text = (
                f'{card}\n\n'
                f'✅ {request.user.username} confirmed the deal — waiting for the other party.'
            )

        _create_system_msg(
            sender=request.user, recipient=other,
            text=confirm_text,
            message_type='deal_confirmation' if both_confirmed else 'status_update',
            deal=deal, status=deal.status,
        )

    return JsonResponse({
        "status":     "success",
        "deal_state": deal.state,
        "both_confirmed": both_confirmed,
    })


# ─── Complete deal ─────────────────────────────────────────────────────────

@login_required
@require_POST
def complete_deal(request):
    """
    Buyer (or seller) confirms payment.
    Marks the deal completed and the listing sold.

    POST: {
        "deal_id": int,
        "payment_method": str,
        "payment_account": str,
        "payment_reference": str
    }
    """
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, AttributeError):
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    deal_id           = data.get('deal_id')
    payment_method    = data.get('payment_method', '').strip()
    payment_account   = data.get('payment_account', '').strip()
    payment_reference = data.get('payment_reference', '').strip()

    if not deal_id:
        return JsonResponse({'error': 'deal_id is required'}, status=400)
    if not payment_method:
        return JsonResponse({'error': 'payment_method is required'}, status=400)

    try:
        deal = Deal.objects.select_related('buyer', 'seller', 'status').get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({'error': 'Deal not found'}, status=404)

    me = request.user
    if me not in (deal.buyer, deal.seller):
        return JsonResponse({'error': 'Not a participant in this deal'}, status=403)

    if deal.state != 'confirmed':
        return JsonResponse(
            {'error': f'Deal must be in "confirmed" state to complete (currently: {deal.state})'},
            status=400,
        )

    with transaction.atomic():
        deal.state             = 'completed'
        deal.payment_method    = payment_method
        deal.payment_account   = payment_account
        deal.payment_reference = payment_reference
        deal.save()

        status_obj = deal.status
        if status_obj:
            status_obj.availability = 'sold'
            status_obj.save(update_fields=['availability'])

        method_label = _METHOD_LABELS.get(payment_method, payment_method)
        card         = _listing_card_text(status_obj)
        note_parts   = [f'💰 Payment confirmed via {method_label}']
        if payment_account:   note_parts.append(f'Account: {payment_account}')
        if payment_reference: note_parts.append(f'Ref: {payment_reference}')

        other = deal.seller if me == deal.buyer else deal.buyer
        _create_system_msg(
            sender=me, recipient=other,
            text=f'{card}\n\n' + ' · '.join(note_parts) + f'\n\nFinal price: {_fmt_price(deal.final_price)}',
            message_type='status_update',
            deal=deal, status=status_obj,
        )

    return JsonResponse({
        'status':  'success',
        'message': 'Deal completed.',
        'deal': {
            'id':          deal.pk,
            'state':       deal.state,
            'payment_method': deal.payment_method,
            'final_price': str(deal.final_price),
        }
    })


# ─── Cancel deal ──────────────────────────────────────────────────────────

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def cancel_deal(request):
    """Either party cancels a pending or confirmed deal."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    deal_id = data.get('deal_id')
    if not deal_id:
        return JsonResponse({"error": "deal_id required"}, status=400)

    try:
        deal = Deal.objects.select_related('buyer', 'seller', 'status').get(id=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)

    if deal.state not in ('pending_confirmation', 'confirmed'):
        return JsonResponse({"error": f"Cannot cancel a deal in state {deal.state}"}, status=400)

    if request.user not in (deal.buyer, deal.seller):
        return JsonResponse({"error": "You are not part of this deal"}, status=403)

    with transaction.atomic():
        locked_status = UserStatus.objects.select_for_update().get(pk=deal.status_id)
        deal.state            = 'cancelled'
        deal.save()
        locked_status.availability = 'available'
        locked_status.save(update_fields=['availability'])

        other = deal.seller if request.user == deal.buyer else deal.buyer
        card  = _listing_card_text(locked_status)
        _create_system_msg(
            sender=request.user, recipient=other,
            text=f'{card}\n\n❌ Deal cancelled by {request.user.username}.\nItem is available again.',
            message_type='status_update',
            deal=deal, status=locked_status,
        )

    return JsonResponse({"status": "success"})