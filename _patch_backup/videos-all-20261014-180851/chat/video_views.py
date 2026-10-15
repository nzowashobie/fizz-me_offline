from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse

from .models import VideoEmbed

PAGE_SIZE = 20
POLL_LIMIT = 50


def _int_param(request, name):
    value = request.GET.get(name, '')
    return int(value) if value.isdigit() else None


def _serialize(v):
    return {
        'id': v.id,
        'provider': v.provider,
        'source_url': v.source_url,
        'embed_url': v.embed_url,
        'sender': v.message.sender.username,
        'created_at': v.created_at.isoformat(),
    }


@login_required
def video_feed(request):
    user = request.user
    qs = (VideoEmbed.objects
          .filter(Q(message__sender=user) | Q(message__recipient=user))
          .select_related('message__sender'))

    since = _int_param(request, 'since')
    before = _int_param(request, 'before')

    if since is not None:
        items = list(qs.filter(id__gt=since).order_by('id')[:POLL_LIMIT])
    else:
        if before is not None:
            qs = qs.filter(id__lt=before)
        items = list(qs.order_by('-id')[:PAGE_SIZE])

    return JsonResponse({'items': [_serialize(v) for v in items]})
