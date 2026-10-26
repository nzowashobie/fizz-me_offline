"""fcm.py — sends push notifications to the Android app through Firebase (HTTP v1 API)."""
import logging

import firebase_admin
from firebase_admin import credentials, messaging
from django.conf import settings

from .models import FCMDevice

log = logging.getLogger(__name__)


def _init():
    try:
        firebase_admin.get_app()
        return
    except ValueError:
        pass
    try:
        firebase_admin.initialize_app(credentials.Certificate(settings.FIREBASE_CREDENTIALS))
    except ValueError:
        pass


def send_fcm_to_user(user, title, body, url='/'):
    _init()
    sent = 0
    for dev in FCMDevice.objects.filter(user=user):
        msg = messaging.Message(
            data={'title': str(title), 'body': str(body), 'url': str(url)},
            token=dev.token,
            android=messaging.AndroidConfig(
                priority='high',  # 👈 CRITICAL: Forces the phone to wake up
                ttl=2419200       # 28 days in seconds
            ),
        )
        try:
            messaging.send(msg)
            sent += 1
        except Exception as exc:
            s = str(exc).lower()
            is_dead = (
                'unregistered' in s
                or 'requested entity was not found' in s
                or 'senderidmismatch' in s
                or 'sender id mismatch' in s
                or 'does not match' in s
            )
            if is_dead:
                try:
                    dev.delete()
                    log.info('Removed dead FCM token for %s', user.username)
                except Exception:
                    pass
            else:
                log.exception('FCM send failed for %s', user.username)
    return sent