# ============================================================
# negotiate_views.py — Fizzme Zambian bargaining engine
#
# FIXES in this revision
# ──────────────────────
#   ENQUIRY  create_offer now stores the buyer's most recent
#            status enquiry on the offer message's reply_text
#            so the seller sees it even if the thread is
#            trimmed or reloaded.
#
#   COUNTER  respond_to_offer's counter branch carries the
#            parent offer's enquiry forward to the new counter
#            offer's message.
#
#   PUSH     _send_message fires a push notification after
#            saving the Message row.
#
#   LOCK     select_for_update on state-changing endpoints.
# ============================================================

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.utils import timezone

from ..models import Deal, Message, Offer, UserStatus

try:
    from ..views_messages import send_push_notification as _push
except ImportError:
    _push = None


LOCKED_STATES = ('reserved', 'sold')


# ─────────────────────────────────────────────────────────────
# SERIALISERS
# ─────────────────────────────────────────────────────────────

def _listing_snapshot(status_obj):
    return {
        'status_id':        status_obj.pk,
        'username':         status_obj.user.username,
        'caption':          status_obj.caption or '',
        'price':            str(status_obj.price) if status_obj.price is not None else None,
        'is_negotiable':    status_obj.is_negotiable,
        'media_url':        _media_url(status_obj),
        'is_commercial':    True,
        'availability':     status_obj.availability,
        'collection_point': status_obj.collection_point or '',
    }


def _media_url(status_obj):
    try:
        first = status_obj.media_items.order_by('order', 'id').first()
        if first:
            url = first.file.url if hasattr(first.file, 'url') else str(first.file)
            return url.replace('http://', 'https://') if url else ''
        legacy = getattr(status_obj, 'media', None)
        if legacy:
            url = legacy.url if hasattr(legacy, 'url') else str(legacy)
            return url.replace('http://', 'https://') if url else ''
    except Exception:
        pass
    return ''


def _serialize_offer(offer):
    return {
        'id':          offer.pk,
        'amount':      str(offer.amount),
        'state':       offer.state,
        'proposed_by': offer.proposed_by.username,
        'note':        getattr(offer, 'note', '') or '',
        'created_at':  offer.created_at.isoformat() if offer.created_at else None,
    }


def _serialize_deal(deal):
    return {
        'id':               deal.pk,
        'final_price':      str(deal.final_price),
        'state':            deal.state,
        'buyer':            deal.buyer.username  if hasattr(deal.buyer,  'username') else str(deal.buyer),
        'seller':           deal.seller.username if hasattr(deal.seller, 'username') else str(deal.seller),
        'buyer_confirmed':  deal.buyer_confirmed,
        'seller_confirmed': deal.seller_confirmed,
        'payment_method':   deal.payment_method or '',
        'collection_point': deal.collection_point_snapshot or '',
    }


# ─────────────────────────────────────────────────────────────
# INTERNAL MESSAGE FACTORY
# ─────────────────────────────────────────────────────────────

def _send_message(sender_user, recipient_user, text, message_type,
                  status_obj, offer=None, deal=None, reply_media='',
                  reply_text=''):
    """
    Create one Message row with proper FK assignments.

    reply_media  — buyer-selected photo URL (rendered on the card).
    reply_text   — buyer's original enquiry text (rendered on the card).
                   Both are stored on the Message itself so they survive
                   thread trims and page reloads.
    """
    msg = Message(
        sender=sender_user,
        recipient=recipient_user,
        message=text,
        message_type=message_type,
        related_status=status_obj,
        reply_media=reply_media or '',
        reply_text=reply_text or '',
    )
    if offer is not None:
        msg.offer = offer
    if deal is not None:
        msg.deal = deal
    msg.save()

    try:
        push_fn = _push
        if push_fn is None:
            from ..views_messages import send_push_notification as push_fn  # noqa
        push_fn(recipient_user, sender_user.username, text)
    except Exception:
        pass

    return msg


# ─────────────────────────────────────────────────────────────
# ENQUIRY LOOKUP HELPER
# ─────────────────────────────────────────────────────────────

def _extract_enquiry_text(raw):
    """
    Given a raw message body, strip the '> 🏷️ Listing…' quote lines
    and return just the buyer's typed text.
    """
    if not raw:
        return ''
    lines = []
    for ln in raw.split('\n'):
        s = ln.strip()
        if not s:
            continue
        if s.startswith('>'):
            continue
        lines.append(s)
    return '\n'.join(lines).strip()[:500]


