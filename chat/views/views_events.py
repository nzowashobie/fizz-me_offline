"""
views_events.py — Zambian Events: create, invite, RSVP, guest list,
                  share event to status, and my-events endpoints.
"""

import json
import logging

import requests as req_lib

from django.contrib.auth.decorators import login_required
from django.core.files.base import ContentFile
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import (
    Contact, CustomUser, EventInvitee, EventStatusShare,
    StatusCategory, UserStatus, ZambianEvent,
)
from .helpers import _utc_iso, _get_file_url, _profile_pic

logger = logging.getLogger(__name__)


# ─── Helpers ───────────────────────────────────────────────────────────────

def _can_view_event(user, event):
    if event.host == user:
        return True
    if event.visibility == 'public':
        return True
    if event.visibility == 'contacts':
        return Contact.objects.filter(owner=event.host, contact_user=user).exists()
    if event.visibility == 'invite_only':
        return EventInvitee.objects.filter(event=event, user=user).exists()
    return False


def _serialize_event(event, role, request):
    return {
        "event_id":   event.id,
        "role":       role,
        "event_type": event.get_event_type_display(),
        "title":      event.title,
        "venue":      event.venue,
        "event_date": _utc_iso(event.event_date),
        "cover_photo": _get_file_url(event.cover_photo) or '',
        "visibility": event.visibility,
        "invite_url": request.build_absolute_uri(f"/events/invite/{event.invite_token}/"),
    }


