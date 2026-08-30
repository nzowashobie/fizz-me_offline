"""
views_push.py — Web Push subscription management.
New, self-contained module — follows the same pattern as your other
views_*.py files (views_attachments.py, views_misc.py, etc).
"""

import json
import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..models import PushSubscription

logger = logging.getLogger(__name__)


@csrf_exempt
@login_required
def save_push_subscription(request):
    """
    Body: { endpoint, keys: { p256dh, auth } }
    Called by pwa-bridge.js right after PushManager.subscribe() succeeds.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        data     = json.loads(request.body)
        endpoint = data.get("endpoint")
        keys     = data.get("keys") or {}
        p256dh   = keys.get("p256dh")
        auth     = keys.get("auth")

        if not (endpoint and p256dh and auth):
            return JsonResponse({"error": "Missing endpoint/keys."}, status=400)

        PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                "user":       request.user,
                "p256dh":     p256dh,
                "auth":       auth,
                "user_agent": (request.META.get("HTTP_USER_AGENT") or "")[:255],
            },
        )
        return JsonResponse({"status": "success"})
    except Exception as e:
        logger.error(f"save_push_subscription failed: {e}", exc_info=True)
        return JsonResponse({"error": "Could not save subscription."}, status=500)


@csrf_exempt
@login_required
def delete_push_subscription(request):
    """Body: { endpoint }. Called on unsubscribe / notification-permission revoke."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        data     = json.loads(request.body)
        endpoint = data.get("endpoint")
        if not endpoint:
            return JsonResponse({"error": "Missing endpoint."}, status=400)
        PushSubscription.objects.filter(endpoint=endpoint, user=request.user).delete()
        return JsonResponse({"status": "success"})
    except Exception as e:
        logger.error(f"delete_push_subscription failed: {e}", exc_info=True)
        return JsonResponse({"error": "Could not remove subscription."}, status=500)