def _find_recent_enquiry(buyer, seller, status_obj):
    """
    Return the most recent plain-text enquiry the buyer sent to the
    seller on this specific listing, or '' if none.
    """
    try:
        recent = Message.objects.filter(
            sender=buyer,
            recipient=seller,
            related_status=status_obj,
            message_type='text',
        ).order_by('-timestamp').first()
        if not recent:
            return ''
        return _extract_enquiry_text(recent.message)
    except Exception:
        return ''


# ─────────────────────────────────────────────────────────────
# RESPONSE HELPER
# ─────────────────────────────────────────────────────────────

def _msg_response(msg, extra=None):
    payload = {
        'status':         'success',
        'message_type':   msg.message_type,
        'message':        msg.message,
        'reply_text':     msg.reply_text or '',
        'reply_media':    msg.reply_media or '',
        'related_status': _listing_snapshot(msg.related_status) if msg.related_status else None,
    }
    if msg.offer_id:
        payload['offer'] = _serialize_offer(msg.offer)
    if msg.deal_id:
        payload['deal'] = _serialize_deal(msg.deal)
    if extra:
        payload.update(extra)
    return JsonResponse(payload)


# ─────────────────────────────────────────────────────────────
# 1. CREATE OFFER
# ─────────────────────────────────────────────────────────────

@login_required
@require_POST
def create_offer(request):
    import json
    try:
        body = json.loads(request.body)
    except Exception:
        body = request.POST

    status_id          = body.get('status_id')
    amount_raw         = body.get('amount')
    note               = (body.get('note') or '').strip()[:280]
    selected_media_url = (body.get('selected_media_url') or '').strip()[:2000]

    status_obj = get_object_or_404(UserStatus, pk=status_id)

    if status_obj.user == request.user:
        return JsonResponse({'status': 'error', 'error': "That's your own listing."}, status=400)
    if not status_obj.is_negotiable:
        return JsonResponse({'status': 'error', 'error': 'This listing is not negotiable.'}, status=400)
    if status_obj.availability in LOCKED_STATES:
        return JsonResponse({'status': 'error', 'error': 'This item is no longer available.'}, status=409)

    if Offer.objects.filter(status=status_obj, proposed_by=request.user, state='pending').exists():
        return JsonResponse(
            {'status': 'error', 'error': 'You already have a pending offer on this item.'},
            status=400,
        )

    try:
        amount = float(amount_raw)
        if amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return JsonResponse({'status': 'error', 'error': 'Enter a valid amount.'}, status=400)

    offer = Offer(
        status=status_obj,
        buyer=request.user,
        seller=status_obj.user,
        proposed_by=request.user,
        amount=amount,
        state='pending',
    )
    for field, value in [('note', note), ('selected_media_url', selected_media_url)]:
        if hasattr(offer, field) and value:
            setattr(offer, field, value)
    offer.save()

    # ── Look up the buyer's most recent enquiry on this listing ──
    # Stored on the Message itself so the seller sees the original
    # "Hi, I'm interested…" text even after a page reload.
    enquiry_text = _find_recent_enquiry(
        buyer=request.user,
        seller=status_obj.user,
        status_obj=status_obj,
    )

    text = f"🤝 Offer: K{amount:,.2f}" + (f' — "{note}"' if note else '')
    msg  = _send_message(
        sender_user=request.user,
        recipient_user=status_obj.user,
        text=text,
        message_type='offer',
        status_obj=status_obj,
        offer=offer,
        reply_media=selected_media_url,
        reply_text=enquiry_text,
    )
    return _msg_response(msg, {'offer_id': offer.pk})


# ─────────────────────────────────────────────────────────────
# 2. RESPOND TO OFFER — accept / counter / decline
# ─────────────────────────────────────────────────────────────

