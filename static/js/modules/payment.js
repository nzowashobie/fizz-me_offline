// ============================================================
// payment.js — Payment / Checkout module
// Airtel Money · MTN MoMo · Bank Transfer · Cash
// ============================================================

(function () {
  'use strict';

  // ── Inject modal HTML once ────────────────────────────────────
  (function injectModal() {
    if (document.getElementById('payment-modal-overlay')) return;
    var tpl = [
      '<div id="payment-modal-overlay" class="modal-overlay">',
      '  <div id="payment-modal" class="modal-card" style="width:360px;max-width:96vw;">',
      '    <div class="modal-header" style="background:linear-gradient(135deg,#128c7e,#e6a817);">',
      '      <i class="fas fa-wallet"></i>',
      '      <h3>Complete Payment</h3>',
      '      <button class="modal-close" id="payment-close-btn"><i class="fas fa-times"></i></button>',
      '    </div>',
      '    <div class="modal-body">',
      '      <div id="pm-deal-summary" style="',
      '        background:rgba(230,168,23,.08);border:1px solid rgba(230,168,23,.2);',
      '        border-radius:10px;padding:12px 14px;margin-bottom:18px;">',
      '        <div style="font-size:11px;color:#e6a817;text-transform:uppercase;',
      '             letter-spacing:.7px;font-weight:700;margin-bottom:6px;">Deal Summary</div>',
      '        <div style="display:flex;justify-content:space-between;align-items:center;">',
      '          <div>',
      '            <div style="font-size:13px;color:var(--sub);">Buyer</div>',
      '            <div id="payment-buyer-info" style="font-size:14px;font-weight:600;color:var(--text);"></div>',
      '          </div>',
      '          <div style="font-size:22px;font-weight:800;color:#e6a817;" id="payment-amount">K 0.00</div>',
      '          <div>',
      '            <div style="font-size:13px;color:var(--sub);">Seller</div>',
      '            <div id="payment-seller-info" style="font-size:14px;font-weight:600;color:var(--text);"></div>',
      '          </div>',
      '        </div>',
      '      </div>',
      '      <div style="font-size:10px;color:var(--sub,#aaa);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:6px;">📱 Mobile Money</div>',
      '      <div id="pm-method-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">',
      '        <button class="pm-method-card" data-method="airtel_money">',
      '          <div class="pm-method-icon" style="background:#e0001a;">',
      '            <i class="fas fa-sim-card"></i>',
      '          </div>',
      '          <div class="pm-method-label">Airtel Money</div>',
      '          <div class="pm-method-sub">097 / 077</div>',
      '        </button>',
      '        <button class="pm-method-card" data-method="mtn_money">',
      '          <div class="pm-method-icon" style="background:#ffc107;color:#000;">',
      '            <i class="fas fa-mobile-alt"></i>',
      '          </div>',
      '          <div class="pm-method-label">MTN MoMo</div>',
      '          <div class="pm-method-sub">096 / 076</div>',
      '        </button>',
      '        <button class="pm-method-card" data-method="zamtel_kwacha">',
      '          <div class="pm-method-icon" style="background:#009a44;">',
      '            <i class="fas fa-broadcast-tower"></i>',
      '          </div>',
      '          <div class="pm-method-label">Zamtel Kwacha</div>',
      '          <div class="pm-method-sub">095 / 075</div>',
      '        </button>',
      '      </div>',
      '      <div style="font-size:10px;color:var(--sub,#aaa);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:6px;">Other Methods</div>',
      '      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">',
      '        <button class="pm-method-card" data-method="bank_transfer">',
      '          <div class="pm-method-icon" style="background:#2b579a;">',
      '            <i class="fas fa-university"></i>',
      '          </div>',
      '          <div class="pm-method-label">Bank Transfer</div>',
      '          <div class="pm-method-sub">Zanaco · FNB · Stanbic…</div>',
      '        </button>',
      '        <button class="pm-method-card" data-method="cash">',
      '          <div class="pm-method-icon" style="background:#27ae60;">',
      '            <i class="fas fa-money-bill-wave"></i>',
      '          </div>',
      '          <div class="pm-method-label">Cash</div>',
      '          <div class="pm-method-sub">On pickup / delivery</div>',
      '        </button>',
      '      </div>',
      '      <div id="pm-detail-wrap" style="display:none;">',
      '        <div id="pm-phone-wrap" style="display:none;" class="modal-field">',
      '          <label id="pm-phone-label">Mobile Money Number</label>',
      '          <input id="pm-phone-input" type="tel" class="modal-field input"',
      '                 placeholder="e.g. 0977 123 456" maxlength="15"',
      '                 style="background:var(--mid);border:1px solid var(--border);',
      '                        border-radius:10px;padding:11px 14px;color:var(--text);',
      '                        font-size:14px;outline:none;width:100%;">',
      '          <div class="modal-hint">Enter the registered mobile money number</div>',
      '        </div>',
      '        <div id="pm-account-wrap" style="display:none;" class="modal-field">',
      '          <label>Account Holder Name</label>',
      '          <input id="pm-account-input" type="text"',
      '                 placeholder="e.g. John Banda"',
      '                 style="background:var(--mid);border:1px solid var(--border);',
      '                        border-radius:10px;padding:11px 14px;color:var(--text);',
      '                        font-size:14px;outline:none;width:100%;margin-top:4px;">',
      '        </div>',
      '        <div id="pm-ref-wrap" style="display:none;" class="modal-field">',
      '          <label>Bank & Account / Reference</label>',
      '          <input id="pm-ref-input" type="text"',
      '                 placeholder="e.g. Zanaco — 1234567890"',
      '                 style="background:var(--mid);border:1px solid var(--border);',
      '                        border-radius:10px;padding:11px 14px;color:var(--text);',
      '                        font-size:14px;outline:none;width:100%;margin-top:4px;">',
      '        </div>',
      '        <div id="pm-cash-note" style="display:none;',
      '             background:rgba(39,174,96,.08);border:1px solid rgba(39,174,96,.2);',
      '             border-radius:10px;padding:12px 14px;font-size:13px;',
      '             color:rgba(255,255,255,.75);line-height:1.55;">',
      '          <i class="fas fa-handshake" style="color:#27ae60;margin-right:6px;"></i>',
      '          You and the seller have agreed to settle in cash. ',
      '          Confirm here so the deal is recorded on Asterix.',
      '        </div>',
      '      </div>',
      '      <div id="payment-status" class="modal-status"></div>',
      '      <div class="modal-actions" style="margin-top:14px;">',
      '        <button class="modal-btn secondary" id="payment-cancel-btn">Cancel</button>',
      '        <button class="modal-btn primary" id="payment-confirm-btn" disabled>',
      '          <i class="fas fa-check-circle"></i> Confirm Payment',
      '        </button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');

    var div = document.createElement('div');
    div.innerHTML = tpl;
    document.body.appendChild(div.firstElementChild);

    var style = document.createElement('style');
    style.textContent = [
      '.pm-method-card {',
      '  display:flex;flex-direction:column;align-items:center;gap:6px;',
      '  padding:12px 8px;border-radius:12px;cursor:pointer;',
      '  border:2px solid rgba(255,255,255,.08);',
      '  background:rgba(255,255,255,.04);',
      '  transition:border-color .18s,background .18s,transform .12s;',
      '  -webkit-tap-highlight-color:transparent;',
      '}',
      '.pm-method-card:hover { background:rgba(255,255,255,.09); }',
      '.pm-method-card:active { transform:scale(.96); }',
      '.pm-method-card.active {',
      '  border-color:#e6a817;',
      '  background:rgba(230,168,23,.1);',
      '}',
      '.pm-method-icon {',
      '  width:42px;height:42px;border-radius:12px;',
      '  display:flex;align-items:center;justify-content:center;',
      '  font-size:18px;color:#fff;',
      '}',
      '.pm-method-label {',
      '  font-size:12px;font-weight:700;color:var(--text);',
      '  text-align:center;line-height:1.2;',
      '}',
      '.pm-method-sub {',
      '  font-size:10px;color:var(--sub);text-align:center;',
      '}',
      '.modal-field label {',
      '  display:block;font-size:11px;color:var(--accent2);',
      '  text-transform:uppercase;letter-spacing:.6px;',
      '  font-weight:600;margin-bottom:0;',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  })();

  // ── Payment method config ─────────────────────────────────────
  var METHODS = {
    airtel_money:   { phoneLabel: 'Airtel Money Number',   showPhone: true,  showAccount: false, showRef: false, showCash: false },
    mtn_money:      { phoneLabel: 'MTN MoMo Number',       showPhone: true,  showAccount: false, showRef: false, showCash: false },
    zamtel_kwacha:  { phoneLabel: 'Zamtel Kwacha Number',  showPhone: true,  showAccount: false, showRef: false, showCash: false },
    bank_transfer: { phoneLabel: '',                    showPhone: false, showAccount: true,  showRef: true,  showCash: false },
    cash:          { phoneLabel: '',                    showPhone: false, showAccount: false, showRef: false, showCash: true  },
  };

  // ── State ─────────────────────────────────────────────────────
  var currentDealId = null;
  var currentAmount = null;
  var selectedMethod = null;
  var onSuccessCallback = null;

  // ── DOM helpers ──────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }

  // ── Open ──────────────────────────────────────────────────────
  function open(dealId, amount, buyer, seller, callback) {
    currentDealId = dealId;
    currentAmount = amount;
    onSuccessCallback = callback || null;
    selectedMethod = null;

    el('payment-amount').textContent = 'K ' + (parseFloat(amount) || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2 });
    el('payment-buyer-info').textContent  = buyer  || '—';
    el('payment-seller-info').textContent = seller || '—';
    el('payment-status').textContent  = '';
    el('payment-status').className    = 'modal-status';
    el('payment-confirm-btn').disabled   = true;
    el('payment-confirm-btn').innerHTML  = '<i class="fas fa-check-circle"></i> Confirm Payment';

    document.querySelectorAll('.pm-method-card').forEach(function(c) { c.classList.remove('active'); });
    el('pm-detail-wrap').style.display = 'none';
    showMethodFields(null);

    el('payment-modal-overlay').classList.add('open');
  }

  function close() {
    el('payment-modal-overlay').classList.remove('open');
    currentDealId = null; currentAmount = null; selectedMethod = null;
    onSuccessCallback = null;
  }

  // ── Show/hide dynamic fields ─────────────────────────────────
  function showMethodFields(methodKey) {
    var cfg = METHODS[methodKey] || { showPhone:false, showAccount:false, showRef:false, showCash:false };

    el('pm-phone-wrap').style.display   = cfg.showPhone   ? 'block' : 'none';
    el('pm-account-wrap').style.display = cfg.showAccount ? 'block' : 'none';
    el('pm-ref-wrap').style.display     = cfg.showRef     ? 'block' : 'none';
    el('pm-cash-note').style.display    = cfg.showCash    ? 'block' : 'none';

    if (cfg.showPhone) {
      el('pm-phone-label').textContent = cfg.phoneLabel;
    }

    if (el('pm-phone-input'))   el('pm-phone-input').value   = '';
    if (el('pm-account-input')) el('pm-account-input').value = '';
    if (el('pm-ref-input'))     el('pm-ref-input').value     = '';

    var anyField = cfg.showPhone || cfg.showAccount || cfg.showRef || cfg.showCash;
    el('pm-detail-wrap').style.display = anyField ? 'block' : 'none';
  }

  // ── Validate & collect ────────────────────────────────────────
  function collectPaymentData() {
    var cfg = METHODS[selectedMethod];
    if (!cfg) return null;

    var paymentAccount   = '';
    var paymentReference = '';

    if (cfg.showPhone) {
      paymentAccount = (el('pm-phone-input').value || '').trim();
      if (!paymentAccount) {
        showErr(el('pm-phone-label').textContent + ' is required.');
        return null;
      }
    }
    if (cfg.showAccount) {
      paymentAccount = (el('pm-account-input').value || '').trim();
      if (!paymentAccount) { showErr('Account holder name is required.'); return null; }
    }
    if (cfg.showRef) {
      paymentReference = (el('pm-ref-input').value || '').trim();
      if (!paymentReference) { showErr('Bank / account reference is required.'); return null; }
    }

    return { paymentAccount: paymentAccount, paymentReference: paymentReference };
  }

  function showErr(msg) {
    el('payment-status').textContent = msg;
    el('payment-status').className   = 'modal-status err';
  }

  // ── Submit ────────────────────────────────────────────────────
  function submit() {
    if (!selectedMethod) { showErr('Please select a payment method.'); return; }

    var data = collectPaymentData();
    if (!data) return;

    var btn = el('payment-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…';
    el('payment-status').textContent = '';
    el('payment-status').className   = 'modal-status';

    window.Asterix.deals.completeDeal(
      currentDealId,
      selectedMethod,
      data.paymentAccount,
      data.paymentReference
    )
    .then(function() {
      toast('✅', 'Payment confirmed! Deal completed.');
      close();
      // Call the callback to refresh the chat
      if (typeof onSuccessCallback === 'function') {
        onSuccessCallback();
      }
    })
    .catch(function(err) {
      showErr(err.message || 'Could not complete payment. Please try again.');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Payment';
    });
  }

  // ── Wire events ───────────────────────────────────────────────
  function init() {
    // Event delegation on the whole modal body covers both the mobile-money
    // grid (#pm-method-grid) and the "Other Methods" grid below it.
    document.getElementById('payment-modal').addEventListener('click', function(e) {
      var card = e.target.closest('.pm-method-card');
      if (!card) return;
      document.querySelectorAll('.pm-method-card').forEach(function(c) { c.classList.remove('active'); });
      card.classList.add('active');
      selectedMethod = card.getAttribute('data-method');
      showMethodFields(selectedMethod);
      el('payment-confirm-btn').disabled = false;
      el('payment-status').textContent   = '';
    });

    el('payment-close-btn').addEventListener('click', close);
    el('payment-cancel-btn').addEventListener('click', close);
    el('payment-modal-overlay').addEventListener('click', function(e) {
      if (e.target === this) close();
    });
    el('payment-confirm-btn').addEventListener('click', submit);

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && el('payment-modal-overlay').classList.contains('open')) close();
    });
  }

  // ── Public API ────────────────────────────────────────────────
  window.Asterix = window.Asterix || {};
  window.Asterix.payment = { open: open, close: close };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Asterix] Payment module loaded (with callback support)');
})();