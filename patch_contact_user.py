#!/usr/bin/env python
"""
patch_contact_user.py

The add-by-phone endpoint returns the person under "contact":
  {"status": "success", "message": "...", "contact": {"username": ..., "profile_picture": ...}}
The contact form read a top-level "username", which does not exist, so the
sidebar got an empty name and the chat could not open.

This makes the form read the nested "contact" object, so the new person is
added to the sidebar and their chat opens straight away.

Edits contact_form.js in staticfiles/ (source) and static/ (served copy).

Run from the project folder (the one with manage.py):
    python patch_contact_user.py --dry-run
    python patch_contact_user.py
Then: python manage.py collectstatic --noinput
"""
import datetime
import shutil
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path.cwd()
DRY = "--dry-run" in sys.argv
BACKUP = ROOT / "_patch_backup" / f"contact-user-{datetime.datetime.now():%Y%m%d-%H%M%S}"
TARGETS = [
    "staticfiles/js/modules/contact_form.js",
    "static/js/modules/contact_form.js",
]

OLD = "return { status: 'added', phone: phone, username: d.username || '', pic: d.profile_picture || '' };"
NEW = ("var c = d.contact || {}; "
       "return { status: 'added', phone: phone, username: c.username || d.username || '', "
       "pic: c.profile_picture || d.profile_picture || '' };")
DONE = "var c = d.contact || {};"


def say(msg):
    print(("[dry-run] " if DRY else "") + msg)


def main():
    if not (ROOT / "manage.py").exists():
        raise SystemExit("Run this from the folder that contains manage.py.")

    plan = {}
    for rel in TARGETS:
        p = ROOT / rel
        if not p.exists():
            say(f"skip    {rel} (not found)")
            continue
        text = p.read_text(encoding="utf-8")
        if DONE in text:
            say(f"ok      {rel} (already reads contact)")
            continue
        n = text.count(OLD)
        if n != 1:
            raise SystemExit(f"{rel}: expected one match, found {n}. Stopping.")
        plan[rel] = (text, text.replace(OLD, NEW, 1))

    if not plan:
        say("nothing to change")
        return
    for rel in plan:
        say(f"write   {rel}")
    if DRY:
        say("dry run complete, nothing was written")
        return

    BACKUP.mkdir(parents=True, exist_ok=True)
    for rel, (old, new) in plan.items():
        shutil.copy2(ROOT / rel, BACKUP / Path(rel).name)
        (ROOT / rel).write_text(new, encoding="utf-8")
    say(f"backups: {BACKUP}")
    say("done. Run collectstatic, then reload the web app.")


if __name__ == "__main__":
    main()