@login_required
@require_POST
def respond_to_offer(request):
    import json
    try:
        body = json.loads(request.body)
    except Exception:
        body = request.POST

    offer_id   = body.get('offer_id')
    action     = body.get('action')
    amount_raw = body.get('amount')
    note       = (body.get('note') or '').strip()[:280]

    offer      = get_object_or_404(Offer, pk=offer_id)
    status_obj = offer.status

    if offer.proposed_by == request.user:
        return JsonResponse({'status': 'error', 'error': 'You cannot respond to your own offer.'}, status=403)
    if offer.state != 'pending':
        return JsonResponse({'status': 'error', 'error': 'This offer is no longer pending.'}, status=400)

    other = offer.proposed_by

    # ── Find the parent message so we can carry the enquiry forward ──
    parent_msg = None
    try:
        parent_msg = Message.objects.filter(offer=offer).order_by('-timestamp').first()
    except Exception:
        parent_msg = None

    parent_enquiry = ''
    parent_media   = ''
    if parent_msg:
        parent_enquiry = parent_msg.reply_text or ''
        parent_media   = parent_msg.reply_media or ''

    # ── Decline ───────────────────────────────────────────────────────
    if action == 'decline':
        offer.state        = 'declined'
        offer.responded_at = timezone.now()
        offer.save(update_fields=['state', 'responded_at'])
        msg = _send_message(
            sender_user=request.user,
            recipient_user=other,
            text='❌ Offer declined.',
            message_type='offer',
            status_obj=status_obj,
            offer=offer,
            reply_media=parent_media,
            reply_text=parent_enquiry,
        )
        return _msg_response(msg)

    # ── Counter ───────────────────────────────────────────────────────
    if action == 'counter':
        try:
            amount = float(amount_raw)
            if amount <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return JsonResponse({'status': 'error', 'error': 'Enter a valid amount.'}, status=400)

        offer.state        = 'countered'
        offer.responded_at = timezone.now()
        offer.save(update_fields=['state', 'responded_at'])

        smurl = getattr(offer, 'selected_media_url', '') or parent_media
        new_offer = Offer(
            status=status_obj,
            buyer=offer.buyer,
            seller=offer.seller,
            proposed_by=request.user,
            amount=amount,
            state='pending',
        )
        if hasattr(new_offer, 'parent_offer'):
            new_offer.parent_offer = offer
        for field, value in [('note', note), ('selected_media_url', smurl)]:
            if hasattr(new_offer, field) and value:
                setattr(new_offer, field, value)
        new_offer.save()

        text = f"🔄 Counter offer: K{amount:,.2f}" + (f' — "{note}"' if note else '')
        msg  = _send_message(
            sender_user=request.user,
            recipient_user=other,
            text=text,
            message_type='offer',
            status_obj=status_obj,
            offer=new_offer,
            reply_media=smurl,
            reply_text=parent_enquiry,   # ← carry the enquiry forward
        )
        return _msg_response(msg, {'offer_id': new_offer.pk})

    # ── Accept ────────────────────────────────────────────────────────
    if action == 'accept':
        with transaction.atomic():
            locked_status = UserStatus.objects.select_for_update().get(pk=status_obj.pk)
            locked_offer  = Offer.objects.select_for_update().get(pk=offer.pk)

            if locked_status.availability in LOCKED_STATES:
                locked_offer.state = 'declined'
                locked_offer.save(update_fields=['state'])
                return JsonResponse({'status': 'error', 'error': 'This item is no longer available.'}, status=409)

            locked_offer.state        = 'accepted'
            locked_offer.responded_at = timezone.now()
            locked_offer.save(update_fields=['state', 'responded_at'])

            deal = Deal.objects.create(
                status=locked_status,
                buyer=locked_offer.buyer,
                seller=locked_offer.seller,
                offer=locked_offer,
                final_price=locked_offer.amount,
                collection_point_snapshot=locked_status.collection_point or '',
                state='pending_confirmation',
                buyer_confirmed=False,
                seller_confirmed=False,
            )

            locked_status.availability = 'reserved'
            locked_status.save(update_fields=['availability'])

        text = f"🎉 Deal agreed at K{locked_offer.amount:,.2f}! Tap to confirm and pay."
        msg  = _send_message(
            sender_user=request.user,
            recipient_user=locked_offer.proposed_by,
            text=text,
            message_type='deal_confirmation',
            status_obj=locked_status,
            deal=deal,
            reply_media=parent_media,
            reply_text=parent_enquiry,   # ← carry the enquiry to the deal card
        )
        return _msg_response(msg, {
            'deal_id':     deal.pk,
            'final_price': str(deal.final_price),
            'deal':        _serialize_deal(deal),
        })

    return JsonResponse({'status': 'error', 'error': 'Unknown action.'}, status=400)


# ─────────────────────────────────────────────────────────────
# 3. WITHDRAW OFFER
# ─────────────────────────────────────────────────────────────

