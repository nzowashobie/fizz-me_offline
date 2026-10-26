# app/context_processors.py
from django.conf import settings

def vapid_key(request):
    return {'VAPID_PUBLIC_KEY_JS': getattr(settings, 'VAPID_PUBLIC_KEY', '')}