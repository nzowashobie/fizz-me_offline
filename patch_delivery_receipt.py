#!/usr/bin/env python
"""
patch_delivery_receipt.py

Completes the post-payment flow: delivery method, stage order, closing the
deal, and a printable receipt.

  chat/models.py                       DeliveryTracking.delivery_method (new field)
  chat/views/views_delivery.py         tracker created on demand; buyer chooses
                                       collection or delivery; collection skips
                                       in-transit; closing marks the listing sold;
                                       receipt view
  chat/urls.py                         /api/delivery/method/ and /deals/<id>/receipt/
  static/**/pro_features.js            method chooser; timeline per method;
                                       receipt link after closing
  templates/deal_receipt.html          receipt page (created if missing)

Run from the folder that contains manage.py:
    python patch_delivery_receipt.py --dry-run
    python patch_delivery_receipt.py
Then run: python manage.py migrate
"""
import datetime
import glob
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
DRY = "--dry-run" in sys.argv
BACKUP = ROOT / "_patch_backup" / f"delivery-receipt-{datetime.datetime.now():%Y%m%d-%H%M%S}"
MODELS = "chat/models.py"
VIEWS = "chat/views/views_delivery.py"
URLS = "chat/urls.py"
TEMPLATE = "templates/deal_receipt.html"