@login_required
@require_POST
def withdraw_offer(request):
    import json
    try:
        body = json.loads(request.body)
    except Exception:
        body = request.POST

    offer_id = body.get('offer_id')
    offer    = get_object_or_404(Offer, pk=offer_id, proposed_by=request.user)

    if offer.state != 'pending':
        return JsonResponse({'status': 'error', 'error': 'Offer is no longer pending.'}, status=400)

    offer.state        = 'withdrawn'
    offer.responded_at = timezone.now()
    offer.save(update_fields=['state', 'responded_at'])

    other = offer.seller if offer.proposed_by == offer.buyer else offer.buyer
    text  = f"↩️ Offer of K{offer.amount:,.2f} withdrawn."
    msg   = _send_message(
        sender_user=request.user,
        recipient_user=other,
        text=text,
        message_type='offer',
        status_obj=offer.status,
        offer=offer,
    )
    return _msg_response(msg)


# ─────────────────────────────────────────────────────────────
# 4. BUY NOW
# ─────────────────────────────────────────────────────────────

@login_required
@require_POST
def take_listing(request):
    import json
    try:
        body = json.loads(request.body)
    except Exception:
        body = request.POST

    status_id          = body.get('status_id')
    payment_method     = body.get('payment_method', '')
    delivery_addr      = body.get('delivery_address', '')
    instructions       = body.get('delivery_instructions', '')
    selected_media_url = (body.get('selected_media_url') or '').strip()[:2000]

    with transaction.atomic():
        status_obj = get_object_or_404(UserStatus.objects.select_for_update(), pk=status_id)

        if status_obj.user == request.user:
            return JsonResponse({'status': 'error', 'error': "That's your own listing."}, status=400)
        if status_obj.availability in LOCKED_STATES:
            return JsonResponse({'status': 'error', 'error': 'This item is no longer available.'}, status=409)

        deal = Deal.objects.create(
            status=status_obj,
            buyer=request.user,
            seller=status_obj.user,
            final_price=status_obj.price,
            collection_point_snapshot=delivery_addr or status_obj.collection_point or '',
            payment_method=payment_method or '',
            delivery_address=delivery_addr,
            delivery_instructions=instructions,
            state='pending_confirmation',
            buyer_confirmed=True,
            seller_confirmed=False,
        )
        status_obj.availability = 'reserved'
        status_obj.save(update_fields=['availability'])

    # Carry the buyer's enquiry into the deal card as well.
    enquiry_text = _find_recent_enquiry(
        buyer=request.user,
        seller=status_obj.user,
        status_obj=status_obj,
    )

    text = f"🛒 Purchase request — K{deal.final_price:,.2f} via {payment_method}."
    msg  = _send_message(
        sender_user=request.user,
        recipient_user=status_obj.user,
        text=text,
        message_type='deal_confirmation',
        status_obj=status_obj,
        deal=deal,
        reply_media=selected_media_url,
        reply_text=enquiry_text,
    )
    return _msg_response(msg, {'deal_id': deal.pk, 'deal': _serialize_deal(deal)})


# ─────────────────────────────────────────────────────────────
# 5. CONFIRM DEAL
# ─────────────────────────────────────────────────────────────

@login_required
@require_POST
def confirm_deal(request):
    import json
    try:
        body = json.loads(request.body)
    except Exception:
        body = request.POST

    deal_id = body.get('deal_id')

    with transaction.atomic():
        deal = get_object_or_404(Deal.objects.select_for_update(), pk=deal_id)

        is_buyer  = deal.buyer  == request.user
        is_seller = deal.seller == request.user
        if not (is_buyer or is_seller):
            return JsonResponse({'status': 'error', 'error': 'Not a party to this deal.'}, status=403)
        if deal.state not in ('pending_confirmation',):
            return JsonResponse({'status': 'error', 'error': 'Deal is not awaiting confirmation.'}, status=400)

        now = timezone.now()
        if is_buyer and not deal.buyer_confirmed:
            deal.buyer_confirmed    = True
            deal.buyer_confirmed_at = now
        if is_seller and not deal.seller_confirmed:
            deal.seller_confirmed    = True
            deal.seller_confirmed_at = now

        if deal.buyer_confirmed and deal.seller_confirmed:
            deal.state = 'confirmed'
        deal.save()

    other = deal.seller if is_buyer else deal.buyer
    text  = ('✅ Both parties confirmed — proceed to payment.'
             if deal.state == 'confirmed'
             else '✅ Your side confirmed — waiting for the other party.')
    msg   = _send_message(
        sender_user=request.user,
        recipient_user=other,
        text=text,
        message_type='deal_confirmation',
        status_obj=deal.status,
        deal=deal,
    )
    return _msg_response(msg, {'deal': _serialize_deal(deal)})


