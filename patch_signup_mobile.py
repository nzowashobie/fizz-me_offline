#!/usr/bin/env python
"""
patch_signup_mobile.py

On the sign-up page:
  - the terms agreement row is rebuilt so it wraps neatly on phones
  - Create Account stays locked until the terms box is ticked
  - the app name reads Fizzme

Edits chat/templates/signup.html only. Safe to run more than once.

Run from the project folder (the one with manage.py):
    python patch_signup_mobile.py --dry-run
    python patch_signup_mobile.py
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
BACKUP = ROOT / "_patch_backup" / f"signup-mobile-{datetime.datetime.now():%Y%m%d-%H%M%S}"
SIGNUP = "chat/templates/signup.html"

START = "<!-- Terms & Privacy agreement (required) -->"
END = "<!-- Submit -->"
NEW_BLOCK = (
    "<!-- Terms & Privacy agreement (required) -->\n"
    "            <label class=\"terms-row\" for=\"agree-terms\">\n"
    "                <input type=\"checkbox\" id=\"agree-terms\" name=\"agree_terms\" value=\"1\">\n"
    "                <span>I agree to the <a href=\"{% url 'terms' %}\" target=\"_blank\" rel=\"noopener\">Terms of Service</a> "
    "and <a href=\"{% url 'privacy' %}\" target=\"_blank\" rel=\"noopener\">Privacy Policy</a>.</span>\n"
    "            </label>\n\n            "
)

CSS_MARK = "/* ── Scrollbar ── */"
CSS_NEW = "\n".join([
    "/* ── Terms agreement row (responsive) ── */",
    ".terms-row{display:flex;align-items:flex-start;gap:12px;width:100%;margin:2px 0 0;cursor:pointer;}",
    ".terms-row input[type=checkbox]{width:18px;height:18px;margin:3px 0 0;flex-shrink:0;accent-color:#25d366;cursor:pointer;}",
    ".terms-row span{flex:1;min-width:0;font-size:13px;line-height:1.6;color:#8696a0;overflow-wrap:anywhere;}",
    ".terms-row a{color:#25d366;font-weight:600;text-decoration:none;}",
    ".terms-row a:hover{text-decoration:underline;}",
    "@media (max-width:380px){.terms-row{gap:10px;}.terms-row span{font-size:12.5px;}}",
    "",
    "        ",
]) + CSS_MARK

LOCK_MARK = "// ── Init intl-tel-input"
LOCK_JS = "\n".join([
    "            // ── Keep Create Account locked until the terms box is ticked ──",
    "            const agreeBox = document.getElementById('agree-terms');",
    "            submitBtn.disabled = !(agreeBox && agreeBox.checked);",
    "            if (agreeBox) {",
    "                agreeBox.addEventListener('change', function () {",
    "                    submitBtn.disabled = !this.checked;",
    "                });",
    "            }",
    "",
    "            ",
]) + LOCK_MARK

NAME_FIXES = [
    ("<title>Asterix — Sign Up</title>", "<title>Fizzme — Sign Up</title>"),
    ("<h1>Join FIzzme</h1>", "<h1>Join Fizzme</h1>"),
    ("<h1>Join Asterix</h1>", "<h1>Join Fizzme</h1>"),
]


def say(msg):
    print(("[dry-run] " if DRY else "") + msg)


def only_one(text, marker, label):
    n = text.count(marker)
    if n != 1:
        raise SystemExit(f"{label}: expected one match for {marker[:40]!r}, found {n}. Stopping.")


def main():
    if not (ROOT / "manage.py").exists():
        raise SystemExit("Run this from the folder that contains manage.py.")

    path = ROOT / SIGNUP
    if not path.exists():
        raise SystemExit(f"{SIGNUP} not found. Stopping.")
    original = path.read_text(encoding="utf-8")
    text = original

    # 1. Rebuild the agreement row
    only_one(text, START, SIGNUP)
    only_one(text, END, SIGNUP)
    s = text.index(START)
    e = text.index(END, s)
    if text[s:e].strip() != NEW_BLOCK.strip():
        text = text[:s] + NEW_BLOCK + text[e:]
        say("write   agreement row (responsive)")
    else:
        say("ok      agreement row already current")

    # 2. Create Account starts locked
    btn_old = 'id="signup-btn">'
    if 'id="signup-btn" disabled>' in text:
        say("ok      Create Account already locked by default")
    else:
        only_one(text, btn_old, SIGNUP)
        text = text.replace(btn_old, 'id="signup-btn" disabled>', 1)
        say("write   Create Account locked by default")

    # 3. Styles for the row
    if ".terms-row{" in text:
        say("ok      row styles already present")
    else:
        only_one(text, CSS_MARK, SIGNUP)
        text = text.replace(CSS_MARK, CSS_NEW, 1)
        say("write   row styles (mobile breakpoints)")

    # 4. Unlock logic
    if "agreeBox.addEventListener('change'" in text:
        say("ok      unlock logic already present")
    else:
        only_one(text, LOCK_MARK, SIGNUP)
        text = text.replace(LOCK_MARK, LOCK_JS, 1)
        say("write   unlock logic")

    # 5. App name
    for old, new in NAME_FIXES:
        if old in text:
            text = text.replace(old, new)
            say(f"write   name: {new}")

    if text == original:
        say("nothing to change")
        return
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

    say("done. Reload the web app, then open /auth/signup/ on a phone.")


if __name__ == "__main__":
    main()