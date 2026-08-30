"""
context_processors.py — makes settings.VAPID_PUBLIC_KEY available in every
template as VAPID_PUBLIC_KEY_JS, so pwa_scripts.html can inject it into
window.ASTERIX without every view having to pass it explicitly.

Register in settings.py:

    TEMPLATES = [
        {
            ...
            'OPTIONS': {
                'context_processors': [
                    ...your existing ones...
                    'app.context_processors.vapid_key',   # add this line
                ],
            },
        },
    ]

(adjust 'app.context_processors' to match wherever you place this file)
"""

from django.conf import settings


def vapid_key(request):
    return {'VAPID_PUBLIC_KEY_JS': getattr(settings, 'VAPID_PUBLIC_KEY', '')}
