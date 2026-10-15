import json

from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render
from django.utils.dateparse import parse_datetime
from django.utils.html import strip_tags
from django.views.decorators.http import require_POST

from .models import SharedVideo, VideoEmbed
from .video_links import extract_video_embeds

PAGE_SIZE = 20
POLL_LIMIT = 50
SEEN_KEY = "videos_seen_id"


def _int_param(request, name):
    value = request.GET.get(name, "")
    return int(value) if value.isdigit() else None


# ── Chat-shared videos (older feed endpoint, kept for compatibility) ──────

def _serialize(v):
    return {
        "id": v.id,
        "provider": v.provider,
        "source_url": v.source_url,
        "embed_url": v.embed_url,
        "sender": v.message.sender.username,
        "created_at": v.created_at.isoformat(),
    }


@login_required
def video_feed(request):
    user = request.user
    qs = (VideoEmbed.objects
          .filter(Q(message__sender=user) | Q(message__recipient=user))
          .select_related("message__sender"))
    since = _int_param(request, "since")
    before = _int_param(request, "before")
    if since is not None:
        items = list(qs.filter(id__gt=since).order_by("id")[:POLL_LIMIT])
    else:
        if before is not None:
            qs = qs.filter(id__lt=before)
        items = list(qs.order_by("-id")[:PAGE_SIZE])
    return JsonResponse({"items": [_serialize(v) for v in items]})


# ── Videos page: one feed of pasted links and chat-shared videos ──────────

def _shared_json(v):
    return {
        "key": f"s{v.id}",
        "source": "shared",
        "id": v.id,
        "provider": v.provider,
        "source_url": v.source_url,
        "embed_url": v.embed_url,
        "note": v.note,
        "sender": "",
        "created_at": v.created_at.isoformat(),
    }


def _chat_json(v):
    return {
        "key": f"c{v.id}",
        "source": "chat",
        "id": v.id,
        "provider": v.provider,
        "source_url": v.source_url,
        "embed_url": v.embed_url,
        "note": "",
        "sender": v.message.sender.username,
        "created_at": v.created_at.isoformat(),
    }


@login_required
def videos_page(request):
    # Opening the page marks every chat video received so far as seen.
    newest = (VideoEmbed.objects
              .filter(message__recipient=request.user)
              .order_by("-id")
              .values_list("id", flat=True)
              .first()) or 0
    request.session[SEEN_KEY] = newest
    return render(request, "videos.html")


@login_required
def videos_unseen(request):
    seen = request.session.get(SEEN_KEY, 0)
    count = (VideoEmbed.objects
             .filter(message__recipient=request.user, id__gt=seen)
             .count())
    return JsonResponse({"count": count})


@login_required
def videos_list(request):
    # ?before=<created_at of the oldest card> returns the next older page.
    before = request.GET.get("before", "")
    shared = SharedVideo.objects.filter(user=request.user)
    chat = (VideoEmbed.objects
            .filter(Q(message__sender=request.user) | Q(message__recipient=request.user))
            .select_related("message__sender"))
    if before:
        cutoff = parse_datetime(before)
        if cutoff is None:
            return JsonResponse({"error": "Bad page cursor."}, status=400)
        shared = shared.filter(created_at__lt=cutoff)
        chat = chat.filter(created_at__lt=cutoff)

    rows = [(v.created_at, _shared_json(v)) for v in shared.order_by("-created_at")[:PAGE_SIZE]]
    rows += [(v.created_at, _chat_json(v)) for v in chat.order_by("-created_at")[:PAGE_SIZE]]
    rows.sort(key=lambda r: r[0], reverse=True)
    return JsonResponse({"items": [r[1] for r in rows[:PAGE_SIZE]]})


@login_required
@require_POST
def videos_add(request):
    try:
        body = json.loads(request.body or b"{}")
    except (ValueError, AttributeError):
        return JsonResponse({"error": "Something went wrong. Paste the link again."}, status=400)
    if not isinstance(body, dict):
        body = {}

    url = (body.get("url") or "").strip()
    note = strip_tags(str(body.get("note") or "")).strip()[:500]

    if not url:
        return JsonResponse({"error": "Paste a video link first."}, status=400)

    found = extract_video_embeds(url)
    if not found:
        return JsonResponse(
            {"error": "This link isn't supported yet. Try a TikTok, Facebook, Instagram or YouTube video link."},
            status=400,
        )

    item = found[0]
    existing = SharedVideo.objects.filter(user=request.user, source_url=item["source_url"]).first()
    if existing:
        return JsonResponse({"item": _shared_json(existing), "duplicate": True})

    video = SharedVideo.objects.create(user=request.user, note=note, **item)
    return JsonResponse({"item": _shared_json(video)})