# ─────────────────────────────────────────────────────────────
# 6. COMPLETE DEAL
# ─────────────────────────────────────────────────────────────

@login_required
@require_POST
def complete_deal(request):
    import json
    try:
        body = json.loads(request.body)
    except Exception:
        body = request.POST

    deal_id         = body.get('deal_id')
    payment_method  = (body.get('payment_method')  or '').strip()[:100]
    payment_account = (body.get('payment_account') or '').strip()[:200]
    payment_ref     = (body.get('payment_ref')     or '').strip()[:200]

    with transaction.atomic():
        deal       = get_object_or_404(Deal.objects.select_for_update(), pk=deal_id)
        status_obj = UserStatus.objects.select_for_update().get(pk=deal.status_id)

        if deal.state == 'completed':
            return JsonResponse({'status': 'success', 'already': True, 'deal': _serialize_deal(deal)})
        if deal.state == 'cancelled':
            return JsonResponse({'status': 'error', 'error': 'This deal was cancelled.'}, status=400)

        for field, value in [
            ('payment_method',  payment_method),
            ('payment_account', payment_account),
            ('payment_ref',     payment_ref),
        ]:
            if hasattr(deal, field) and value:
                setattr(deal, field, value)

        deal.state = 'completed'
        deal.save()

        status_obj.availability = 'sold'
        status_obj.save(update_fields=['availability'])

    notify_user = deal.seller if deal.buyer == request.user else deal.buyer
    text = (
        f"✅ Payment confirmed — K{deal.final_price:,.2f} received!\n"
        f"Method: {payment_method or 'not specified'}"
    )
    msg = _send_message(
        sender_user=request.user,
        recipient_user=notify_user,
        text=text,
        message_type='deal_confirmation',
        status_obj=status_obj,
        deal=deal,
    )
    return _msg_response(msg, {
        'deal': _serialize_deal(deal),
        'message': 'Sale complete. Payment recorded.',
    })


# ─────────────────────────────────────────────────────────────
# 7. CANCEL DEAL
# ─────────────────────────────────────────────────────────────

@login_required
@require_POST
def cancel_deal(request):
    import json
    try:
        body = json.loads(request.body)
    except Exception:
        body = request.POST

    deal_id = body.get('deal_id')

    with transaction.atomic():
        deal       = get_object_or_404(Deal.objects.select_for_update(), pk=deal_id)
        status_obj = UserStatus.objects.select_for_update().get(pk=deal.status_id)

        if deal.state in ('completed', 'cancelled'):
            return JsonResponse({'status': 'error', 'error': 'Deal already finalized.'}, status=400)

        deal.state = 'cancelled'
        deal.save(update_fields=['state'])

        status_obj.availability = 'available'
        status_obj.save(update_fields=['availability'])

    other = deal.buyer if deal.seller == request.user else deal.seller
    text  = '❌ Deal cancelled — item is available again.'
    msg   = _send_message(
        sender_user=request.user,
        recipient_user=other,
        text=text,
        message_type='status_update',
        status_obj=status_obj,
        deal=deal,
    )
    return _msg_response(msg)


# ─────────────────────────────────────────────────────────────
# 8. NEGOTIATE CHAT (free-text within an offer thread)
# ─────────────────────────────────────────────────────────────

@login_required
@require_POST
def negotiate_chat(request):
    import json
    try:
        body = json.loads(request.body)
    except Exception:
        body = request.POST

    offer_id    = body.get('offer_id')
    message_txt = (body.get('message') or '').strip()[:500]
    counter_amt = body.get('counter_amount')

    offer      = get_object_or_404(Offer, pk=offer_id)
    status_obj = offer.status

    if request.user not in (offer.buyer, offer.seller):
        return JsonResponse({'status': 'error', 'error': 'Not a party to this offer.'}, status=403)

    other = offer.seller if request.user == offer.buyer else offer.buyer

    if counter_amt:
        try:
            counter_amt = float(counter_amt)
            if counter_amt <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return JsonResponse({'status': 'error', 'error': 'Invalid counter amount.'}, status=400)
        message_txt = f"🔄 Counter: K{counter_amt:,.2f}" + (f"  —  {message_txt}" if message_txt else '')

    msg = _send_message(
        sender_user=request.user,
        recipient_user=other,
        text=message_txt,
        message_type='offer',
        status_obj=status_obj,
        offer=offer,
    )
    return _msg_response(msg)