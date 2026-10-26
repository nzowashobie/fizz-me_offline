"""views_fcm.py — FCM device registration endpoints."""
import json
import logging

from django.http import JsonResponse
from django.views.decorators.http import require_POST

from ..models import FCMDevice

logger = logging.getLogger(__name__)


def _token_from(request):
    try:
        return (json.loads(request.body).get('token') or '').strip()
    except (ValueError, AttributeError):
        return ''


@require_POST
def fcm_register(request):
    if not request.user.is_authenticated:
        return JsonResponse({'ok': False}, status=401)
    token = _token_from(request)
    if not token:
        return JsonResponse({'ok': False, 'error': 'missing token'}, status=400)
    FCMDevice.objects.update_or_create(token=token, defaults={'user': request.user})
    return JsonResponse({'ok': True})


@require_POST
def fcm_unregister(request):
    if not request.user.is_authenticated:
        return JsonResponse({'ok': False}, status=401)
    token = _token_from(request)
    FCMDevice.objects.filter(token=token, user=request.user).delete()
    return JsonResponse({'ok': True})