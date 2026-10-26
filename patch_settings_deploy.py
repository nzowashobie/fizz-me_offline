#!/usr/bin/env python
"""
patch_settings_deploy.py

Separates HTTPS cookie settings from DEBUG so the same settings work locally
and on PythonAnywhere.

  CSRF_COOKIE_SECURE / SESSION_COOKIE_SECURE follow USE_HTTPS (default off).
    - PythonAnywhere: USE_HTTPS=1
    - Local PC:       leave it out
  SECURE_PROXY_SSL_HEADER is always set (PythonAnywhere terminates HTTPS).
  Local http://127.0.0.1:8000 and http://localhost:8000 are trusted origins.

Edits projec/settings.py only.

Run from the project folder (the one with manage.py):
    python patch_settings_deploy.py --dry-run
    python patch_settings_deploy.py
"""
import datetime
import shutil
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path.cwd()
DRY = "--dry-run" in sys.argv
BACKUP = ROOT / "_patch_backup" / f"settings-deploy-{datetime.datetime.now():%Y%m%d-%H%M%S}"
REL = "projec/settings.py"

EDITS = [
    ("CSRF_COOKIE_SECURE    = not DEBUG",
     "CSRF_COOKIE_SECURE    = env_bool('USE_HTTPS', False)",
     "CSRF_COOKIE_SECURE    = env_bool('USE_HTTPS', False)",
     "CSRF cookie follows USE_HTTPS"),
    ("SESSION_COOKIE_SECURE = not DEBUG",
     "SESSION_COOKIE_SECURE = env_bool('USE_HTTPS', False)",
     "SESSION_COOKIE_SECURE = env_bool('USE_HTTPS', False)",
     "session cookie follows USE_HTTPS"),
    ("if not DEBUG:\n    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')",
     "SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')",
     "SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')",
     "proxy header always set"),
    ("    'https://*.pythonanywhere.com',\n]",
     "    'https://*.pythonanywhere.com',\n]\n"
     "# Local development over plain http (only matters when running runserver on your PC)\n"
     "CSRF_TRUSTED_ORIGINS += ['http://127.0.0.1:8000', 'http://localhost:8000']",
     "CSRF_TRUSTED_ORIGINS += ['http://127.0.0.1:8000', 'http://localhost:8000']",
     "local origins trusted"),
]


def say(msg):
    print(("[dry-run] " if DRY else "") + msg)


def main():
    if not (ROOT / "manage.py").exists():
        raise SystemExit("Run this from the folder that contains manage.py.")

    path = ROOT / REL
    if not path.exists():
        raise SystemExit(f"{REL} not found. Stopping.")
    original = path.read_text(encoding="utf-8")
    text = original

    for old, new, done, label in EDITS:
        if done in text:
            say(f"ok      {label} (already applied)")
            continue
        n = text.count(old)
        if n != 1:
            raise SystemExit(f"{label}: expected one match, found {n}. Stopping.")
        text = text.replace(old, new, 1)

    if text == original:
        say("nothing to change")
        return
    say(f"write   {REL}")
    if DRY:
        say("dry run complete, nothing was written")
        return

    BACKUP.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, BACKUP / path.name)
    path.write_text(text, encoding="utf-8")
    say(f"backup  {BACKUP / path.name}")

    r = subprocess.run([sys.executable, "manage.py", "check"], cwd=ROOT,
                       capture_output=True, text=True)
    print(r.stdout + r.stderr)
    if r.returncode:
        shutil.copy2(BACKUP / path.name, path)
        say(f"check failed, original restored. Backup: {BACKUP}")
        raise SystemExit(1)

    say("done. Restart runserver locally.")


if __name__ == "__main__":
    main()