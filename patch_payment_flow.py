#!/usr/bin/env python
"""
patch_payment_flow.py

Seller shares payment details; the buyer pays using them.

  chat/models.py                      Deal.payment_instructions (new field)
  chat/views/views_commerce.py        payment_details: GET for both sides,
                                      POST for the seller only
  chat/urls.py                        /api/deals/payment-details/
  static/js/modules/checkout.js       buyer sees the seller's details and taps
                                      "I have paid"; seller gets a setup sheet

Run from the folder that contains manage.py:
    python patch_payment_flow.py --dry-run
    python patch_payment_flow.py
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
BACKUP = ROOT / "_patch_backup" / f"payment-flow-{datetime.datetime.now():%Y%m%d-%H%M%S}"
MODELS = "chat/models.py"
COMMERCE = "chat/views/views_commerce.py"
URLS = "chat/urls.py"
CHECKOUT = "static/js/modules/checkout.js"

COMMERCE_NEW = r'''

# ─── Payment details: seller shares how to pay, buyer pays ───────────────

def _payment_details_json(deal, me):
    return {
        "deal_id": deal.pk,
        "state": deal.state,
        "final_price": str(deal.final_price),
        "buyer": deal.buyer.username,
        "seller": deal.seller.username,
        "role": "seller" if me == deal.seller else "buyer",
        "payment_method": deal.payment_method or "",
        "payment_account": deal.payment_account or "",
        "payment_instructions": deal.payment_instructions or "",
    }


@login_required
def payment_details(request):
    """
    GET  ?deal_id=N   payment details for a participant (includes their role)
    POST {deal_id, payment_method, payment_account, payment_instructions}
         seller only; deal must be confirmed
    """
    me = request.user

    if request.method == "GET":
        deal_id = request.GET.get("deal_id", "").strip()
        if not deal_id.isdigit():
            return JsonResponse({"error": "deal_id is required"}, status=400)
        try:
            deal = Deal.objects.select_related("buyer", "seller").get(pk=int(deal_id))
        except Deal.DoesNotExist:
            return JsonResponse({"error": "Deal not found"}, status=404)
        if me not in (deal.buyer, deal.seller):
            return JsonResponse({"error": "Not a participant in this deal"}, status=403)
        return JsonResponse(_payment_details_json(deal, me))

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body or b"{}")
    except (ValueError, TypeError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    deal_id = data.get("deal_id")
    method = str(data.get("payment_method") or "").strip()
    account = str(data.get("payment_account") or "").strip()[:200]
    instructions = str(data.get("payment_instructions") or "").strip()[:500]

    if not deal_id:
        return JsonResponse({"error": "deal_id is required"}, status=400)
    if method not in _METHOD_LABELS:
        return JsonResponse({"error": "Choose a valid payment method"}, status=400)
    if method != "cash" and not account:
        return JsonResponse({"error": "Enter the number or account details"}, status=400)

    try:
        deal = Deal.objects.select_related("buyer", "seller", "status").get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)
    if me != deal.seller:
        return JsonResponse({"error": "Only the seller can share payment details"}, status=403)
    if deal.state != "confirmed":
        return JsonResponse(
            {"error": f"Deal must be confirmed first (currently: {deal.state})"}, status=400)

    with transaction.atomic():
        deal.payment_method = method
        deal.payment_account = account
        deal.payment_instructions = instructions
        deal.save(update_fields=["payment_method", "payment_account", "payment_instructions"])

        label = _METHOD_LABELS.get(method, method)
        lines = [f"💳 {deal.seller.username} shared payment details: {label}"]
        if account:
            lines.append(f"Number / account: {account}")
        if instructions:
            lines.append(f"Instructions: {instructions}")
        lines.append(f"Amount due: {_fmt_price(deal.final_price)}")
        _create_system_msg(
            sender=me, recipient=deal.buyer,
            text=f"{_listing_card_text(deal.status)}\n\n" + "\n".join(lines),
            message_type="status_update", deal=deal, status=deal.status,
        )

    return JsonResponse(_payment_details_json(deal, me))
'''

PAY_JS = r'''  var PAY_DETAILS_URL = '/api/deals/payment-details/';

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function _getJSON(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok || d.error) { var e = new Error(d.error || 'Request failed ' + r.status); e.status = r.status; throw e; }
        return d;
      });
    });
  }

  function _payShell(icon, title, bodyHtml) {
    return '<div id="fz-checkout-sheet"><div class="fz-handle"></div>' +
      '<div class="fz-sheet-header"><span style="font-size:20px;">' + icon + '</span>' +
      '<span class="fz-sheet-title">' + title + '</span>' +
      '<button class="fz-sheet-close" id="fz-close-btn"><i class="fas fa-times"></i></button></div>' +
      '<div class="fz-sheet-body">' + bodyHtml + '</div></div>';
  }

  function _amountHTML(amount, other) {
    return '<div style="text-align:center;padding:10px 0 14px;">' +
      '<div style="font-size:11px;color:var(--sub);text-transform:uppercase;letter-spacing:.7px;font-weight:700;margin-bottom:4px;">Amount Due</div>' +
      '<div style="font-size:38px;font-weight:900;color:#e6a817;">' + fmt(amount || 0) + '</div>' +
      '<div style="font-size:12px;color:var(--sub);">' + _esc(other || 'Seller') + '</div></div>';
  }

  function _detailsCardHTML(d) {
    return '<div style="background:rgba(37,211,102,.07);border:1px solid rgba(37,211,102,.25);border-radius:14px;padding:14px 16px;margin-bottom:14px;">' +
      '<div class="fz-section-label" style="margin-top:0;">Pay this way</div>' +
      '<div style="font-size:16px;font-weight:800;color:var(--text);">' + _esc(_methodLabel(d.payment_method)) + '</div>' +
      (d.payment_account ? '<div style="font-size:18px;font-weight:900;color:#25d366;margin-top:6px;word-break:break-all;">' + _esc(d.payment_account) + '</div>' : '') +
      (d.payment_instructions ? '<div style="font-size:12px;color:var(--sub);margin-top:8px;line-height:1.5;">' + _esc(d.payment_instructions) + '</div>' : '') +
      '</div>';
  }

  function _renderPayStep(d) {
    _state.details = d;
    var seller = d.seller;

    if (d.role === 'seller') {
      var sellerNote = d.payment_method
        ? 'Your details are shared with ' + _esc(d.buyer) + '. Waiting for them to pay.'
        : 'Share how ' + _esc(d.buyer) + ' should pay you. They can pay once you do.';
      _openOverlay(_payShell('💳', 'Payment',
        _amountHTML(d.final_price, d.buyer) +
        (d.payment_method ? _detailsCardHTML(d) : '') +
        '<div class="fz-escrow-notice">' + sellerNote + '</div>' +
        '<button class="fz-cta fz-cta-confirm" id="fz-edit-details-btn"><i class="fas fa-edit"></i> ' +
        (d.payment_method ? 'Edit payment details' : 'Add payment details') + '</button>'));
      _el('fz-close-btn').onclick = _closeOverlay;
      _el('fz-edit-details-btn').onclick = function () { openSellerPaymentSetup(d.deal_id, d.final_price, d.buyer); };
      return;
    }

    if (!d.payment_method) {
      _openOverlay(_payShell('💳', 'Payment',
        _amountHTML(d.final_price, seller) +
        '<div class="fz-escrow-notice">Waiting for ' + _esc(seller) + ' to share their payment details. You can pay as soon as they do.</div>' +
        '<button class="fz-cta fz-cta-pay" id="fz-refresh-pay-btn"><i class="fas fa-sync-alt"></i> Check again</button>'));
      _el('fz-close-btn').onclick = _closeOverlay;
      _el('fz-refresh-pay-btn').onclick = function () { _openPayStep(); };
      return;
    }

    _openOverlay(_payShell('💳', 'Complete Payment',
      _amountHTML(d.final_price, seller) + _detailsCardHTML(d) +
      '<div class="fz-section-label">Your payment reference (optional)</div>' +
      '<input id="fz-pay-ref" class="fz-input" type="text" placeholder="e.g. transaction ID or bank reference">' +
      '<div id="fz-checkout-status"></div>' +
      '<button class="fz-cta fz-cta-pay" id="fz-pay-btn"><i class="fas fa-check-circle"></i> I have paid</button>' +
      '<div class="fz-input-hint" style="text-align:center;margin-top:8px;">Tap this only after you have sent the money.</div>'));
    _el('fz-close-btn').onclick = _closeOverlay;
    _el('fz-pay-btn').onclick = _submitPay;
  }

  function _openPayStep() {
    _state.step = 'pay';
    var id = (_state.deal && (_state.deal.id || _state.deal.deal_id)) || null;
    if (!id) { toast('Error', 'Missing deal. Please try from chat.'); return; }
    _openOverlay(_payShell('💳', 'Payment',
      '<div style="text-align:center;padding:40px 0;color:var(--sub);"><i class="fas fa-spinner fa-spin"></i> Loading…</div>'));
    _el('fz-close-btn').onclick = _closeOverlay;
    _getJSON(PAY_DETAILS_URL + '?deal_id=' + encodeURIComponent(id))
      .then(_renderPayStep)
      .catch(function (err) {
        _openOverlay(_payShell('💳', 'Payment',
          '<div class="fz-escrow-notice" style="border-color:rgba(241,92,109,.3);">' +
          _esc(err.message || 'Could not load payment details.') + '</div>'));
        _el('fz-close-btn').onclick = _closeOverlay;
      });
  }

  function _submitPay() {
    var d = _state.details;
    if (!d || !d.payment_method) { _setStatus('The seller has not shared payment details yet.', 'err'); return; }
    var ref = ((_el('fz-pay-ref') && _el('fz-pay-ref').value) || '').trim();
    var btn = _el('fz-pay-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming…';
    _setStatus('');
    window.Asterix.deals.completeDeal(d.deal_id, d.payment_method, d.payment_account, ref)
      .then(function (res) {
        _state.deal = res.deal || res || _state.deal;
        toast('💚 Payment confirmed!', 'Deal complete. Track your delivery.');
        _openTrackStep();
        if (typeof _state.onDone === 'function') _state.onDone('completed', _state.deal);
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> I have paid';
        _setStatus(err.message || 'Could not confirm payment.', 'err');
      });
  }

  // ── Seller: share payment details ───────────────────────────────
  function openSellerPaymentSetup(dealId, amount, buyer) {
    _state.deal = { id: dealId, deal_id: dealId };
    _getJSON(PAY_DETAILS_URL + '?deal_id=' + encodeURIComponent(dealId))
      .then(function (d) { _renderSellerSetup(d, amount, buyer); })
      .catch(function (err) { toast('Error', err.message || 'Could not load payment details.'); });
  }

  function _renderSellerSetup(d, amount, buyer) {
    var chosen = d.payment_method || null;
    _openOverlay(_payShell('💳', 'Your Payment Details',
      _amountHTML(amount || d.final_price, buyer || d.buyer) +
      '<div class="fz-section-label">📱 Mobile Money</div>' +
      _mobileMethodGridHTML(chosen) +
      '<div style="margin-top:8px;">' + _otherMethodGridHTML(chosen) + '</div>' +
      '<div class="fz-section-label">Number or account details</div>' +
      '<input id="fz-setup-account" class="fz-input" type="text" maxlength="200" placeholder="e.g. 097 123 456 · Mary Phiri" value="' + _esc(d.payment_account || '') + '">' +
      '<div class="fz-input-hint">Mobile money: the number and the name on it. Bank: bank, account name and number. Cash: leave blank.</div>' +
      '<div class="fz-section-label">Instructions for the buyer (optional)</div>' +
      '<textarea id="fz-setup-instr" class="fz-input" maxlength="500" rows="3" placeholder="e.g. Pay on collection">' + _esc(d.payment_instructions || '') + '</textarea>' +
      '<div id="fz-checkout-status"></div>' +
      '<button class="fz-cta fz-cta-confirm" id="fz-setup-save"' + (chosen ? '' : ' disabled') + '><i class="fas fa-save"></i> Save and share with buyer</button>'));
    _el('fz-close-btn').onclick = _closeOverlay;

    var selected = chosen;
    document.querySelectorAll('#fz-checkout-overlay .fz-method-card').forEach(function (card) {
      card.onclick = function () {
        document.querySelectorAll('#fz-checkout-overlay .fz-method-card').forEach(function (c) { c.classList.remove('active'); });
        card.classList.add('active');
        selected = card.dataset.method;
        _el('fz-setup-save').disabled = false;
        _setStatus('');
      };
    });
    _el('fz-setup-save').onclick = function () { _saveSellerSetup(d.deal_id, selected); };
  }

  function _saveSellerSetup(dealId, method) {
    if (!method) { _setStatus('Choose how the buyer should pay you.', 'err'); return; }
    var account = ((_el('fz-setup-account') && _el('fz-setup-account').value) || '').trim();
    var instr   = ((_el('fz-setup-instr') && _el('fz-setup-instr').value) || '').trim();
    if (method !== 'cash' && !account) { _setStatus('Enter the number or account details.', 'err'); return; }

    var btn = _el('fz-setup-save');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    _setStatus('');
    postJSON(PAY_DETAILS_URL, {
      deal_id: dealId,
      payment_method: method,
      payment_account: account,
      payment_instructions: instr,
    }).then(function () {
      toast('💳 Shared with buyer', 'They can pay now.');
      _closeOverlay();
      if (typeof _state.onDone === 'function') _state.onDone('details_set');
    }).catch(function (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Save and share with buyer';
      _setStatus(err.message || 'Could not save.', 'err');
    });
  }

  // ═══════════════════════════════════════════════════════════════
'''


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


def apply_block(text, start, end, new, label, done):
    if done in text:
        say(f"ok      {label} (already applied)")
        return text
    if text.count(start) != 1:
        raise SystemExit(f"{label}: start marker found {text.count(start)} times. Stopping.")
    s = text.index(start)
    e = text.index(end, s + len(start))
    return text[:s] + new + text[e:]


def edit_models(t):
    if "payment_instructions" in t:
        say(f"ok      {MODELS} (field already present)")
        return t
    found = list(re.finditer(r"^([ \t]*)payment_reference[ \t]*=.*$", t, re.M))
    if len(found) != 1:
        raise SystemExit(f"{MODELS}: expected one payment_reference field, found {len(found)}. Stopping.")
    m = found[0]
    return t[:m.end()] + f"\n{m.group(1)}payment_instructions = models.TextField(blank=True, default='')" + t[m.end():]


def edit_commerce(t):
    if "def payment_details(request):" in t:
        say(f"ok      {COMMERCE} (payment_details already present)")
        return t
    return t.rstrip() + "\n" + COMMERCE_NEW


def edit_urls(t):
    if "deal_payment_details" in t:
        say(f"ok      {URLS} (route already present)")
        return t
    t = apply_once(t, "from . import views\n",
                   "from . import views\nfrom .views.views_commerce import payment_details as deal_payment_details\n",
                   f"{URLS} import")
    t = apply_once(t, "name='complete_deal'),",
                   "name='complete_deal'),\n    path('api/deals/payment-details/', deal_payment_details, name='deal-payment-details'),",
                   f"{URLS} route")
    return t


def edit_checkout(t):
    if "openSellerPaymentSetup: openSellerPaymentSetup" in t:
        say(f"ok      {CHECKOUT} (already applied)")
        return t
    t = apply_block(t, "  function _openPayStep() {", "  // STEP 4 — DELIVERY TRACKER",
                    PAY_JS, CHECKOUT, "function _renderPayStep(")
    t = apply_once(t, "window.Asterix.checkout = {",
                   "window.Asterix.checkout = {\n    openSellerPaymentSetup: openSellerPaymentSetup,",
                   f"{CHECKOUT} public API")
    return t


def main():
    if not (ROOT / "manage.py").exists():
        raise SystemExit("Run this from the folder that contains manage.py.")

    paths = [MODELS, COMMERCE, URLS, CHECKOUT]
    original = {}
    for rel in paths:
        p = ROOT / rel
        if not p.exists():
            raise SystemExit(f"{rel} not found. Stopping.")
        original[rel] = p.read_text(encoding="utf-8")

    new = dict(original)
    new[MODELS] = edit_models(new[MODELS])
    new[COMMERCE] = edit_commerce(new[COMMERCE])
    new[URLS] = edit_urls(new[URLS])
    new[CHECKOUT] = edit_checkout(new[CHECKOUT])

    changed = [rel for rel in paths if new[rel] != original[rel]]
    if not changed:
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
    say(f"backups: {BACKUP}")

    migrations_before = set(glob.glob(str(ROOT / "chat/migrations/*.py")))
    created = []

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
        if CHECKOUT in changed and shutil.which("node"):
            r = subprocess.run(["node", "--check", CHECKOUT], cwd=ROOT,
                               capture_output=True, text=True)
            if r.returncode:
                raise SystemExit(f"Syntax error in {CHECKOUT}:\n{r.stderr}")

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