VIEWS_BLOCK = r'''_METHODS = {
    "collection": "Collect at the collection point",
    "delivery": "Seller delivers to the buyer",
}


def _stages_for(method):
    """Collection skips the in-transit step."""
    if method == "collection":
        return [s for s in _STAGE_ORDER if s != "in_transit"]
    return list(_STAGE_ORDER)


def _tracker_for(deal):
    tracker, _ = DeliveryTracking.objects.get_or_create(
        deal=deal, defaults={"stage": "order_placed"}
    )
    return tracker


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def advance_delivery(request):
    """
    POST: { "deal_id": 123, "stage": "in_transit", "notes": "..." }
    Stages run in order for the chosen method. Payment is already complete.
    """
    try:
        data = json.loads(request.body or b"{}")
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    deal_id = data.get("deal_id")
    new_stage = str(data.get("stage") or "").strip()
    notes = str(data.get("notes") or "").strip()[:500]

    if not deal_id or not new_stage:
        return JsonResponse({"error": "deal_id and stage are required"}, status=400)

    try:
        deal = Deal.objects.select_related("buyer", "seller", "status").get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)

    me = request.user
    if me not in (deal.buyer, deal.seller):
        return JsonResponse({"error": "Not a participant in this deal"}, status=403)
    if deal.state != "completed":
        return JsonResponse({"error": "Delivery starts once payment is complete"}, status=400)

    tracker = _tracker_for(deal)
    current = tracker.stage

    if new_stage == "disputed":
        if current == "payment_released":
            return JsonResponse({"error": "Cannot dispute a closed delivery"}, status=400)
    else:
        if not tracker.delivery_method:
            return JsonResponse(
                {"error": "The buyer must choose collection or delivery first"}, status=400)
        order = _stages_for(tracker.delivery_method)
        if new_stage not in order:
            return JsonResponse({"error": f"Unknown stage: {new_stage}"}, status=400)
        ci = order.index(current) if current in order else -1
        ni = order.index(new_stage)
        if ni != ci + 1:
            expected = order[ci + 1] if ci + 1 < len(order) else "none"
            return JsonResponse(
                {"error": f"Cannot jump from {current} to {new_stage}. Next expected: {expected}"},
                status=400,
            )

    allowed = _STAGE_ACTOR.get(new_stage, "both")
    if allowed == "seller" and me != deal.seller:
        return JsonResponse({"error": "Only the seller can mark this stage"}, status=403)
    if allowed == "buyer" and me != deal.buyer:
        return JsonResponse({"error": "Only the buyer can mark this stage"}, status=403)

    ts = now()
    with transaction.atomic():
        tracker.stage = new_stage
        if notes:
            tracker.notes = notes
        if new_stage == "seller_confirmed":
            tracker.seller_confirmed_at = ts
        elif new_stage == "in_transit":
            tracker.in_transit_at = ts
        elif new_stage == "delivered":
            tracker.delivered_at = ts
        elif new_stage == "payment_released":
            tracker.payment_released_at = ts
            SellerRating.objects.get_or_create(deal=deal)
            UserStatus.objects.filter(pk=deal.status_id).update(availability="sold")
        elif new_stage == "disputed":
            tracker.disputed_at = ts
        tracker.save()

        note_suffix = f' · "{notes}"' if notes else ""
        other = deal.seller if me == deal.buyer else deal.buyer
        Message.objects.create(
            sender=me, recipient=other,
            message=_STAGE_LABELS.get(new_stage, new_stage) + note_suffix,
            message_type="status_update", deal=deal, related_status=deal.status,
        )

    return JsonResponse({"status": "success", "stage": tracker.stage, "updated": _utc_iso(ts)})


@login_required
def get_delivery_status(request):
    """GET /api/delivery/status/?deal_id=123"""
    deal_id = request.GET.get("deal_id", "").strip()
    if not deal_id.isdigit():
        return JsonResponse({"error": "deal_id required"}, status=400)
    try:
        deal = Deal.objects.select_related("buyer", "seller").get(pk=int(deal_id))
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)

    me = request.user
    if me not in (deal.buyer, deal.seller):
        return JsonResponse({"error": "Not a participant"}, status=403)
    if deal.state != "completed":
        return JsonResponse({"error": "Delivery starts once payment is complete"}, status=400)

    t = _tracker_for(deal)
    order = _stages_for(t.delivery_method)
    next_s = None
    if t.delivery_method and t.stage in order and order.index(t.stage) + 1 < len(order):
        next_s = order[order.index(t.stage) + 1]

    return JsonResponse({
        "deal_id":             deal.pk,
        "stage":               t.stage,
        "delivery_method":     t.delivery_method,
        "stages":              order,
        "notes":               t.notes,
        "seller_confirmed_at": _utc_iso(t.seller_confirmed_at) if t.seller_confirmed_at else None,
        "in_transit_at":       _utc_iso(t.in_transit_at)       if t.in_transit_at       else None,
        "delivered_at":        _utc_iso(t.delivered_at)        if t.delivered_at        else None,
        "payment_released_at": _utc_iso(t.payment_released_at) if t.payment_released_at else None,
        "disputed_at":         _utc_iso(t.disputed_at)         if t.disputed_at         else None,
        "next_stage":          next_s,
        "next_actor":          _STAGE_ACTOR.get(next_s, "") if next_s else "",
        "my_role":             "buyer" if me == deal.buyer else "seller",
        "closed":              t.stage == "payment_released",
        "receipt_url":         f"/deals/{deal.pk}/receipt/",
    })


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def set_delivery_method(request):
    """POST: { "deal_id": 123, "method": "collection" | "delivery" } buyer only."""
    try:
        data = json.loads(request.body or b"{}")
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    deal_id = data.get("deal_id")
    method = str(data.get("method") or "").strip()
    if not deal_id or method not in _METHODS:
        return JsonResponse({"error": "deal_id and a valid method are required"}, status=400)

    try:
        deal = Deal.objects.select_related("buyer", "seller", "status").get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)
    if request.user != deal.buyer:
        return JsonResponse({"error": "Only the buyer chooses how the item is handed over"}, status=403)
    if deal.state != "completed":
        return JsonResponse({"error": "Delivery starts once payment is complete"}, status=400)

    tracker = _tracker_for(deal)
    if tracker.stage != "order_placed":
        return JsonResponse({"error": "The method is locked once the seller has acted"}, status=400)

    with transaction.atomic():
        tracker.delivery_method = method
        tracker.save(update_fields=["delivery_method"])
        Message.objects.create(
            sender=request.user, recipient=deal.seller,
            message=f"🚚 Buyer chose: {_METHODS[method]}",
            message_type="status_update", deal=deal, related_status=deal.status,
        )
    return JsonResponse({"status": "success", "delivery_method": method})


@login_required
def deal_receipt(request, deal_id):
    """Printable receipt for a completed deal. Buyer and seller only."""
    from .views_commerce import _METHOD_LABELS

    try:
        deal = Deal.objects.select_related("buyer", "seller", "status").get(pk=deal_id)
    except Deal.DoesNotExist:
        raise Http404("Deal not found")
    if request.user not in (deal.buyer, deal.seller):
        return HttpResponse("Not a participant in this deal.", status=403)
    if deal.state != "completed":
        return HttpResponse("The receipt is available once payment is complete.", status=400)

    tracker = DeliveryTracking.objects.filter(deal=deal).first()
    method = tracker.delivery_method if tracker else ""
    return render(request, "deal_receipt.html", {
        "deal": deal,
        "tracker": tracker,
        "receipt_no": f"ASX-{deal.pk:06d}",
        "issued": now(),
        "closed": bool(tracker and tracker.stage == "payment_released"),
        "method_label": _METHODS.get(method, "Not chosen yet"),
        "payment_label": _METHOD_LABELS.get(deal.payment_method, deal.payment_method) or "—",
    })


# ─── Seller ratings'''

