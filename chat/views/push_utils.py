"""
push_utils.py — Web Push sending helper.

Kept isolated from views_messages.py on purpose: send_push_notification()
NEVER raises — any failure (expired subscription, network error, bad keys)
is caught and logged, so a push failure can never break the actual message
send it's attached to. Expired/gone subscriptions (410/404 from the push
service) are auto-deleted so they stop being retried forever.
"""

import json
import logging

from django.conf import settings
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)


def _vapid_private_key_pem():
    path = getattr(settings, 'VAPID_PRIVATE_KEY_PATH', None)
    if not path:
        return None
    try:
        with open(path, 'r') as f:
            return f.read()
    except Exception as e:
        logger.error(f"Could not read VAPID private key at {path}: {e}")
        return None


def send_push_notification(user, title, body, url='/', tag=None):
    """
    Sends a push notification to every subscribed device for `user`.
    Safe to call from anywhere (e.g. after saving a Message) — it will
    never raise, and does nothing if the user has no subscriptions or
    VAPID isn't configured yet.
    """
    from .models import PushSubscription  # local import avoids circulars

    private_key = _vapid_private_key_pem()
    public_key  = getattr(settings, 'VAPID_PUBLIC_KEY', None)
    claim_email = getattr(settings, 'VAPID_CLAIM_EMAIL', None)

    if not (private_key and public_key and claim_email):
        logger.debug("send_push_notification: VAPID not configured, skipping.")
        return

    subs = PushSubscription.objects.filter(user=user)
    if not subs.exists():
        return

    payload = json.dumps({
        "title": title,
        "body":  body,
        "url":   url,
        "tag":   tag or "",
    })

    vapid_claims = {"sub": claim_email}

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=private_key,
                vapid_claims=dict(vapid_claims),
            )
        except WebPushException as e:
            status = getattr(e.response, 'status_code', None)
            if status in (404, 410):
                # Subscription is gone (browser unsubscribed / uninstalled) — clean it up.
                sub.delete()
                logger.info(f"Removed stale push subscription for {user.username} (status {status}).")
            else:
                logger.warning(f"Push send failed for {user.username}: {e}")
        except Exception as e:
            logger.warning(f"Unexpected push error for {user.username}: {e}")
