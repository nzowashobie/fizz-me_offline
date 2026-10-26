"""
views_events.py — Zambian Events: create, invite, RSVP, guest list,
                  share event to status, and my-events endpoints.
"""

import json
import logging

import requests as req_lib
import cloudinary.uploader

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
    from django.shortcuts import render
    event = get_object_or_404(ZambianEvent, invite_token=invite_token)

    # If they have the exact invite link, they are effectively invited.
    # Automatically add them to the guest list if it's invite-only.
    if event.visibility == 'invite_only' and request.user != event.host:
        EventInvitee.objects.get_or_create(event=event, user=request.user)
    
    # For other restricted visibilities, check if they are allowed
    elif event.visibility != 'public' and not _can_view_event(request.user, event):
        return render(request, "invite_blocked.html", {
            "event_title": event.title,
            "event_type": event.get_event_type_display(),
        }, status=403)

    rsvp_status = None
    try:
        rsvp_status = EventInvitee.objects.get(event=event, user=request.user).rsvp
    except EventInvitee.DoesNotExist:
        pass

    event_date_fmt = event.event_date.strftime('%A, %B %d, %Y at %I:%M %p') if event.event_date else ''
    rsvp_deadline_fmt = event.rsvp_deadline.strftime('%B %d, %Y') if event.rsvp_deadline else ''

    return render(request, "event_invite.html", {
        "event": event,
        "event_date_fmt": event_date_fmt,
        "rsvp_deadline_fmt": rsvp_deadline_fmt,
        "cover_photo": _get_file_url(event.cover_photo) or '',
        "your_rsvp": rsvp_status,
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
    
    # Enforce single RSVP
    if invitee.rsvp != 'pending':
        return JsonResponse({"error": "You have already responded to this invitation."}, status=403)

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
    result = []
    for e in events:
        try:
            cover = _get_file_url(e.cover_photo) if e.cover_photo else ''
        except Exception:
            cover = ''
            
        result.append({
            "id":         e.id,
            "title":      e.title,
            "event_date": e.event_date.isoformat() if e.event_date else '',
            "cover_photo": cover,
            "invite_url": request.build_absolute_uri(f"/events/invite/{e.invite_token}/"),
            "visibility": e.visibility,
        })
    return JsonResponse({"events": result})


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

    try:
        from PIL import Image, ImageDraw, ImageFont
        import io
        import re

        W, H = 1080, 1920
        img = Image.new('RGB', (W, H), '#1a0b12')
        draw = ImageDraw.Draw(img)

        # Background image
        if event.cover_photo:
            try:
                cover_url = _get_file_url(event.cover_photo)
                if cover_url:
                    r = req_lib.get(cover_url, timeout=10)
                    if r.status_code == 200:
                        cover = Image.open(io.BytesIO(r.content)).convert('RGB')
                        ratio = max(W / cover.width, H / cover.height)
                        new_size = (int(cover.width * ratio), int(cover.height * ratio))
                        cover = cover.resize(new_size, Image.Resampling.LANCZOS)
                        left = (cover.width - W) / 2
                        top = (cover.height - H) / 2
                        cover = cover.crop((left, top, left + W, top + H))
                        img.paste(cover, (0, 0))
            except Exception as e:
                logger.warning(f"Could not load cover image: {e}")

        # Gradient overlay
        overlay = Image.new('RGBA', (W, H), (0,0,0,0))
        odraw = ImageDraw.Draw(overlay)
        for y in range(H):
            alpha = int(20 + (200 * (y / H)))
            odraw.line([(0, y), (W, y)], fill=(0, 0, 0, alpha))
        
        img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
        draw = ImageDraw.Draw(img)

        # Fonts
        def get_font(size, bold=False):
            fonts = ["arial.ttf", "Arial.ttf", "DejaVuSans.ttf", "Helvetica.ttf"]
            if bold:
                fonts = ["arialbd.ttf", "Arialbd.ttf", "DejaVuSans-Bold.ttf"] + fonts
            for name in fonts:
                try:
                    return ImageFont.truetype(name, size)
                except IOError:
                    continue
            return ImageFont.load_default()

        font_badge = get_font(30, bold=True)
        font_title = get_font(64, bold=True)
        font_names = get_font(40)
        font_details = get_font(34)
        font_footer = get_font(28)

        WHITE = (255, 255, 255)
        GOLD = (230, 168, 23)
        BLACK = (0, 0, 0)

        def draw_centered(text, y, font, color):
            # Safely ignore non-ASCII characters (emojis) for Pillow
            text = text.encode('ascii', 'ignore').decode('ascii')
            if not text:
                return
            bbox = draw.textbbox((0, 0), text, font=font)
            tw = bbox[2] - bbox[0]
            draw.text(((W - tw) / 2, y), text, font=font, fill=color)

        # Badge
        badge_text = event.get_event_type_display()
        badge_text = badge_text.encode('ascii', 'ignore').decode('ascii').strip()
        bbox = draw.textbbox((0, 0), badge_text, font=font_badge)
        bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        bx = (W - bw) / 2
        by = 200
        draw.rounded_rectangle([bx - 30, by - 15, bx + bw + 30, by + bh + 15], radius=30, fill=GOLD)
        draw.text((bx, by), badge_text, font=font_badge, fill=BLACK)

        # Title & Names
        draw_centered(event.title, 320, font_title, WHITE)
        
        if event.bride_name and event.groom_name:
            draw_centered(f"{event.bride_name} & {event.groom_name}", 400, font_names, GOLD)

        # Details
        y_details = 1200
        if event.event_date:
            draw_centered(f"Date: {event.event_date.strftime('%B %d, %Y at %I:%M %p')}", y_details, font_details, WHITE)
            y_details += 60
        if event.venue:
            draw_centered(f"Venue: {event.venue}", y_details, font_details, WHITE)
            y_details += 60
        if event.dress_code:
            draw_centered(f"Dress Code: {event.dress_code}", y_details, font_details, WHITE)
            y_details += 60

        # Footer
        draw_centered("Tap to view invitation & RSVP", H - 150, font_footer, GOLD)

        # Upload
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)

        upload_res = cloudinary.uploader.upload(
            buffer, 
            resource_type='image', 
            folder='statuses',
            format='png'
        )
        public_id = upload_res.get('public_id')
        
        if not public_id:
            return JsonResponse({"error": "Cloudinary did not return a public_id."}, status=500)

    except Exception as e:
        logger.error(f"Pillow generation or upload failed: {e}", exc_info=True)
        return JsonResponse({"error": f"Failed to generate status image: {str(e)}"}, status=500)

    status = UserStatus.objects.create(
        user=request.user, category=category,
        media=public_id, caption=caption, market_link=invite_url,
    )
    EventStatusShare.objects.create(event=event, status=status, shared_by=request.user)

    return JsonResponse({
        "status":    "success",
        "message":   "Event shared to Weddings status for 24 hours!",
        "status_id": status.id,
        "media_url": _get_file_url(status.media) or '',
    })