# ─── Create ────────────────────────────────────────────────────────────────

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def create_event(request):
    from django.utils.dateparse import parse_datetime, parse_date
    from django.utils import timezone

    try:
        event_type     = request.POST.get('event_type', 'wedding').strip()
        title          = request.POST.get('title', '').strip()
        description    = request.POST.get('description', '').strip()
        venue          = request.POST.get('venue', '').strip()
        event_date     = request.POST.get('event_date', '').strip()
        visibility     = request.POST.get('visibility', 'invite_only').strip()
        dress_code     = request.POST.get('dress_code', '').strip()
        rsvp_str       = request.POST.get('rsvp_deadline', '').strip()
        bride_name     = request.POST.get('bride_name', '').strip()
        groom_name     = request.POST.get('groom_name', '').strip()
        family_contact = request.POST.get('family_contact', '').strip()
        family_phone   = request.POST.get('family_phone', '').strip()
        cover_photo    = request.FILES.get('cover_photo')

        if not title:
            return JsonResponse({"error": "title is required."}, status=400)
        if not event_date:
            return JsonResponse({"error": "event_date is required."}, status=400)

        parsed_date = parse_datetime(event_date)
        if parsed_date and timezone.is_naive(parsed_date):
            parsed_date = timezone.make_aware(parsed_date)

        rsvp_deadline = parse_date(rsvp_str) if rsvp_str else None

        valid_types = [c[0] for c in ZambianEvent.EVENT_TYPES]
        if event_type not in valid_types:
            event_type = 'other'

        valid_vis = [c[0] for c in ZambianEvent.VISIBILITY_CHOICES]
        if visibility not in valid_vis:
            visibility = 'invite_only'

        event = ZambianEvent.objects.create(
            host=request.user, event_type=event_type,
            title=title, description=description,
            venue=venue, event_date=parsed_date,
            visibility=visibility, dress_code=dress_code,
            rsvp_deadline=rsvp_deadline,
            bride_name=bride_name, groom_name=groom_name,
            family_contact=family_contact, family_phone=family_phone,
            cover_photo=cover_photo,
        )

        invite_url = request.build_absolute_uri(f"/events/invite/{event.invite_token}/")
        return JsonResponse({
            "status":       "success",
            "event_id":     event.id,
            "invite_url":   invite_url,
            "invite_token": str(event.invite_token),
            "cover_photo":  _get_file_url(event.cover_photo) or '',
            "message":      "Event created! Share the invite link with your guests.",
        }, status=201)

    except Exception as e:
        logger.error(f"create_event failed: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)


# ─── Invite / RSVP ────────────────────────────────────────────────────────

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def invite_to_event(request, event_id):
    event = get_object_or_404(ZambianEvent, id=event_id)
    if event.host != request.user:
        return JsonResponse({"error": "Only the event host can invite guests."}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    usernames = data.get('usernames', [])
    if not usernames:
        return JsonResponse({"error": "usernames list is required."}, status=400)

    added, already, not_found = [], [], []
    for uname in usernames:
        uname = uname.strip()
        try:
            target = CustomUser.objects.get(username__iexact=uname)
        except CustomUser.DoesNotExist:
            not_found.append(uname)
            continue
        _, created = EventInvitee.objects.get_or_create(event=event, user=target)
        (added if created else already).append(uname)

    return JsonResponse({"status": "success", "added": added, "already_invited": already, "not_found": not_found})


@login_required
def event_invite_view(request, invite_token):
    event = get_object_or_404(ZambianEvent, invite_token=invite_token)

    if event.visibility != 'public' and not _can_view_event(request.user, event):
        return JsonResponse({
            "error":       "You are not on the guest list for this event.",
            "event_title": event.title,
        }, status=403)

    rsvp_status = None
    try:
        rsvp_status = EventInvitee.objects.get(event=event, user=request.user).rsvp
    except EventInvitee.DoesNotExist:
        pass

    return JsonResponse({
        "event_id":      event.id,
        "event_type":    event.get_event_type_display(),
        "title":         event.title,
        "description":   event.description,
        "venue":         event.venue,
        "event_date":    _utc_iso(event.event_date),
        "dress_code":    event.dress_code,
        "rsvp_deadline": str(event.rsvp_deadline) if event.rsvp_deadline else None,
        "bride_name":    event.bride_name,
        "groom_name":    event.groom_name,
        "family_contact": event.family_contact,
        "family_phone":  event.family_phone,
        "host":          event.host.username,
        "cover_photo":   _get_file_url(event.cover_photo) or '',
        "visibility":    event.visibility,
        "your_rsvp":     rsvp_status,
        "invite_token":  str(event.invite_token),
    })


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def rsvp_event(request, event_id):
    event = get_object_or_404(ZambianEvent, id=event_id)
    if not _can_view_event(request.user, event):
        return JsonResponse({"error": "You are not on the guest list for this event."}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    rsvp        = data.get('rsvp', '').strip()
    valid_rsvps = ['accepted', 'declined', 'maybe']
    if rsvp not in valid_rsvps:
        return JsonResponse({"error": f"rsvp must be one of: {', '.join(valid_rsvps)}"}, status=400)

    invitee, _ = EventInvitee.objects.get_or_create(event=event, user=request.user)
    invitee.rsvp         = rsvp
    invitee.responded_at = now()
    invitee.save(update_fields=['rsvp', 'responded_at'])

    return JsonResponse({"status": "success", "rsvp": rsvp, "message": f"Your RSVP has been recorded as '{rsvp}'."})


# ─── List / guest list ────────────────────────────────────────────────────

@login_required
def get_my_events(request):
    hosting = ZambianEvent.objects.filter(host=request.user).order_by('-event_date')
    invited = ZambianEvent.objects.filter(
        invitees__user=request.user
    ).exclude(host=request.user).order_by('-event_date')

    return JsonResponse({
        "hosting": [_serialize_event(e, "host", request) for e in hosting],
        "invited": [_serialize_event(e, "invitee", request) for e in invited],
    })


@login_required
def my_events(request):
    events = ZambianEvent.objects.filter(host=request.user).order_by('-created_at')
    return JsonResponse({
        "events": [
            {
                "id":         e.id,
                "title":      e.title,
                "event_date": e.event_date.isoformat(),
                "cover_photo": _get_file_url(e.cover_photo),
                "invite_url": request.build_absolute_uri(f"/events/invite/{e.invite_token}/"),
                "visibility": e.visibility,
            }
            for e in events
        ]
    })


@login_required
def event_guest_list(request, event_id):
    event = get_object_or_404(ZambianEvent, id=event_id)
    if event.host != request.user:
        return JsonResponse({"error": "Only the host can view the guest list."}, status=403)

    invitees = EventInvitee.objects.filter(event=event).select_related('user')
    return JsonResponse({
        "event_id":      event.id,
        "title":         event.title,
        "total_invited": invitees.count(),
        "accepted":      invitees.filter(rsvp='accepted').count(),
        "declined":      invitees.filter(rsvp='declined').count(),
        "maybe":         invitees.filter(rsvp='maybe').count(),
        "pending":       invitees.filter(rsvp='pending').count(),
        "guests": [
            {
                "username":        inv.user.username,
                "profile_picture": _profile_pic(inv.user),
                "rsvp":            inv.rsvp,
                "invited_at":      _utc_iso(inv.invited_at),
                "responded_at":    _utc_iso(inv.responded_at) if inv.responded_at else None,
            }
            for inv in invitees
        ],
    })


# ─── Share event to status ─────────────────────────────────────────────────

@csrf_exempt
@login_required
def share_event_to_status(request, event_id):
    try:
        event = ZambianEvent.objects.get(id=event_id, host=request.user)
    except ZambianEvent.DoesNotExist:
        return JsonResponse({"error": "Event not found or no permission."}, status=404)

    if EventStatusShare.objects.filter(event=event).exists():
        return JsonResponse({"error": "Already shared to status."}, status=400)

    category, _ = StatusCategory.objects.get_or_create(name="Weddings")

    parts = [f"💍 {event.title}"]
    if event.bride_name and event.groom_name:
        parts.append(f"💕 {event.bride_name} & {event.groom_name}")
    if event.venue:
        parts.append(f"📍 {event.venue}")
    if event.event_date:
        parts.append(f"📅 {event.event_date.strftime('%B %d, %Y at %I:%M %p')}")
    if event.dress_code:
        parts.append(f"👗 {event.dress_code}")
    caption    = "\n".join(parts)[:255]
    invite_url = request.build_absolute_uri(f"/events/invite/{event.invite_token}/")

    # ── Media: cover photo or SVG fallback ────────────────────────────
    media_file = None
    cover_url  = _get_file_url(event.cover_photo) if event.cover_photo else None

    if cover_url:
        try:
            r = req_lib.get(cover_url, timeout=30)
            if r.status_code == 200:
                ct  = r.headers.get('content-type', 'image/jpeg').split(';')[0].strip()
                ext = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}.get(ct, 'jpg')
                media_file = ContentFile(r.content, name=f'event-{event.id}.{ext}')
        except Exception as e:
            logger.warning(f"Could not download cover photo: {e}")

    if media_file is None:
        def _x(s):
            return (s or '')[:50].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        formatted_date = event.event_date.strftime('%B %d, %Y') if event.event_date else ''
        svg_str = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">'
            '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">'
            '<stop offset="0%" style="stop-color:#880e4f"/>'
            '<stop offset="50%" style="stop-color:#c62828"/>'
            '<stop offset="100%" style="stop-color:#4a148c"/>'
            '</linearGradient></defs>'
            '<rect width="800" height="400" fill="url(#g)"/>'
            f'<text x="400" y="150" font-size="28" font-weight="bold" text-anchor="middle" fill="white">{_x(event.title)}</text>'
            f'<text x="400" y="210" font-size="20" text-anchor="middle" fill="rgba(255,255,255,0.85)">{_x(event.venue)}</text>'
            f'<text x="400" y="260" font-size="18" text-anchor="middle" fill="rgba(255,255,255,0.7)">{_x(formatted_date)}</text>'
            '</svg>'
        )
        media_file = ContentFile(svg_str.encode('utf-8'), name=f'event-{event.id}.svg')

    status = UserStatus.objects.create(
        user=request.user, category=category,
        media=media_file, caption=caption, market_link=invite_url,
    )
    EventStatusShare.objects.create(event=event, status=status, shared_by=request.user)

    return JsonResponse({
        "status":    "success",
        "message":   "Event shared to Weddings status for 24 hours!",
        "status_id": status.id,
        "media_url": _get_file_url(status.media) or '',
    })
