#!/usr/bin/env python
"""
fix_reload_menu.py

The "Reload app" item was inserted inside a commented-out copy of the menu,
so it never showed. This:
  - removes the misplaced item and the misplaced script tag
  - puts the item in the live menu, directly after Settings
  - puts the script tag before the live </body>

Edits templates/index.html only.

Run from the project folder (the one with manage.py):
    python fix_reload_menu.py --dry-run
    python fix_reload_menu.py
"""
import datetime
import re
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
BACKUP = ROOT / "_patch_backup" / f"fix-reload-menu-{datetime.datetime.now():%Y%m%d-%H%M%S}"
INDEX = "templates/index.html"
ITEM = '<div id="ua-reload-app" class="ua-item"><i class="fas fa-sync-alt"></i> Reload app</div>'
TAG = "<script src=\"{% static 'js/modules/app_update.js' %}\" defer></script>"

COMMENT = re.compile(r"<!--.*?-->", re.S)
ITEM_RE = re.compile(r"[ \t]*" + re.escape(ITEM) + r"[ \t]*\n?")
TAG_RE = re.compile(r"[ \t]*" + re.escape(TAG) + r"[ \t]*\n?")


def live(pos, spans):
    return not any(s <= pos < e for s, e in spans)


def spans_of(text):
    return [(m.start(), m.end()) for m in COMMENT.finditer(text)]


def say(msg):
    print(("[dry-run] " if DRY else "") + msg)


def main():
    if not (ROOT / "manage.py").exists():
        raise SystemExit("Run this from the folder that contains manage.py.")

    path = ROOT / INDEX
    if not path.exists():
        raise SystemExit(f"{INDEX} not found. Stopping.")
    original = path.read_text(encoding="utf-8")
    text = original

    # 1. Remove the misplaced item and script tag (wherever they are)
    text = ITEM_RE.sub("", text)
    text = TAG_RE.sub("", text)

    # 2. Put the item in the live menu, right after the Settings item
    spans = spans_of(text)
    settings = [m for m in re.finditer(r'id="ua-settings"', text) if live(m.start(), spans)]
    if len(settings) != 1:
        raise SystemExit(f"Live Settings item found {len(settings)} times. Stopping.")
    m = settings[0]
    eol = text.find("\n", m.end())
    if eol == -1:
        eol = len(text)
    line_start = text.rfind("\n", 0, m.start()) + 1
    indent = re.match(r"[ \t]*", text[line_start:]).group(0)
    text = text[:eol] + "\n" + indent + ITEM + text[eol:]

    # 3. Put the script tag before the live </body>
    spans = spans_of(text)
    bodies = [b.start() for b in re.finditer(r"</body>", text) if live(b.start(), spans)]
    if not bodies:
        raise SystemExit("No live </body> found. Stopping.")
    b = bodies[-1]
    text = text[:b] + TAG + "\n" + text[b:]

    # Verify
    spans = spans_of(text)
    item_live = [mm.start() for mm in re.finditer(re.escape(ITEM), text) if live(mm.start(), spans)]
    tag_live = [mm.start() for mm in re.finditer(re.escape(TAG), text) if live(mm.start(), spans)]
    if len(item_live) != 1 or len(tag_live) != 1:
        raise SystemExit(f"Verification failed: item live={len(item_live)}, script live={len(tag_live)}. Stopping.")

    if text == original:
        say("nothing to change")
        return
    say(f"write   {INDEX} (menu item after Settings, script tag live)")
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

    say("done. Run: python manage.py collectstatic --noinput, then reload the web app.")


if __name__ == "__main__":
    main()