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
from django.http import JsonResponse
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
    'seller_confirmed': '✅ Seller confirmed the item is ready',
    'in_transit':       '🚚 Item is on its way',
    'delivered':        '📬 Buyer confirmed delivery',
    'payment_released': '💰 Payment released — deal closed!',
    'disputed':         '⚠️ A dispute has been raised. Resolve via chat.',
}
_MAX_FREE_BUMPS_PER_DAY = 1
_MAX_EXTENSIONS         = 3


# ─── Delivery / escrow ─────────────────────────────────────────────────────

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def advance_delivery(request):
    """
    Advance the delivery stage for a completed deal.
    POST: { "deal_id": 123, "stage": "in_transit", "notes": "..." }
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    deal_id   = data.get('deal_id')
    new_stage = data.get('stage', '').strip()
    notes     = str(data.get('notes', '')).strip()[:500]

    if not deal_id or not new_stage:
        return JsonResponse({"error": "deal_id and stage are required"}, status=400)

    try:
        deal = Deal.objects.select_related('buyer', 'seller', 'status').get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)

    me = request.user
    if me not in (deal.buyer, deal.seller):
        return JsonResponse({"error": "Not a participant in this deal"}, status=403)

    tracker, _ = DeliveryTracking.objects.get_or_create(
        deal=deal, defaults={'stage': 'order_placed'}
    )
    current = tracker.stage

    # Validate forward-only transitions (disputed is always allowed unless closed)
    if new_stage == 'disputed':
        if current == 'payment_released':
            return JsonResponse({"error": "Cannot dispute a closed delivery"}, status=400)
    elif new_stage in _STAGE_ORDER:
        ci = _STAGE_ORDER.index(current) if current in _STAGE_ORDER else -1
        ni = _STAGE_ORDER.index(new_stage)
        if ni != ci + 1:
            expected = _STAGE_ORDER[ci + 1] if ci + 1 < len(_STAGE_ORDER) else 'none'
            return JsonResponse({
                "error": f"Cannot jump from {current} to {new_stage}. Next expected: {expected}"
            }, status=400)
    else:
        return JsonResponse({"error": f"Unknown stage: {new_stage}"}, status=400)

    allowed = _STAGE_ACTOR.get(new_stage, 'both')
    if allowed == 'seller' and me != deal.seller:
        return JsonResponse({"error": "Only the seller can mark this stage"}, status=403)
    if allowed == 'buyer' and me != deal.buyer:
        return JsonResponse({"error": "Only the buyer can mark this stage"}, status=403)

    ts = now()
    with transaction.atomic():
        tracker.stage = new_stage
        if notes:
            tracker.notes = notes
        if new_stage == 'seller_confirmed':   tracker.seller_confirmed_at  = ts
        elif new_stage == 'in_transit':       tracker.in_transit_at        = ts
        elif new_stage == 'delivered':        tracker.delivered_at         = ts
        elif new_stage == 'payment_released':
            tracker.payment_released_at = ts
            SellerRating.objects.get_or_create(deal=deal)
        elif new_stage == 'disputed':         tracker.disputed_at          = ts
        tracker.save()

        note_suffix = f' · "{notes}"' if notes else ''
        other       = deal.seller if me == deal.buyer else deal.buyer
        Message.objects.create(
            sender=me, recipient=other,
            message=_STAGE_LABELS.get(new_stage, new_stage) + note_suffix,
            message_type='status_update', deal=deal, related_status=deal.status,
        )

    return JsonResponse({"status": "success", "stage": tracker.stage, "updated": _utc_iso(ts)})


@login_required
def get_delivery_status(request):
    """GET /api/delivery/status/?deal_id=123"""
    deal_id = request.GET.get('deal_id', '').strip()
    if not deal_id:
        return JsonResponse({"error": "deal_id required"}, status=400)

    try:
        deal = Deal.objects.get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)

    if request.user not in (deal.buyer, deal.seller):
        return JsonResponse({"error": "Not a participant"}, status=403)

    try:
        t = deal.delivery_tracking
    except DeliveryTracking.DoesNotExist:
        return JsonResponse({"error": "No tracking info yet"}, status=404)

    ci     = _STAGE_ORDER.index(t.stage) if t.stage in _STAGE_ORDER else -1
    next_s = _STAGE_ORDER[ci + 1] if ci + 1 < len(_STAGE_ORDER) else None

    return JsonResponse({
        "deal_id":             deal.pk,
        "stage":               t.stage,
        "notes":               t.notes,
        "seller_confirmed_at": _utc_iso(t.seller_confirmed_at) if t.seller_confirmed_at else None,
        "in_transit_at":       _utc_iso(t.in_transit_at)       if t.in_transit_at       else None,
        "delivered_at":        _utc_iso(t.delivered_at)        if t.delivered_at        else None,
        "payment_released_at": _utc_iso(t.payment_released_at) if t.payment_released_at else None,
        "disputed_at":         _utc_iso(t.disputed_at)         if t.disputed_at         else None,
        "next_stage":          next_s,
        "next_actor":          _STAGE_ACTOR.get(next_s, '') if next_s else '',
        "my_role":             "buyer" if request.user == deal.buyer else "seller",
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
