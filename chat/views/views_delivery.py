"""
views_delivery.py — Post-deal features:
  advance_delivery, get_delivery_status,
  submit_rating, get_seller_ratings,
  extend_listing, bump_listing.
"""

import json
import logging
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import Avg, Count
from django.http import JsonResponse, HttpResponse, Http404
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.http import FileResponse
import uuid
from django.shortcuts import render
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import Deal, DeliveryTracking, ListingBump, Message, SellerRating, UserStatus
from .helpers import _utc_iso

User   = get_user_model()
logger = logging.getLogger(__name__)

# ─── Stage constants ───────────────────────────────────────────────────────

_STAGE_ORDER = [
    'order_placed', 'seller_confirmed', 'in_transit',
    'delivered', 'payment_released',
]
_STAGE_ACTOR = {
    'seller_confirmed': 'seller',
    'in_transit':       'seller',
    'delivered':        'buyer',
    'payment_released': 'buyer',
    'disputed':         'both',
}
_STAGE_LABELS = {
    'seller_confirmed': '✅ Ready for collection — come and collect',
    'in_transit':       '🚚 Item is on its way',
    'delivered':        '📬 Buyer confirmed delivery',
    'payment_released': '💰 Collected — deal closed, payment released',
    'disputed':         '⚠️ A dispute has been raised. Resolve via chat.',
}
_MAX_FREE_BUMPS_PER_DAY = 1
_MAX_EXTENSIONS         = 3


# ─── Delivery / escrow ─────────────────────────────────────────────────────

_METHODS = {
    "collection": "Collect at the collection point",
    "delivery": "Seller delivers to the buyer",
}


def _stages_for(method):
    """Collection only: ready, then collected and closed."""
    return ["order_placed", "seller_confirmed", "payment_released"]


def _tracker_for(deal):
    """Get or create the tracker, and move older trackers onto the collection flow."""
    tracker, _ = DeliveryTracking.objects.get_or_create(
        deal=deal, defaults={"stage": "order_placed", "delivery_method": "collection"}
    )
    changed = []
    if tracker.delivery_method != "collection":
        tracker.delivery_method = "collection"
        changed.append("delivery_method")
    if tracker.stage == "in_transit":
        tracker.stage = "seller_confirmed"
        changed.append("stage")
    elif tracker.stage == "delivered":
        tracker.stage = "payment_released"
        changed.append("stage")
        if not tracker.payment_released_at:
            tracker.payment_released_at = now()
            changed.append("payment_released_at")
    if changed:
        tracker.save(update_fields=sorted(set(changed)))
    return tracker


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def advance_delivery(request):
    """
    POST: { "deal_id": 123, "stage": "in_transit", "notes": "..." }
    Stages run in order for the chosen method. Payment is already complete.
    """
    try:
        data = json.loads(request.body or b"{}")
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    deal_id = data.get("deal_id")
    new_stage = str(data.get("stage") or "").strip()
    notes = str(data.get("notes") or "").strip()[:500]

    if not deal_id or not new_stage:
        return JsonResponse({"error": "deal_id and stage are required"}, status=400)

    try:
        deal = Deal.objects.select_related("buyer", "seller", "status").get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)

    me = request.user
    if me not in (deal.buyer, deal.seller):
        return JsonResponse({"error": "Not a participant in this deal"}, status=403)
    if deal.state != "completed":
        return JsonResponse({"error": "Delivery starts once payment is complete"}, status=400)

    tracker = _tracker_for(deal)
    current = tracker.stage

    if new_stage == "disputed":
        if current == "payment_released":
            return JsonResponse({"error": "Cannot dispute a closed delivery"}, status=400)
    else:
        if not tracker.delivery_method:
            return JsonResponse(
                {"error": "The buyer must choose collection or delivery first"}, status=400)
        order = _stages_for(tracker.delivery_method)
        if new_stage not in order:
            return JsonResponse({"error": f"Unknown stage: {new_stage}"}, status=400)
        ci = order.index(current) if current in order else -1
        ni = order.index(new_stage)
        if ni != ci + 1:
            expected = order[ci + 1] if ci + 1 < len(order) else "none"
            return JsonResponse(
                {"error": f"Cannot jump from {current} to {new_stage}. Next expected: {expected}"},
                status=400,
            )

    allowed = _STAGE_ACTOR.get(new_stage, "both")
    if new_stage == "seller_confirmed" and not (deal.payment_proof or deal.payment_reference):
        return JsonResponse(
            {"error": "Check your mobile money first. The buyer has not sent a screenshot or reference yet."},
            status=400,
        )
    if new_stage == "payment_released" and me == deal.seller:
        ready_at = tracker.seller_confirmed_at
        if not ready_at or now() < ready_at + timedelta(hours=SELLER_CLOSE_HOURS):
            return JsonResponse(
                {"error": f"You can close this deal {SELLER_CLOSE_HOURS} hours after marking ready, if the buyer has not confirmed."},
                status=400,
            )
    else:
        if allowed == "seller" and me != deal.seller:
            return JsonResponse({"error": "Only the seller can mark this stage"}, status=403)
        if allowed == "buyer" and me != deal.buyer:
            return JsonResponse({"error": "Only the buyer can mark this stage"}, status=403)

    ts = now()
    with transaction.atomic():
        tracker.stage = new_stage
        if notes:
            tracker.notes = notes
        if new_stage == "seller_confirmed":
            tracker.seller_confirmed_at = ts
        elif new_stage == "in_transit":
            tracker.in_transit_at = ts
        elif new_stage == "delivered":
            tracker.delivered_at = ts
        elif new_stage == "payment_released":
            tracker.payment_released_at = ts
            SellerRating.objects.get_or_create(deal=deal)
            # Availability is already handled by quantity in the commerce views
        elif new_stage == "disputed":
            tracker.disputed_at = ts
        tracker.save()

        note_suffix = f' · "{notes}"' if notes else ""
        other = deal.seller if me == deal.buyer else deal.buyer
        Message.objects.create(
            sender=me, recipient=other,
            message=_STAGE_LABELS.get(new_stage, new_stage) + note_suffix,
            message_type="status_update", deal=deal, related_status=deal.status,
        )

    return JsonResponse({"status": "success", "stage": tracker.stage, "updated": _utc_iso(ts)})