TEMPLATE_HTML = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Receipt {{ receipt_no }} · Asterix</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f6f5;margin:0;padding:24px;color:#111}
  .card{max-width:520px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  h1{font-size:20px;margin:0 0 4px}
  .muted{color:#666;font-size:13px}
  .row{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}
  .row span:first-child{color:#666}
  .total{font-size:26px;font-weight:800;color:#128c7e;margin:18px 0 2px}
  .status{display:inline-block;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;background:#dff7e8;color:#128c7e}
  .status.open{background:#fff4d6;color:#8a6100}
  .actions{margin-top:20px;text-align:center}
  button{padding:10px 18px;border:0;border-radius:20px;background:#128c7e;color:#fff;font-weight:700;cursor:pointer}
  @media print{body{background:#fff;padding:0}.card{box-shadow:none}.actions{display:none}}
</style>
</head>
<body>
<div class="card">
  <h1>Asterix Receipt</h1>
  <div class="muted">{{ receipt_no }} · Issued {{ issued|date:"d M Y, H:i" }}</div>
  <p><span class="status {% if not closed %}open{% endif %}">{% if closed %}Completed · Delivery closed{% else %}Paid · Awaiting delivery close{% endif %}</span></p>

  <div class="row"><span>Item</span><span>{{ deal.status.caption|default:"Listing" }}</span></div>
  <div class="row"><span>Seller</span><span>{{ deal.seller.username }}</span></div>
  <div class="row"><span>Buyer</span><span>{{ deal.buyer.username }}</span></div>
  <div class="row"><span>Delivery</span><span>{{ method_label }}</span></div>
  {% if deal.collection_point_snapshot %}<div class="row"><span>Collection point</span><span>{{ deal.collection_point_snapshot }}</span></div>{% endif %}
  {% if deal.delivery_address %}<div class="row"><span>Address</span><span>{{ deal.delivery_address }}</span></div>{% endif %}
  <div class="row"><span>Payment method</span><span>{{ payment_label }}</span></div>
  {% if deal.payment_reference %}<div class="row"><span>Payment reference</span><span>{{ deal.payment_reference }}</span></div>{% endif %}
  <div class="row"><span>Deal opened</span><span>{{ deal.created_at|date:"d M Y, H:i" }}</span></div>
  {% if tracker.delivered_at %}<div class="row"><span>Received</span><span>{{ tracker.delivered_at|date:"d M Y, H:i" }}</span></div>{% endif %}
  {% if tracker.payment_released_at %}<div class="row"><span>Closed</span><span>{{ tracker.payment_released_at|date:"d M Y, H:i" }}</span></div>{% endif %}

  <div class="total">K {{ deal.final_price }}</div>
  <div class="muted">Total paid</div>
  <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
</div>
</body>
</html>
'''

PRO_EDITS = [
    ("var ci = STAGES.indexOf(current);",
     "var LIST = (d.delivery_method === 'collection')\n"
     "      ? STAGES.filter(function (s) { return s !== 'in_transit'; })\n"
     "      : STAGES;\n"
     "    var ci = LIST.indexOf(current);",
     "timeline index"),
    ("STAGES.forEach(function (s, i) {", "LIST.forEach(function (s, i) {", "timeline loop"),
    ("if (i < STAGES.length - 1) {", "if (i < LIST.length - 1) {", "timeline connector"),
    ("// Action button",
     "if (!d.delivery_method && current === 'order_placed') {\n"
     "      if (myRole === 'buyer') {\n"
     "        html += '<div style=\"margin-bottom:16px;\">';\n"
     "        html += '<div style=\"font-size:13px;color:var(--sub);margin-bottom:8px;\">How will you get your item?</div>';\n"
     "        html += '<button id=\"delivery-method-collection\" style=\"width:100%;padding:12px;margin-bottom:8px;background:rgba(37,211,102,.12);border:1px solid rgba(37,211,102,.3);color:var(--text);border-radius:25px;font-weight:600;cursor:pointer;\">📍 Collect at the collection point</button>';\n"
     "        html += '<button id=\"delivery-method-delivery\" style=\"width:100%;padding:12px;background:rgba(230,168,23,.12);border:1px solid rgba(230,168,23,.3);color:var(--text);border-radius:25px;font-weight:600;cursor:pointer;\">🚚 Seller delivers to me</button>';\n"
     "        html += '</div>';\n"
     "      } else {\n"
     "        html += '<div style=\"font-size:13px;color:var(--sub);margin-bottom:16px;\">Waiting for the buyer to choose collection or delivery.</div>';\n"
     "      }\n"
     "    }\n\n"
     "    // Action button",
     "method chooser"),
    ("// Wire advance",
     "// Wire the method chooser (buyer)\n"
     "    ['collection', 'delivery'].forEach(function (m) {\n"
     "      var mb = document.getElementById('delivery-method-' + m);\n"
     "      if (!mb) return;\n"
     "      mb.onclick = function () {\n"
     "        mb.disabled = true;\n"
     "        postJSON('/api/delivery/method/', { deal_id: parseInt(d.deal_id), method: m })\n"
     "          .then(function () { _loadDelivery(d.deal_id); toast('🚚', 'Method saved'); })\n"
     "          .catch(function (e) { mb.disabled = false; toast('Error', e.message || 'Could not save method'); });\n"
     "      };\n"
     "    });\n\n"
     "    // Wire advance",
     "method wiring"),
    ("// Rating prompt if payment released",
     "if (current === 'payment_released' && d.receipt_url) {\n"
     "      html += '<a href=\"' + d.receipt_url + '\" target=\"_blank\" rel=\"noopener\" style=\"display:block;text-align:center;margin-top:12px;padding:12px;border-radius:25px;background:#e6a817;color:#000;font-weight:700;text-decoration:none;\">🧾 View receipt</a>';\n"
     "    }\n\n"
     "    // Rating prompt if payment released",
     "receipt link"),
]


def say(msg):
    print(("[dry-run] " if DRY else "") + msg)


def apply_once(text, old, new, label):
    if new in text:
        say(f"ok      {label} (already applied)")
        return text
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected one match, found {n}. Stopping.")
    return text.replace(old, new, 1)


def edit_models(t):
    if "delivery_method" in t:
        say(f"ok      {MODELS} (field already present)")
        return t
    found = list(re.finditer(r"^class DeliveryTracking\(models\.Model\):[ \t]*$", t, re.M))
    if len(found) != 1:
        raise SystemExit(f"{MODELS}: expected one DeliveryTracking class line, found {len(found)}. Stopping.")
    m = found[0]
    return t[:m.end()] + "\n    delivery_method = models.CharField(max_length=20, blank=True, default='')" + t[m.end():]


def edit_views(t):
    if "def deal_receipt(" in t:
        say(f"ok      {VIEWS} (already applied)")
        return t
    t = apply_once(t, "from django.http import JsonResponse\n",
                   "from django.http import JsonResponse, HttpResponse, Http404\n"
                   "from django.shortcuts import render\n",
                   f"{VIEWS} imports")
    start_marker = '@csrf_exempt\n@login_required\n@require_http_methods(["POST"])\ndef advance_delivery(request):'
    end_marker = "# ─── Seller ratings"
    if t.count(start_marker) != 1 or t.count(end_marker) != 1:
        raise SystemExit(f"{VIEWS}: advance_delivery or the ratings section marker not found exactly once. Stopping.")
    s = t.index(start_marker)
    e = t.index(end_marker)
    block = VIEWS_BLOCK[: VIEWS_BLOCK.rfind("# ─── Seller ratings")].rstrip()
    return t[:s] + block + "\n\n\n" + t[e:]


def edit_urls(t):
    if "deal-receipt" in t:
        say(f"ok      {URLS} (routes already present)")
        return t
    t = apply_once(t, "from .views.views_commerce import payment_details as deal_payment_details\n",
                   "from .views.views_commerce import payment_details as deal_payment_details\n"
                   "from .views.views_delivery import deal_receipt as deal_receipt_view, set_delivery_method as deal_set_method\n",
                   f"{URLS} imports")
    t = apply_once(t, "name='deal-payment-details'),",
                   "name='deal-payment-details'),\n"
                   "    path('api/delivery/method/', deal_set_method, name='delivery-method'),\n"
                   "    path('deals/<int:deal_id>/receipt/', deal_receipt_view, name='deal-receipt'),",
                   f"{URLS} routes")
    return t


def main():
    if not (ROOT / "manage.py").exists():
        raise SystemExit("Run this from the folder that contains manage.py.")

    located = [p for p in ROOT.glob("static/**/pro_features.js") if "_patch_backup" not in p.parts]
    if len(located) != 1:
        raise SystemExit(f"Expected one pro_features.js under static/, found {len(located)}. Stopping.")
    pro_rel = located[0].relative_to(ROOT).as_posix()

    existing = [MODELS, VIEWS, URLS, pro_rel]
    original = {}
    for rel in existing:
        p = ROOT / rel
        if not p.exists():
            raise SystemExit(f"{rel} not found. Stopping.")
        original[rel] = p.read_text(encoding="utf-8")

    new = dict(original)
    new[MODELS] = edit_models(new[MODELS])
    new[VIEWS] = edit_views(new[VIEWS])
    new[URLS] = edit_urls(new[URLS])
    t = new[pro_rel]
    for old, repl, label in PRO_EDITS:
        t = apply_once(t, old, repl, f"{pro_rel} {label}")
    new[pro_rel] = t

    changed = [rel for rel in existing if new[rel] != original[rel]]
    template_path = ROOT / TEMPLATE
    create_template = not template_path.exists()
    if create_template:
        say(f"create  {TEMPLATE}")
    if not changed and not create_template:
        say("nothing to change")
        return
    for rel in changed:
        say(f"write   {rel}")
    if DRY:
        say("dry run complete, nothing was written")
        return

    BACKUP.mkdir(parents=True, exist_ok=True)
    for rel in changed:
        shutil.copy2(ROOT / rel, BACKUP / Path(rel).name)
        (ROOT / rel).write_text(new[rel], encoding="utf-8")
    created = []
    if create_template:
        template_path.parent.mkdir(parents=True, exist_ok=True)
        template_path.write_text(TEMPLATE_HTML, encoding="utf-8")
        created.append(str(template_path))
    say(f"backups: {BACKUP}")

    migrations_before = set(glob.glob(str(ROOT / "chat/migrations/*.py")))

    def restore():
        for f in created:
            Path(f).unlink(missing_ok=True)
        for rel in changed:
            shutil.copy2(BACKUP / Path(rel).name, ROOT / rel)

    try:
        for rel in changed:
            if rel.endswith(".py"):
                r = subprocess.run([sys.executable, "-m", "py_compile", rel], cwd=ROOT,
                                   capture_output=True, text=True)
                if r.returncode:
                    raise SystemExit(f"Syntax error in {rel}:\n{r.stderr}")
            elif rel.endswith(".js") and shutil.which("node"):
                r = subprocess.run(["node", "--check", rel], cwd=ROOT,
                                   capture_output=True, text=True)
                if r.returncode:
                    raise SystemExit(f"Syntax error in {rel}:\n{r.stderr}")

        r = subprocess.run([sys.executable, "manage.py", "makemigrations", "chat", "--noinput"],
                           cwd=ROOT, capture_output=True, text=True)
        print(r.stdout + r.stderr)
        if r.returncode:
            raise SystemExit("makemigrations failed.")
        created.extend(sorted(set(glob.glob(str(ROOT / "chat/migrations/*.py"))) - migrations_before))

        r = subprocess.run([sys.executable, "manage.py", "check"], cwd=ROOT,
                           capture_output=True, text=True)
        print(r.stdout + r.stderr)
        if r.returncode:
            raise SystemExit("manage.py check failed.")
    except BaseException:
        restore()
        say(f"restored originals. Backups: {BACKUP}")
        raise

    r = subprocess.run([sys.executable, "manage.py", "collectstatic", "--noinput"],
                       cwd=ROOT, capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    say("done. Next: python manage.py migrate, then reload the web app.")


if __name__ == "__main__":
    main()