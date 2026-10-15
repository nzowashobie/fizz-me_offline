#!/usr/bin/env python
"""
patch_offer_response.py

Replaces respond_to_offer in chat/views/views_commerce.py with one clean
version. The current function contains two copies of the lock and accept
logic, so Accept and Counter can fail on the server.

Only the body of respond_to_offer changes. Decorators and every other
function in the file stay as they are.

Run from the folder that contains manage.py:
    python patch_offer_response.py --dry-run
    python patch_offer_response.py

Originals are backed up to _patch_backup/offer-response-<time>/ and
restored if manage.py check fails.
"""
import datetime
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
DRY = "--dry-run" in sys.argv
BACKUP = ROOT / "_patch_backup" / f"offer-response-{datetime.datetime.now():%Y%m%d-%H%M%S}"
REL = "chat/views/views_commerce.py"

NEW_FUNC = r'''def respond_to_offer(request):
    """
    The non-proposing party responds: accept / decline / counter.

    POST JSON body:
        offer_id   int
        action     'accept' | 'decline' | 'counter'
        amount     decimal (required for 'counter')
        note       str     (optional, max 200 chars)
    """
    try:
        data = json.loads(request.body or b"{}")
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    offer_id = data.get("offer_id")
    action = data.get("action")
    counter_amount = data.get("amount")
    note = (data.get("note") or "").strip()[:200]

    if not offer_id or action not in ("accept", "decline", "counter"):
        return JsonResponse({"error": "offer_id and a valid action are required"}, status=400)

    try:
        offer = Offer.objects.select_related("status", "buyer", "seller", "proposed_by").get(id=offer_id)
    except Offer.DoesNotExist:
        return JsonResponse({"error": "Offer not found"}, status=404)

    if request.user.id not in (offer.buyer_id, offer.seller_id):
        return JsonResponse({"error": "You are not part of this offer."}, status=403)
    if offer.proposed_by_id == request.user.id:
        return JsonResponse({"error": "You cannot respond to your own offer."}, status=403)
    if offer.state != "pending":
        return JsonResponse(
            {"error": f"Offer is already {offer.state}. Only pending offers can be acted upon."},
            status=400,
        )

    counter_decimal = None
    if action == "counter":
        try:
            counter_decimal = Decimal(str(counter_amount))
        except Exception:
            return JsonResponse({"error": "Invalid amount"}, status=400)
        if not counter_decimal.is_finite() or counter_decimal <= 0:
            return JsonResponse({"error": "Amount must be positive"}, status=400)

    other = offer.seller if request.user.id == offer.buyer_id else offer.buyer
    card = _listing_card_text(offer.status)
    note_line = f'\n\n💬 "{note}"' if note else ""

    with transaction.atomic():
        locked_status = UserStatus.objects.select_for_update().get(pk=offer.status_id)

        if action == "accept":
            if locked_status.availability in ("sold", "reserved"):
                return JsonResponse(
                    {"error": "This item was taken by another buyer while you were negotiating."},
                    status=409,
                )
            offer.state = "accepted"
            offer.responded_at = now()
            offer.save()
            deal = Deal.objects.create(
                status=locked_status, buyer=offer.buyer, seller=offer.seller,
                offer=offer, final_price=offer.amount,
                collection_point_snapshot=locked_status.collection_point,
                buyer_confirmed=True, buyer_confirmed_at=now(),
                seller_confirmed=True, seller_confirmed_at=now(),
                state="confirmed",
            )
            locked_status.availability = "reserved"
            locked_status.save(update_fields=["availability"])
            _create_system_msg(
                sender=request.user, recipient=other,
                text=(f"{card}\n\n✅ Deal agreed at {_fmt_price(offer.amount)}!{note_line}\n\n"
                      "Proceed to checkout to finalise payment."),
                message_type="deal_confirmation", deal=deal, status=locked_status,
            )
            return JsonResponse({
                "status": "success",
                "deal_id": deal.id,
                "final_price": str(deal.final_price),
            })

        if action == "decline":
            offer.state = "declined"
            offer.responded_at = now()
            offer.save()
            _create_system_msg(
                sender=request.user, recipient=other,
                text=f"{card}\n\n❌ Offer of {_fmt_price(offer.amount)} declined.{note_line}",
                message_type="status_update", status=locked_status,
            )
            return JsonResponse({"status": "success"})

        # action == "counter"
        offer.state = "countered"
        offer.responded_at = now()
        offer.save()
        new_offer = Offer.objects.create(
            status=locked_status, buyer=offer.buyer, seller=offer.seller,
            amount=counter_decimal, proposed_by=request.user,
            note=note, parent_offer=offer, state="pending",
        )
        _create_system_msg(
            sender=request.user, recipient=other,
            text=f"{card}\n\n🔄 Counter offer: {_fmt_price(counter_decimal)}{note_line}",
            message_type="status_update", status=locked_status,
        )
        return JsonResponse({"status": "success", "offer_id": new_offer.id})
'''


def say(msg):
    print(("[dry-run] " if DRY else "") + msg)


def main():
    if not (ROOT / "manage.py").exists():
        raise SystemExit("Run this from the folder that contains manage.py.")

    path = ROOT / REL
    if not path.exists():
        raise SystemExit(f"{REL} not found. Stopping.")

    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    starts = [i for i, l in enumerate(lines) if l.startswith("def respond_to_offer(")]
    if len(starts) != 1:
        raise SystemExit(f"Expected one 'def respond_to_offer(', found {len(starts)}. Stopping.")
    start = starts[0]

    end = len(lines)
    for j in range(start + 1, len(lines)):
        if re.match(r"(def |class |@)", lines[j]):
            end = j
            break

    say(f"replace {REL} lines {start + 1}-{end} (respond_to_offer)")
    if DRY:
        say("dry run complete, nothing was written")
        return

    BACKUP.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, BACKUP / "views_commerce.py")
    new_text = "".join(lines[:start]) + NEW_FUNC + "\n\n" + "".join(lines[end:])
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

    say("done. Reload the web app, then test Accept, Counter, and Decline in the chat.")


if __name__ == "__main__":
    main()