@login_required
def deal_delivery_page(request, deal_id):
    """The delivery tracker as its own page, opened from the chat card."""
    try:
        deal = Deal.objects.select_related("buyer", "seller", "status").get(pk=deal_id)
    except Deal.DoesNotExist:
        raise Http404("Deal not found")
    if request.user not in (deal.buyer, deal.seller):
        return HttpResponse("Not a participant in this deal.", status=403)
    role = "buyer" if request.user == deal.buyer else "seller"
    return render(request, "deal_delivery.html", {"deal": deal, "role": role})


@login_required
def get_delivery_status(request):
    """GET /api/delivery/status/?deal_id=123"""
    deal_id = request.GET.get("deal_id", "").strip()
    if not deal_id.isdigit():
        return JsonResponse({"error": "deal_id required"}, status=400)
    try:
        deal = Deal.objects.select_related("buyer", "seller").get(pk=int(deal_id))
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)

    me = request.user
    if me not in (deal.buyer, deal.seller):
        return JsonResponse({"error": "Not a participant"}, status=403)
    if deal.state != "completed":
        return JsonResponse({"error": "Delivery starts once payment is complete"}, status=400)

    t = _tracker_for(deal)
    order = _stages_for(t.delivery_method)
    next_s = None
    if t.delivery_method and t.stage in order and order.index(t.stage) + 1 < len(order):
        next_s = order[order.index(t.stage) + 1]

    role = "buyer" if me == deal.buyer else "seller"
    can_close_at = None
    if role == "seller" and t.stage == "seller_confirmed" and t.seller_confirmed_at:
        can_close_at = _utc_iso(t.seller_confirmed_at + timedelta(hours=SELLER_CLOSE_HOURS))

    return JsonResponse({
        "deal_id":             deal.pk,
        "stage":               t.stage,
        "delivery_method":     t.delivery_method,
        "stages":              order,
        "notes":               t.notes,
        "seller_confirmed_at": _utc_iso(t.seller_confirmed_at) if t.seller_confirmed_at else None,
        "in_transit_at":       _utc_iso(t.in_transit_at)       if t.in_transit_at       else None,
        "delivered_at":        _utc_iso(t.delivered_at)        if t.delivered_at        else None,
        "payment_released_at": _utc_iso(t.payment_released_at) if t.payment_released_at else None,
        "disputed_at":         _utc_iso(t.disputed_at)         if t.disputed_at         else None,
        "next_stage":          next_s,
        "next_actor":          _STAGE_ACTOR.get(next_s, "") if next_s else "",
        "my_role":             role,
        "closed":              t.stage == "payment_released",
        "receipt_url":         f"/deals/{deal.pk}/receipt/",
        "amount":              str(deal.final_price),
        "buyer":               deal.buyer.username,
        "seller":              deal.seller.username,
        "payment_method":      deal.payment_method or "",
        "payment_reference":   deal.payment_reference or "",
        "has_proof":           bool(deal.payment_proof),
        "proof_url":           f"/deals/{deal.pk}/proof/" if deal.payment_proof else None,
        "seller_can_close_at": can_close_at,
    })


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def set_delivery_method(request):
    """POST: { "deal_id": 123, "method": "collection" | "delivery" } buyer only."""
    try:
        data = json.loads(request.body or b"{}")
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    deal_id = data.get("deal_id")
    method = str(data.get("method") or "").strip()
    if not deal_id or method not in _METHODS:
        return JsonResponse({"error": "deal_id and a valid method are required"}, status=400)

    try:
        deal = Deal.objects.select_related("buyer", "seller", "status").get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)
    if request.user != deal.buyer:
        return JsonResponse({"error": "Only the buyer chooses how the item is handed over"}, status=403)
    if deal.state != "completed":
        return JsonResponse({"error": "Delivery starts once payment is complete"}, status=400)

    tracker = _tracker_for(deal)
    if tracker.stage != "order_placed":
        return JsonResponse({"error": "The method is locked once the seller has acted"}, status=400)

    with transaction.atomic():
        tracker.delivery_method = method
        tracker.save(update_fields=["delivery_method"])
        Message.objects.create(
            sender=request.user, recipient=deal.seller,
            message=f"🚚 Buyer chose: {_METHODS[method]}",
            message_type="status_update", deal=deal, related_status=deal.status,
        )
    return JsonResponse({"status": "success", "delivery_method": method})


