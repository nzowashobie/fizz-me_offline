#!/usr/bin/env python
"""
verify_fcm.py — one-shot health check for the FCM pipeline.
Run from ~/fizzme/projec with:  python verify_fcm.py
"""
import os
import sys

# Bootstrap Django BEFORE any chat.* import
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'projec.settings')
import django
django.setup()

from django.conf import settings
from chat.models import FCMDevice
from chat.fcm import _init, send_fcm_to_user

ok = True
print('─' * 60)

# 1. Model
try:
    print(f'1. FCMDevice table      : {FCMDevice._meta.db_table}')
    print(f'2. FCMDevice rows       : {FCMDevice.objects.count()}')
except Exception as e:
    print(f'1/2. FCMDevice          : ✗ {type(e).__name__}: {e}')
    ok = False

# 2. Settings
try:
    path = settings.FIREBASE_CREDENTIALS
    print(f'3. FIREBASE_CREDENTIALS : {path}')
    print(f'4. credentials exist    : {os.path.exists(path)}')
    if not os.path.exists(path):
        ok = False
except Exception as e:
    print(f'3/4. settings           : ✗ {type(e).__name__}: {e}')
    ok = False

# 3. Firebase
try:
    _init()
    print(f'5. Firebase init        : ✓ OK')
except Exception as e:
    print(f'5. Firebase init        : ✗ {type(e).__name__}: {e}')
    ok = False

# 4. Callable
print(f'6. send_fcm_to_user     : {"✓ callable" if callable(send_fcm_to_user) else "✗ not callable"}')

print('─' * 60)
if ok:
    print('✓ All checks passed — FCM is ready.')
    sys.exit(0)
else:
    print('✗ Some checks failed — fix the ✗ lines above.')
    sys.exit(1)