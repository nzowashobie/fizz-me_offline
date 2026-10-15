import json

from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from .models import SharedVideo, VideoEmbed
from .video_links import extract_video_embeds

PAGE_SIZE = 20
POLL_LIMIT = 50
SEEN_KEY = "videos_seen_id"


def _int_param(request, name):
    value = request.GET.get(name, "")
    return int(value) if value.isdigit() else None


# ── Chat-shared videos (feed used by videos.js) ───────────────────────────

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


# ── Videos page: paste a link, keep a list, count unseen ──────────────────

def _shared_json(v):
    return {
        "id": v.id,
        "provider": v.provider,
        "source_url": v.source_url,
        "embed_url": v.embed_url,
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
    qs = SharedVideo.objects.filter(user=request.user)
    before = _int_param(request, "before")
    if before is not None:
        qs = qs.filter(id__lt=before)
    items = list(qs.order_by("-id")[:PAGE_SIZE])
    return JsonResponse({"items": [_shared_json(v) for v in items]})


@login_required
@require_POST
def videos_add(request):
    try:
        url = (json.loads(request.body or b"{}").get("url") or "").strip()
    except (ValueError, AttributeError):
        return JsonResponse({"error": "Something went wrong. Paste the link again."}, status=400)

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

    video = SharedVideo.objects.create(user=request.user, **item)
    return JsonResponse({"item": _shared_json(video)})