from django.views.decorators.cache import never_cache

@login_required
@never_cache
def deal_receipt(request, deal_id):
    """Printable receipt for a completed deal. Buyer and seller only."""
    from .views_commerce import _METHOD_LABELS

    try:
        deal = Deal.objects.select_related("buyer", "seller", "status").get(pk=deal_id)
    except Deal.DoesNotExist:
        raise Http404("Deal not found")
    if request.user not in (deal.buyer, deal.seller):
        return HttpResponse("Not a participant in this deal.", status=403)
    if deal.state != "completed":
        return HttpResponse("The receipt is available once payment is complete.", status=400)

    tracker = DeliveryTracking.objects.filter(deal=deal).first()
    method = tracker.delivery_method if tracker else ""
    return render(request, "deal_receipt.html", {
        "deal": deal,
        "tracker": tracker,
        "receipt_no": f"ASX-{deal.pk:06d}",
        "issued": now(),
        "closed": bool(tracker and tracker.stage in ("delivered", "payment_released")),
        "method_label": _METHODS.get(method, "Not chosen yet"),
        "payment_label": _METHOD_LABELS.get(deal.payment_method, deal.payment_method) or "—",
    })


# ─── Seller ratings ────────────────────────────────────────────────────────

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def submit_rating(request):
    """
    POST: { "deal_id": 123, "score": 5, "note": "Great seller!" }
    Only available after payment_released stage.
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    deal_id = data.get('deal_id')
    note    = str(data.get('note', '')).strip()[:200]
    try:
        score = int(data.get('score', 0))
    except (TypeError, ValueError):
        return JsonResponse({"error": "score must be an integer"}, status=400)

    if not deal_id:
        return JsonResponse({"error": "deal_id required"}, status=400)
    if not 1 <= score <= 5:
        return JsonResponse({"error": "score must be 1–5"}, status=400)

    try:
        deal = Deal.objects.select_related('buyer', 'seller').get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)

    me = request.user
    if me not in (deal.buyer, deal.seller):
        return JsonResponse({"error": "Not a participant"}, status=403)

    try:
        if deal.delivery_tracking.stage != 'payment_released':
            return JsonResponse({"error": "Ratings unlock after payment is released"}, status=400)
    except DeliveryTracking.DoesNotExist:
        return JsonResponse({"error": "Delivery tracking not started"}, status=400)

    rating, _ = SellerRating.objects.get_or_create(deal=deal)
    ts = now()

    if me == deal.buyer:
        if rating.seller_score is not None:
            return JsonResponse({"error": "Already rated this seller"}, status=409)
        rating.seller_score = score
        rating.seller_note  = note
        rating.seller_rated_at = ts
        rated_user = deal.seller
    else:
        if rating.buyer_score is not None:
            return JsonResponse({"error": "Already rated this buyer"}, status=409)
        rating.buyer_score = score
        rating.buyer_note  = note
        rating.buyer_rated_at = ts
        rated_user = deal.buyer

    rating.save()
    _update_rating_cache(rated_user)
    return JsonResponse({"status": "success", "score": score, "rated_user": rated_user.username})


@login_required
def get_seller_ratings(request):
    """GET /api/ratings/seller/?username=someone"""
    username = request.GET.get('username', '').strip()
    if not username:
        return JsonResponse({"error": "username required"}, status=400)
    try:
        seller = User.objects.get(username=username)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)

    agg = SellerRating.objects.filter(
        deal__seller=seller, seller_score__isnull=False
    ).aggregate(avg=Avg('seller_score'), total=Count('id'))

    dist_rows = (
        SellerRating.objects
        .filter(deal__seller=seller, seller_score__isnull=False)
        .values('seller_score').annotate(n=Count('id'))
    )
    dist = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    for r in dist_rows:
        dist[r['seller_score']] = r['n']

    reviews = [
        {
            "buyer":    r.deal.buyer.username,
            "score":    r.seller_score,
            "note":     r.seller_note or '',
            "rated_at": _utc_iso(r.seller_rated_at) if r.seller_rated_at else None,
        }
        for r in (
            SellerRating.objects
            .filter(deal__seller=seller, seller_score__isnull=False)
            .select_related('deal__buyer')
            .order_by('-seller_rated_at')[:10]
        )
    ]

    return JsonResponse({
        "username":      seller.username,
        "avg_score":     round(agg['avg'], 1) if agg['avg'] else None,
        "total_ratings": agg['total'] or 0,
        "star_counts":   dist,
        "reviews":       reviews,
    })


def _update_rating_cache(user):
    try:
        agg = SellerRating.objects.filter(
            deal__seller=user, seller_score__isnull=False
        ).aggregate(avg=Avg('seller_score'))
        if agg['avg'] and hasattr(user.profile, 'avg_rating'):
            user.profile.avg_rating = round(agg['avg'], 2)
            user.profile.save(update_fields=['avg_rating'])
    except Exception:
        pass


# ─── Listing extension and bumping ─────────────────────────────────────────

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def extend_listing(request):
    """
    Extend a listing by 24 h. Free up to _MAX_EXTENSIONS times per listing.
    POST: { "status_id": 123 }
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    status_id = data.get('status_id')
    if not status_id:
        return JsonResponse({"error": "status_id required"}, status=400)

    try:
        status = UserStatus.objects.get(pk=status_id, user=request.user)
    except UserStatus.DoesNotExist:
        return JsonResponse({"error": "Listing not found or not yours"}, status=404)

    if status.availability == 'sold':
        return JsonResponse({"error": "Cannot extend a sold listing"}, status=400)

    ext_count = ListingBump.objects.filter(status=status, bump_type='extend').count()
    if ext_count >= _MAX_EXTENSIONS:
        return JsonResponse(
            {"error": f"Maximum {_MAX_EXTENSIONS} extensions reached. Delete and repost."},
            status=400,
        )

    with transaction.atomic():
        current_expiry = getattr(status, 'expires_at', None) or (
            status.created_at + timedelta(hours=24)
        )
        new_expiry = max(current_expiry, now()) + timedelta(hours=24)
        if hasattr(status, 'expires_at'):
            status.expires_at = new_expiry
            status.save(update_fields=['expires_at'])
        ListingBump.objects.create(status=status, user=request.user, bump_type='extend')

    return JsonResponse({
        "status":       "success",
        "expires_at":   _utc_iso(new_expiry),
        "extends_used": ext_count + 1,
        "extends_left": _MAX_EXTENSIONS - (ext_count + 1),
    })


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def bump_listing(request):
    """
    Move a listing to the top of the Market feed. Free once per day per user.
    POST: { "status_id": 123 }
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    status_id = data.get('status_id')
    if not status_id:
        return JsonResponse({"error": "status_id required"}, status=400)

    try:
        status = UserStatus.objects.get(pk=status_id, user=request.user)
    except UserStatus.DoesNotExist:
        return JsonResponse({"error": "Listing not found or not yours"}, status=404)

    if status.availability == 'sold':
        return JsonResponse({"error": "Cannot bump a sold listing"}, status=400)

    today_start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    if ListingBump.objects.filter(
        user=request.user, bump_type='bump', created_at__gte=today_start
    ).count() >= _MAX_FREE_BUMPS_PER_DAY:
        return JsonResponse({
            "error":        "Daily free bump used. Come back tomorrow!",
            "next_bump_at": _utc_iso(today_start + timedelta(days=1)),
        }, status=429)

    ts = now()
    with transaction.atomic():
        if hasattr(status, 'bumped_at'):
            status.bumped_at  = ts
            status.bump_count = (getattr(status, 'bump_count', 0) or 0) + 1
            status.save(update_fields=['bumped_at', 'bump_count'])
        ListingBump.objects.create(status=status, user=request.user, bump_type='bump')

    return JsonResponse({
        "status":     "success",
        "bumped_at":  _utc_iso(ts),
        "bump_count": getattr(status, 'bump_count', 1),
    })


# ─── Payment proof ─────────────────────────────────────────────────────────

SELLER_CLOSE_HOURS = 24
PROOF_MAX_BYTES = 5 * 1024 * 1024
_PROOF_DIR = "payment_proofs"


def _proof_storage():
    return FileSystemStorage(location=str(settings.MEDIA_ROOT))


def _image_ext(head):
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


@login_required
@require_http_methods(["POST"])
def upload_payment_proof(request):
    """
    Buyer sends a screenshot and/or the reference number before paying.
    POST multipart: deal_id, reference (optional), proof (optional image).
    """
    deal_id = (request.POST.get("deal_id") or "").strip()
    reference = (request.POST.get("reference") or "").strip()[:60]
    upload = request.FILES.get("proof")

    if not deal_id.isdigit():
        return JsonResponse({"error": "deal_id is required"}, status=400)
    if not reference and not upload:
        return JsonResponse({"error": "Add the reference number or a screenshot."}, status=400)
    try:
        deal = Deal.objects.select_related("buyer", "seller", "status").get(pk=int(deal_id))
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)
    if request.user != deal.buyer:
        return JsonResponse({"error": "Only the buyer sends payment proof"}, status=403)
    if deal.state != "confirmed":
        return JsonResponse({"error": "Payment proof is sent before you pay"}, status=400)

    storage = _proof_storage()
    new_name = None
    if upload:
        if upload.size > PROOF_MAX_BYTES:
            return JsonResponse({"error": "Screenshot is too large (max 5 MB)."}, status=400)
        head = upload.read(16)
        upload.seek(0)
        ext = _image_ext(head)
        if not ext:
            return JsonResponse({"error": "Send a JPG, PNG or WEBP screenshot."}, status=400)
        new_name = storage.save(f"{_PROOF_DIR}/deal_{deal.pk}_{uuid.uuid4().hex}.{ext}", upload)

    old_name = deal.payment_proof
    with transaction.atomic():
        if new_name:
            deal.payment_proof = new_name
        if reference:
            deal.payment_reference = reference
        deal.payment_proof_at = now()
        deal.save(update_fields=["payment_proof", "payment_reference", "payment_proof_at"])
        Message.objects.create(
            sender=request.user, recipient=deal.seller,
            message="🧾 Payment proof sent. Open Track delivery to review and accept" + (f" · Ref: {reference}" if reference else ""),
            message_type="status_update", deal=deal, related_status=deal.status,
        )
    if new_name and old_name:
        storage.delete(old_name)
    return JsonResponse({
        "status": "success",
        "reference": deal.payment_reference,
        "has_proof": bool(deal.payment_proof),
    })


@login_required
def payment_proof_file(request, deal_id):
    """Serves the screenshot to the buyer and seller of that deal only."""
    try:
        deal = Deal.objects.select_related("buyer", "seller").get(pk=deal_id)
    except Deal.DoesNotExist:
        raise Http404("Not found")
    if request.user not in (deal.buyer, deal.seller):
        return HttpResponse("Not a participant in this deal.", status=403)
    storage = _proof_storage()
    if not deal.payment_proof or not storage.exists(deal.payment_proof):
        raise Http404("No screenshot")
    name = deal.payment_proof.lower()
    ctype = "image/png" if name.endswith(".png") else "image/webp" if name.endswith(".webp") else "image/jpeg"
    resp = FileResponse(storage.open(deal.payment_proof, "rb"), content_type=ctype)
    resp["Cache-Control"] = "private, no-store"
    resp["X-Content-Type-Options"] = "nosniff"
    return resp
