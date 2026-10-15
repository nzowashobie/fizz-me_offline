#!/usr/bin/env python
"""
patch_seller_setup_button.py

Adds an "Add / Edit payment details" button to the deal card for the seller
when the deal is confirmed. It calls checkout.js openSellerPaymentSetup.
Edits only static/js/modules/deals.js.

Run from the folder that contains manage.py:
    python patch_seller_setup_button.py --dry-run
    python patch_seller_setup_button.py
"""
import datetime
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
DRY = "--dry-run" in sys.argv
BACKUP = ROOT / "_patch_backup" / f"seller-setup-{datetime.datetime.now():%Y%m%d-%H%M%S}"
DEALS = "static/js/modules/deals.js"
CHECKOUT = "static/js/modules/checkout.js"

ANCHOR = "// Pay button (confirmed state, buyer side)"
NEW = r'''// Seller shares how the buyer should pay (confirmed state, seller side)
    if (deal.state === 'confirmed' && isSeller) {
      var setupBtn = _txnBtn(
        deal.payment_method ? '💳 Edit payment details' : '💳 Add payment details',
        'setup',
        function () {
          if (window.Asterix && window.Asterix.checkout && window.Asterix.checkout.openSellerPaymentSetup) {
            window.Asterix.checkout.openSellerPaymentSetup(deal.id, deal.final_price, _displayName(deal.buyer));
          } else {
            toast('Error', 'Payment setup is not available yet. Reload the page.');
          }
        }
      );
      btnWrap.appendChild(setupBtn);
    }

    // Pay button (confirmed state, buyer side)'''


def say(msg):
    print(("[dry-run] " if DRY else "") + msg)


def main():
    if not (ROOT / "manage.py").exists():
        raise SystemExit("Run this from the folder that contains manage.py.")

    checkout = ROOT / CHECKOUT
    if not checkout.exists() or "openSellerPaymentSetup: openSellerPaymentSetup" not in checkout.read_text(encoding="utf-8"):
        raise SystemExit("checkout.js does not have openSellerPaymentSetup. Run patch_payment_flow.py first.")

    path = ROOT / DEALS
    if not path.exists():
        raise SystemExit(f"{DEALS} not found. Stopping.")
    text = path.read_text(encoding="utf-8")

    if "Add payment details" in text:
        say(f"ok      {DEALS} (seller button already present)")
        return

    n = text.count(ANCHOR)
    if n != 1:
        raise SystemExit(f"{DEALS}: expected one buyer Pay button anchor, found {n}. Stopping.")

    new_text = text.replace(ANCHOR, NEW, 1)
    say(f"write   {DEALS} (seller payment-details button)")
    if DRY:
        say("dry run complete, nothing was written")
        return

    BACKUP.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, BACKUP / path.name)
    path.write_text(new_text, encoding="utf-8")
    say(f"backup  {BACKUP / path.name}")

    if shutil.which("node"):
        r = subprocess.run(["node", "--check", DEALS], cwd=ROOT, capture_output=True, text=True)
        if r.returncode:
            shutil.copy2(BACKUP / path.name, path)
            raise SystemExit(f"Syntax error. Restored original.\n{r.stderr}")

    r = subprocess.run([sys.executable, "manage.py", "collectstatic", "--noinput"],
                       cwd=ROOT, capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    say("done. Reload the web app, then hard-refresh the chat (Ctrl+Shift+R).")


if __name__ == "__main__":
    main()