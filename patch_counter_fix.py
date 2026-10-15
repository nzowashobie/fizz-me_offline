#!/usr/bin/env python
"""
patch_counter_fix.py

Restores the counter branch of respond_to_offer so the new counter offer is
attached to its chat message. Without the offer link, the card has no
Accept / Counter / Decline buttons.

Replaces only the counter branch. Accept and decline stay as they are.
Backs up the file and restores it if manage.py check fails.

Run from the folder that contains manage.py:
    python patch_counter_fix.py --dry-run
    python patch_counter_fix.py
"""
import datetime
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
DRY = "--dry-run" in sys.argv
BACKUP = ROOT / "_patch_backup" / f"counter-fix-{datetime.datetime.now():%Y%m%d-%H%M%S}"
REL = "chat/views/views_commerce.py"

START = '    if action == "counter":\n'
END_MARK = "    # action == \"counter\"\n"

NEW_COUNTER = '''    # action == "counter"
    if not counter_decimal:
        return JsonResponse({"error": "amount required for counter"}, status=400)

    offer.state = "countered"
    offer.responded_at = now()
    offer.save()

    counter_offer = Offer.objects.create(
        status=locked_status, buyer=offer.buyer, seller=offer.seller,
        proposed_by=request.user, amount=counter_decimal,
        state="pending", parent_offer=offer,
    )
    counter_recipient = offer.buyer if request.user == offer.seller else offer.seller
    who_label = "Seller" if request.user == offer.seller else "Buyer"

    counter_text = (
        f"{card}\\n\\n"
        f"🔄 {who_label} countered: {_fmt_price(counter_decimal)}\\n"
        f"(your offer was {_fmt_price(offer.amount)}){note_line}"
    )
    _create_system_msg(
        sender=request.user, recipient=counter_recipient,
        text=counter_text,
        message_type="offer",
        offer=counter_offer, status=locked_status,
    )
    return JsonResponse({
        "status": "success",
        "counter_offer_id": counter_offer.id,
        "counter_amount": str(counter_offer.amount),
    })
'''


def say(msg):
    print(("[dry-run] " if DRY else "") + msg)


def main():
    if not (ROOT / "manage.py").exists():
        raise SystemExit("Run this from the folder that contains manage.py.")

    path = ROOT / REL
    if not path.exists():
        raise SystemExit(f"{REL} not found. Stopping.")

    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)

    if "counter_offer.id" in text and "message_type=\"offer\"" in text:
        say(f"ok      {REL} (counter branch already attached to offer)")
        return

    starts = [i for i, l in enumerate(lines) if l.strip() == 'if action == "counter":' or l.strip() == "if action == 'counter':"]
    ends = [i for i, l in enumerate(lines) if l.strip() == "# action == \"counter\""]
    if len(starts) != 1:
        raise SystemExit(f"Expected one counter branch in respond_to_offer, found {len(starts)}. Stopping.")

    start = starts[0]
    end = None
    for j in range(start + 1, len(lines)):
        if lines[j].startswith("    return JsonResponse({\"error\": \"Invalid action"):
            end = j + 1
            break
        if lines[j].startswith("        else:"):
            end = j
            break
    if end is None:
        raise SystemExit("Could not find the end of the counter branch. Stopping.")

    say(f"replace {REL} lines {start + 1}-{end} (counter branch)")
    if DRY:
        say("dry run complete, nothing was written")
        return

    BACKUP.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, BACKUP / "views_commerce.py")
    new_text = "".join(lines[:start]) + NEW_COUNTER + "".join(lines[end:])
    path.write_text(new_text, encoding="utf-8")
    say(f"backup  {BACKUP / 'views_commerce.py'}")

    res = subprocess.run([sys.executable, "-m", "py_compile", REL], cwd=ROOT,
                         capture_output=True, text=True)
    res2 = subprocess.run([sys.executable, "manage.py", "check"], cwd=ROOT,
                          capture_output=True, text=True)
    print(res.stderr + res2.stdout + res2.stderr)
    if res.returncode or res2.returncode:
        shutil.copy2(BACKUP / "views_commerce.py", path)
        raise SystemExit(f"Check failed. Restored the original from {BACKUP}")

    say("done. Reload the web app, then test Counter in the chat.")


if __name__ == "__main__":
    main()