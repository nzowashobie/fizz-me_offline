// ============================================================
// checkout.js — Fizzme Full Commerce Flow
//
// Zambian marketplace soul:
//   "Fimo fyonse filemona ku mutwe" — Everything shows at the top.
//   Transparency first: buyer sees exactly what they are paying for,
//   seller confirms, money is tracked, delivery is confirmed.
//
// Flow:
//   1. Buyer taps "Buy Now" (single or selected items from grid)
//   2. Checkout sheet opens — shows item(s), price, mobile money
//   3. takeListing() → creates Deal (pending_confirmation)
//   4. Both parties confirm → deal moves to confirmed
//   5. Payment sheet opens → completeDeal() → completed
//   6. Delivery tracker opens automatically
//
// Also handles the in-chat commerce panel "Buy" action so that
// the chat banner and deal cards stay in sync, and a MULTI-ITEM
// basket flow so a buyer can select several listings from the
// same seller in one chat thread and check out together — each
// item still gets its own deal, confirmation, payment record and
// delivery tracker; the basket just carries you through them
// one after another instead of one at a time.
// ============================================================

(function () {
  'use strict';

  // ── CSRF ──────────────────────────────────────────────────────
  function getCsrf() {
    var c = document.cookie.split('; ').find(function (r) { return r.startsWith('csrftoken='); });
    return c ? c.split('=')[1] : (window.ASTERIX && window.ASTERIX.CSRF) || '';
  }

  function postJSON(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok || d.error) { var e = new Error(d.error || 'Request failed ' + r.status); e.data = d; e.status = r.status; throw e; }
        return d;
      });
    });
  }

  // ── One-time CSS ──────────────────────────────────────────────
  (function injectCSS() {
    if (document.getElementById('fz-checkout-css')) return;
    var s = document.createElement('style');
    s.id  = 'fz-checkout-css';
    s.textContent = [
      /* Sheet overlay */
      '#fz-checkout-overlay{',
      '  position:fixed;inset:0;z-index:25000;',
      '  background:rgba(0,0,0,0.72);',
      '  display:flex;flex-direction:column;justify-content:flex-end;',
      '  animation:fzFadeIn .2s ease;',
      '}',
      '@keyframes fzFadeIn{from{opacity:0}to{opacity:1}}',
      '@keyframes fzSlideUp{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}',

      /* Sheet card */
      '#fz-checkout-sheet{',
      '  background:linear-gradient(160deg,#1a2020 0%,#111616 100%);',
      '  border-radius:24px 24px 0 0;',
      '  border-top:2px solid #e6a817;',
      '  max-height:92dvh;overflow-y:auto;',
      '  padding:0 0 calc(16px + env(safe-area-inset-bottom));',
      '  animation:fzSlideUp .25s cubic-bezier(.32,1.1,.6,1);',
      '  scrollbar-width:thin;scrollbar-color:#2a3030 transparent;',
      '}',

      /* Handle bar */
      '.fz-handle{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.15);',
      '  margin:12px auto 0;}',

      /* Header strip */
      '.fz-sheet-header{',
      '  display:flex;align-items:center;gap:12px;',
      '  padding:14px 20px 12px;',
      '  border-bottom:1px solid rgba(255,255,255,.06);',
      '  position:sticky;top:0;z-index:2;',
      '  background:linear-gradient(160deg,#1a2020,#111616);',
      '}',
      '.fz-sheet-title{flex:1;font-size:16px;font-weight:800;color:#e6a817;letter-spacing:-.2px;}',
      '.fz-sheet-close{',
      '  background:rgba(255,255,255,.08);border:none;',
      '  width:30px;height:30px;border-radius:50%;',
      '  color:var(--sub,#8696a0);font-size:15px;cursor:pointer;',
      '  display:flex;align-items:center;justify-content:center;',
      '  transition:background .15s;',
      '}',
      '.fz-sheet-close:hover{background:rgba(255,255,255,.18);color:#fff;}',

      /* Body */
      '.fz-sheet-body{padding:16px 20px;}',

      /* Item pills */
      '.fz-item-strip{',
      '  display:flex;gap:10px;align-items:center;',
      '  background:rgba(230,168,23,.07);',
      '  border:1px solid rgba(230,168,23,.18);',
      '  border-radius:14px;padding:10px 14px;margin-bottom:14px;',
      '}',
      '.fz-item-thumb{',
      '  width:54px;height:54px;border-radius:10px;',
      '  object-fit:cover;flex-shrink:0;background:var(--mid,#2a2f2f);',
      '  border:2px solid rgba(230,168,23,.35);',
      '}',
      '.fz-item-info{flex:1;min-width:0;}',
      '.fz-item-label{font-size:10px;color:#e6a817;font-weight:700;',
      '  text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;}',
      '.fz-item-caption{font-size:13px;font-weight:700;color:var(--text,#e9edef);',
      '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.fz-item-price{font-size:20px;font-weight:900;color:#e6a817;flex-shrink:0;}',

      /* Multi-item scroll row (photo picker within ONE listing) */
      '.fz-multi-row{',
      '  display:flex;gap:8px;overflow-x:auto;',
      '  padding:4px 0 10px;margin-bottom:10px;',
      '  scrollbar-width:none;',
      '}',
      '.fz-multi-row::-webkit-scrollbar{display:none;}',
      '.fz-multi-thumb{',
      '  flex-shrink:0;width:68px;height:68px;border-radius:12px;',
      '  object-fit:cover;border:2px solid rgba(230,168,23,.25);',
      '  cursor:pointer;transition:border-color .15s;',
      '}',
      '.fz-multi-thumb.active{border-color:#e6a817;box-shadow:0 0 0 3px rgba(230,168,23,.2);}',

      /* Section label */
      '.fz-section-label{',
      '  font-size:10px;color:var(--sub,#8696a0);',
      '  text-transform:uppercase;letter-spacing:.7px;font-weight:700;',
      '  margin-bottom:8px;margin-top:14px;',
      '}',

      /* Payment method cards */
      '.fz-method-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;}',
      '.fz-method-grid.two{grid-template-columns:1fr 1fr;}',
      '.fz-method-card{',
      '  display:flex;flex-direction:column;align-items:center;gap:6px;',
      '  padding:12px 6px;border-radius:14px;cursor:pointer;',
      '  border:2px solid rgba(255,255,255,.07);',
      '  background:rgba(255,255,255,.04);',
      '  transition:border-color .18s,background .18s,transform .12s;',
      '  -webkit-tap-highlight-color:transparent;',
      '}',
      '.fz-method-card:hover{background:rgba(255,255,255,.09);}',
      '.fz-method-card:active{transform:scale(.96);}',
      '.fz-method-card.active{border-color:#e6a817;background:rgba(230,168,23,.1);}',
      '.fz-method-icon{',
      '  width:42px;height:42px;border-radius:12px;',
      '  display:flex;align-items:center;justify-content:center;',
      '  font-size:18px;color:#fff;',
      '}',
      '.fz-method-label{font-size:11px;font-weight:700;color:var(--text,#e9edef);text-align:center;line-height:1.2;}',
      '.fz-method-sub{font-size:10px;color:var(--sub,#8696a0);text-align:center;}',

      /* Input */
      '.fz-input{',
      '  width:100%;box-sizing:border-box;',
      '  background:rgba(255,255,255,.06);',
      '  border:1px solid rgba(255,255,255,.12);',
      '  border-radius:12px;padding:12px 14px;',
      '  color:var(--text,#e9edef);font-size:14px;outline:none;',
      '  transition:border-color .15s;',
      '}',
      '.fz-input:focus{border-color:#e6a817;}',
      '.fz-input::placeholder{color:var(--sub,#8696a0);}',
      '.fz-input-hint{font-size:11px;color:var(--sub,#8696a0);margin-top:4px;}',

      /* Escrow notice */
      '.fz-escrow-notice{',
      '  background:rgba(37,211,102,.07);',
      '  border:1px solid rgba(37,211,102,.18);',
      '  border-radius:12px;padding:12px 14px;',
      '  font-size:12px;color:rgba(255,255,255,.7);line-height:1.6;',
      '  margin-top:12px;',
      '}',
      '.fz-escrow-notice strong{color:#25d366;}',

      /* Status bar */
      '#fz-checkout-status{',
      '  min-height:20px;font-size:13px;text-align:center;',
      '  margin-top:10px;transition:color .2s;',
      '}',
      '#fz-checkout-status.err{color:#f15c6d;}',
      '#fz-checkout-status.ok{color:#25d366;}',

      /* CTA button */
      '.fz-cta{',
      '  width:100%;margin-top:14px;padding:15px;',
      '  border:none;border-radius:25px;',
      '  font-size:15px;font-weight:800;cursor:pointer;',
      '  letter-spacing:.2px;',
      '  transition:opacity .15s,transform .12s;',
      '}',
      '.fz-cta:active{transform:scale(.97);}',
      '.fz-cta:disabled{opacity:.45;cursor:default;transform:none;}',
      '.fz-cta-buy{background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;}',
      '.fz-cta-confirm{background:linear-gradient(135deg,#e6a817,#c98a00);color:#000;}',
      '.fz-cta-pay{background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;}',

      /* Step breadcrumb */
      '.fz-steps{display:flex;align-items:center;gap:0;margin-bottom:16px;}',
      '.fz-step{flex:1;text-align:center;font-size:10px;font-weight:700;',
      '  text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,.25);',
      '  padding:6px 0;border-bottom:2px solid rgba(255,255,255,.08);transition:color .2s;}',
      '.fz-step.active{color:#e6a817;border-bottom-color:#e6a817;}',
      '.fz-step.done{color:#25d366;border-bottom-color:#25d366;}',

      /* Delivery stepper */
      '.fz-delivery-step{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;}',
      '.fz-ds-icon{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}',
      '.fz-ds-icon.done{background:#25d366;}',
      '.fz-ds-icon.active{background:rgba(37,211,102,.2);border:2px solid #25d366;}',
      '.fz-ds-icon.pending{background:rgba(255,255,255,.07);}',
      '.fz-ds-connector{width:2px;height:18px;margin:3px auto;background:rgba(255,255,255,.1);}',
      '.fz-ds-connector.done{background:#25d366;}',

      /* Multi-item basket rows */
      '.fz-multi-deal-row{',
      '  display:flex;align-items:center;gap:10px;',
      '  padding:10px 12px;border-radius:12px;',
      '  background:rgba(255,255,255,.03);',
      '  border:1px solid rgba(255,255,255,.07);',
      '  margin-bottom:8px;transition:border-color .2s,background .2s;',
      '}',
      '.fz-multi-deal-row.done{border-color:rgba(37,211,102,.35);background:rgba(37,211,102,.06);}',
      '.fz-multi-deal-row.error{border-color:rgba(241,92,109,.35);background:rgba(241,92,109,.06);}',
      '.fz-multi-mini-btn{',
      '  background:rgba(230,168,23,.15);border:1px solid rgba(230,168,23,.35);',
      '  color:#e6a817;border-radius:14px;padding:6px 13px;',
      '  font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;',
      '}',
      '.fz-multi-mini-btn:disabled{opacity:.4;cursor:default;}',
    ].join('');
    document.head.appendChild(s);
  })();

  // ── State ─────────────────────────────────────────────────────
  var _state = {
    overlay:        null,
    step:           'buy',      // 'buy' | 'confirm' | 'pay' | 'track'
    status:         null,       // full status object
    selectedMedia:  null,       // { url, caption, index, total } | null
    deal:           null,       // deal object returned by server
    method:         null,
    onDone:         null,
  };

  // ── Helpers ───────────────────────────────────────────────────
  function fmt(price) {
    return 'K ' + (parseFloat(price) || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2 });
  }

  function _el(id) { return document.getElementById(id); }

  function _setStatus(msg, cls) {
    var el = _el('fz-checkout-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className   = cls ? 'fz-checkout-status ' + cls : '';
  }

  function _openOverlay(html) {
    _closeOverlay();
    var wrap = document.createElement('div');
    wrap.id  = 'fz-checkout-overlay';
    wrap.innerHTML = html;
    wrap.addEventListener('click', function (e) { if (e.target === wrap) _closeOverlay(); });
    document.body.appendChild(wrap);
    _state.overlay = wrap;
  }

  function _closeOverlay() {
    if (_state.overlay) { _state.overlay.remove(); _state.overlay = null; }
    var old = _el('fz-checkout-overlay');
    if (old) old.remove();
  }

  // ── STEP BREADCRUMB ───────────────────────────────────────────
  var STEP_LABELS = ['Buy', 'Confirm', 'Pay', 'Done'];
  var STEP_KEYS   = ['buy', 'confirm', 'pay', 'track'];

  function _stepBreadcrumb(current) {
    var ci = STEP_KEYS.indexOf(current);
    return '<div class="fz-steps">' +
      STEP_LABELS.map(function (label, i) {
        var cls = i < ci ? 'done' : i === ci ? 'active' : '';
        return '<div class="fz-step ' + cls + '">' +
          (i < ci ? '✓ ' : '') + label + '</div>';
      }).join('') +
    '</div>';
  }

  // ── ITEM DISPLAY ──────────────────────────────────────────────
  function _itemStripHTML(status, selectedMedia) {
    var hasSelected = selectedMedia && selectedMedia.url;
    var thumbUrl    = hasSelected ? selectedMedia.url : (status.media_url || '');
    var caption     = hasSelected
      ? (selectedMedia.caption || status.caption || 'Item')
      : (status.caption || 'Item');
    var photoLabel  = hasSelected
      ? 'Photo ' + (selectedMedia.index + 1) + ' of ' + selectedMedia.total
      : (status.media_count > 1 ? status.media_count + ' photos' : 'Listing');

    return [
      '<div class="fz-item-strip">',
      thumbUrl
        ? '<img class="fz-item-thumb" src="' + thumbUrl + '" onerror="this.style.display=\'none\'">'
        : '<div class="fz-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:22px;">🏷️</div>',
      '<div class="fz-item-info">',
      '  <div class="fz-item-label">' + photoLabel + '</div>',
      '  <div class="fz-item-caption">' + caption.slice(0, 55) + '</div>',
      status.collection_point
        ? '<div style="font-size:11px;color:var(--sub);margin-top:2px;">📍 ' + status.collection_point + '</div>'
        : '',
      '</div>',
      status.price ? '<div class="fz-item-price">' + fmt(status.price) + '</div>' : '',
      '</div>',
    ].join('');
  }

  // Multi-photo row when no specific photo was selected
  function _multiPhotoRow(status) {
    var mediaList = status.media_list || [];
    if (mediaList.length <= 1) return '';
    var thumbs = mediaList.slice(0, 8).map(function (m, i) {
      return '<img class="fz-multi-thumb" src="' + m.url + '" data-idx="' + i + '" ' +
        'title="Photo ' + (i+1) + '" onerror="this.style.display=\'none\'">';
    }).join('');
    return [
      '<div class="fz-section-label">📸 ' + mediaList.length + ' photos — scroll to browse</div>',
      '<div class="fz-multi-row" id="fz-multi-row">' + thumbs + '</div>',
    ].join('');
  }

  // ── ESCROW NOTICE ─────────────────────────────────────────────
  var ESCROW_HTML = [
    '<div class="fz-escrow-notice">',
    '  <strong>🔒 Fizzme Escrow</strong><br>',
    '  Your payment is only confirmed when <em>both</em> you and the seller agree. ',
    '  The seller then arranges delivery or pickup — ',
    '  you release payment after receiving the item.',
    '  <span style="color:#e6a817;font-weight:700;">No receive, no pay.</span>',
    '</div>',
  ].join('');

  // ── Method fields markup (shared by single + multi flows) ─────
  var METHOD_FIELDS_HTML = [
    '<div id="fz-method-fields" style="display:none;margin-top:12px;">',
    '  <div id="fz-mobile-wrap" style="display:none;">',
    '    <label id="fz-mobile-label" class="fz-section-label"></label>',
    '    <input id="fz-mobile-input" class="fz-input" type="tel" maxlength="15" placeholder="e.g. 0977 123 456">',
    '    <div id="fz-mobile-hint" class="fz-input-hint"></div>',
    '  </div>',
    '  <div id="fz-account-wrap" style="display:none;margin-top:10px;">',
    '    <label class="fz-section-label">Account Holder</label>',
    '    <input id="fz-account-input" class="fz-input" type="text" placeholder="e.g. John Banda">',
    '  </div>',
    '  <div id="fz-ref-wrap" style="display:none;margin-top:10px;">',
    '    <label class="fz-section-label">Bank & Account Reference</label>',
    '    <input id="fz-ref-input" class="fz-input" type="text" placeholder="e.g. Zanaco — 1234567890">',
    '  </div>',
    '  <div id="fz-cash-note" style="display:none;">',
    '    <div class="fz-escrow-notice" style="border-color:rgba(39,174,96,.3);background:rgba(39,174,96,.07);">',
    '      <strong style="color:#27ae60;">💵 Cash Deal</strong><br>',
    '      Settle in cash at pickup or delivery. This still creates a record on Fizzme ',
    '      so both sides are protected.',
    '    </div>',
    '  </div>',
    '</div>',
  ].join('');

  function _mobileMethodGridHTML(activeMethod) {
    return [
      '<div class="fz-method-grid" id="fz-method-grid">',
      '  <button class="fz-method-card' + (activeMethod === 'airtel_money' ? ' active' : '') + '" data-method="airtel_money">',
      '    <div class="fz-method-icon" style="background:#e0001a;"><i class="fas fa-sim-card"></i></div>',
      '    <div class="fz-method-label">Airtel Money</div>',
      '    <div class="fz-method-sub">097 · 077</div>',
      '  </button>',
      '  <button class="fz-method-card' + (activeMethod === 'mtn_money' ? ' active' : '') + '" data-method="mtn_money">',
      '    <div class="fz-method-icon" style="background:#ffc107;color:#000;"><i class="fas fa-mobile-alt"></i></div>',
      '    <div class="fz-method-label">MTN MoMo</div>',
      '    <div class="fz-method-sub">096 · 076</div>',
      '  </button>',
      '  <button class="fz-method-card' + (activeMethod === 'zamtel_kwacha' ? ' active' : '') + '" data-method="zamtel_kwacha">',
      '    <div class="fz-method-icon" style="background:#009a44;"><i class="fas fa-broadcast-tower"></i></div>',
      '    <div class="fz-method-label">Zamtel</div>',
      '    <div class="fz-method-sub">095 · 075</div>',
      '  </button>',
      '</div>',
    ].join('');
  }

  function _otherMethodGridHTML(activeMethod) {
    return [
      '<div class="fz-method-grid two" id="fz-method-grid-other">',
      '  <button class="fz-method-card' + (activeMethod === 'bank_transfer' ? ' active' : '') + '" data-method="bank_transfer">',
      '    <div class="fz-method-icon" style="background:#2b579a;"><i class="fas fa-university"></i></div>',
      '    <div class="fz-method-label">Bank Transfer</div>',
      '    <div class="fz-method-sub">Zanaco · FNB · Stanbic</div>',
      '  </button>',
      '  <button class="fz-method-card' + (activeMethod === 'cash' ? ' active' : '') + '" data-method="cash">',
      '    <div class="fz-method-icon" style="background:#27ae60;"><i class="fas fa-money-bill-wave"></i></div>',
      '    <div class="fz-method-label">Cash</div>',
      '    <div class="fz-method-sub">Pickup · Delivery</div>',
      '  </button>',
      '</div>',
    ].join('');
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 1 — BUY SHEET (single item)
  // ═══════════════════════════════════════════════════════════════
  function openBuySheet(status, selectedMedia, onDone) {
    _state.status        = status;
    _state.selectedMedia = selectedMedia || null;
    _state.deal          = null;
    _state.method        = null;
    _state.step          = 'buy';
    _state.onDone        = onDone || null;

    var html = [
      '<div id="fz-checkout-sheet">',
      '  <div class="fz-handle"></div>',
      '  <div class="fz-sheet-header">',
      '    <span style="font-size:20px;">🛒</span>',
      '    <span class="fz-sheet-title">Buy Now</span>',
      '    <button class="fz-sheet-close" id="fz-close-btn"><i class="fas fa-times"></i></button>',
      '  </div>',
      '  <div class="fz-sheet-body">',

      _stepBreadcrumb('buy'),

      _itemStripHTML(status, selectedMedia),

      // Multi-photo row only when no specific selection
      (!selectedMedia && (status.media_list || []).length > 1)
        ? _multiPhotoRow(status)
        : '',

      '<div class="fz-section-label">📱 Mobile Money</div>',
      _mobileMethodGridHTML(null),
      '<div class="fz-section-label">Other</div>',
      _otherMethodGridHTML(null),

      METHOD_FIELDS_HTML,

      // Delivery address
      '<div style="margin-top:12px;">',
      '  <label class="fz-section-label">📍 Delivery / Pickup Address</label>',
      '  <input id="fz-address-input" class="fz-input" type="text" placeholder="e.g. Shoprite Kitwe · Chisokone Market">',
      '</div>',
      '<div style="margin-top:10px;">',
      '  <label class="fz-section-label">📝 Note to Seller (optional)</label>',
      '  <input id="fz-note-input" class="fz-input" type="text" placeholder="e.g. Call when near">',
      '</div>',

      ESCROW_HTML,

      '<div id="fz-checkout-status"></div>',
      '<button class="fz-cta fz-cta-buy" id="fz-buy-btn" disabled>',
      '  <i class="fas fa-shopping-cart"></i> Send Purchase Request',
      '</button>',

      '  </div>',
      '</div>',
    ].join('');

    _openOverlay(html);
    _wireBuySheet();
  }

  var METHOD_CONFIG = {
    airtel_money:  { label: 'Airtel Money Number', hint: 'Starts with 097 or 077', mobile: true  },
    mtn_money:     { label: 'MTN MoMo Number',     hint: 'Starts with 096 or 076', mobile: true  },
    zamtel_kwacha: { label: 'Zamtel Number',        hint: 'Starts with 095 or 075', mobile: true  },
    bank_transfer: { label: '',                     hint: '',                       mobile: false, account: true, ref: true  },
    cash:          { label: '',                     hint: '',                       mobile: false, cash: true },
  };

  function _wireBuySheet() {
    _el('fz-close-btn').onclick = _closeOverlay;

    // Method cards (both grids)
    document.querySelectorAll('#fz-checkout-overlay .fz-method-card').forEach(function (card) {
      card.onclick = function () {
        document.querySelectorAll('#fz-checkout-overlay .fz-method-card').forEach(function (c) { c.classList.remove('active'); });
        card.classList.add('active');
        _state.method = card.dataset.method;
        _showMethodFields(_state.method);
        _el('fz-buy-btn').disabled = false;
        _setStatus('');
      };
    });

    // Multi-photo row — tap to set selectedMedia
    var multiRow = _el('fz-multi-row');
    if (multiRow) {
      multiRow.addEventListener('click', function (e) {
        var thumb = e.target.closest('.fz-multi-thumb');
        if (!thumb) return;
        multiRow.querySelectorAll('.fz-multi-thumb').forEach(function (t) { t.classList.remove('active'); });
        thumb.classList.add('active');
        var idx = parseInt(thumb.dataset.idx, 10);
        var ml  = (_state.status.media_list || []);
        _state.selectedMedia = { url: ml[idx].url, caption: ml[idx].caption || _state.status.caption || '', index: idx, total: ml.length };
      });
    }

    _el('fz-buy-btn').onclick = _submitBuy;
  }

  function _showMethodFields(method) {
    var cfg    = METHOD_CONFIG[method] || {};
    var wrap   = _el('fz-method-fields');
    var mWrap  = _el('fz-mobile-wrap');
    var aWrap  = _el('fz-account-wrap');
    var rWrap  = _el('fz-ref-wrap');
    var cNote  = _el('fz-cash-note');

    wrap.style.display  = 'block';
    mWrap.style.display = cfg.mobile   ? 'block' : 'none';
    aWrap.style.display = cfg.account  ? 'block' : 'none';
    rWrap.style.display = cfg.ref      ? 'block' : 'none';
    cNote.style.display = cfg.cash     ? 'block' : 'none';

    if (cfg.mobile) {
      _el('fz-mobile-label').textContent = cfg.label;
      _el('fz-mobile-hint').textContent  = cfg.hint;
      _el('fz-mobile-input').placeholder = 'e.g. ' + (method === 'airtel_money' ? '097' : method === 'mtn_money' ? '096' : '095') + ' 123 456';
      setTimeout(function () { _el('fz-mobile-input').focus(); }, 100);
    }
  }

  // Validate + collect payment fields for the currently-rendered method
  // fields block. Shared by the multi-item basket flow.
  function _collectPaymentFields(method) {
    var cfg       = METHOD_CONFIG[method] || {};
    var mobileNum = cfg.mobile  ? (_el('fz-mobile-input').value  || '').trim() : '';
    var account   = cfg.account ? (_el('fz-account-input').value || '').trim() : '';
    var ref       = cfg.ref     ? (_el('fz-ref-input').value     || '').trim() : '';

    if (cfg.mobile && !mobileNum) {
      _el('fz-mobile-input').style.borderColor = '#f15c6d';
      _el('fz-mobile-input').focus();
      return { error: 'Please enter your ' + cfg.label + '.' };
    }
    if (cfg.account && !account) return { error: 'Account holder name is required.' };
    if (cfg.ref && !ref)         return { error: 'Bank / account reference is required.' };

    return { mobileNum: mobileNum, account: account, ref: ref };
  }

  function _submitBuy() {
    var method  = _state.method;
    if (!method) { _setStatus('Please select a payment method.', 'err'); return; }

    var fields = _collectPaymentFields(method);
    if (fields.error) { _setStatus(fields.error, 'err'); return; }

    var address = (_el('fz-address-input').value || '').trim();
    var note    = (_el('fz-note-input').value    || '').trim();

    var deliveryParts = [address];
    if (fields.mobileNum) deliveryParts.push('Pay to: ' + fields.mobileNum);
    if (fields.account)   deliveryParts.push('Account: ' + fields.account);
    if (fields.ref)       deliveryParts.push('Ref: ' + fields.ref);
    var deliveryString = deliveryParts.filter(Boolean).join(' | ');

    // Attach selected photo info to note
    var fullNote = note;
    if (_state.selectedMedia && _state.selectedMedia.index !== undefined) {
      var photoNote = 'Interested in photo ' + (_state.selectedMedia.index + 1);
      if (_state.selectedMedia.total > 1) photoNote += ' of ' + _state.selectedMedia.total;
      fullNote = fullNote ? photoNote + ' · ' + fullNote : photoNote;
    }

    var btn = _el('fz-buy-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending request…';
    _setStatus('');

    var statusId = _state.status.status_id;
    window.Asterix.deals.takeListing(statusId, method, deliveryString, fullNote)
      .then(function (res) {
        _state.deal = res.deal || res;
        toast('🛒 Request sent!', 'The seller will confirm your order.');
        _openConfirmStep();
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-shopping-cart"></i> Send Purchase Request';
        _setStatus(err.message || 'Could not send purchase request. Please try again.', 'err');
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2 — CONFIRM STEP (shown after takeListing)
  // Both sides must confirm before payment
  // ═══════════════════════════════════════════════════════════════
  function _openConfirmStep() {
    _state.step = 'confirm';
    var deal    = _state.deal;
    var status  = _state.status;

    var html = [
      '<div id="fz-checkout-sheet">',
      '  <div class="fz-handle"></div>',
      '  <div class="fz-sheet-header">',
      '    <span style="font-size:20px;">🤝</span>',
      '    <span class="fz-sheet-title">Confirm Deal</span>',
      '    <button class="fz-sheet-close" id="fz-close-btn"><i class="fas fa-times"></i></button>',
      '  </div>',
      '  <div class="fz-sheet-body">',

      _stepBreadcrumb('confirm'),

      _itemStripHTML(status, _state.selectedMedia),

      '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);',
      '  border-radius:14px;padding:14px 16px;margin-bottom:14px;">',
      '  <div class="fz-section-label" style="margin-top:0;">Deal Summary</div>',
      '  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">',
      '    <div style="font-size:13px;color:var(--sub);">Payment via</div>',
      '    <div style="font-size:13px;font-weight:700;color:var(--text);">' + (_methodLabel(_state.method)) + '</div>',
      '  </div>',
      status.collection_point
        ? '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">' +
          '<div style="font-size:13px;color:var(--sub);">Collection</div>' +
          '<div style="font-size:13px;font-weight:700;color:var(--text);">' + status.collection_point + '</div>' +
          '</div>'
        : '',
      '  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;',
      '    padding-top:10px;border-top:1px solid rgba(255,255,255,.06);">',
      '    <div style="font-size:14px;color:var(--sub);">Total</div>',
      '    <div style="font-size:22px;font-weight:900;color:#e6a817;">' + fmt(status.price || 0) + '</div>',
      '  </div>',
      '</div>',

      ESCROW_HTML,

      '<div class="fz-escrow-notice" style="margin-top:10px;border-color:rgba(37,211,102,.2);background:rgba(37,211,102,.06);">',
      '  <strong style="color:#25d366;">📲 What happens next</strong><br>',
      '  1. The seller gets your request in chat right now.<br>',
      '  2. When both of you confirm, you proceed to payment.<br>',
      '  3. Collect your item, then release payment. Simple.',
      '</div>',

      '<div id="fz-checkout-status"></div>',
      '<button class="fz-cta fz-cta-confirm" id="fz-confirm-btn">',
      '  <i class="fas fa-check-circle"></i> I Confirm This Deal',
      '</button>',
      '<button style="width:100%;margin-top:10px;background:transparent;border:none;',
      '  color:var(--sub);font-size:13px;padding:8px;cursor:pointer;" id="fz-skip-confirm-btn">',
      '  I\'ll confirm in chat later',
      '</button>',

      '  </div>',
      '</div>',
    ].join('');

    _openOverlay(html);
    _el('fz-close-btn').onclick = _handleConfirmClose;
    _el('fz-confirm-btn').onclick = _submitConfirm;
    _el('fz-skip-confirm-btn').onclick = _handleConfirmClose;
  }

  function _methodLabel(method) {
    var labels = {
      airtel_money:  'Airtel Money',
      mtn_money:     'MTN MoMo',
      zamtel_kwacha: 'Zamtel Kwacha',
      bank_transfer: 'Bank Transfer',
      cash:          'Cash',
    };
    return labels[method] || method;
  }

  function _submitConfirm() {
    var deal = _state.deal;
    if (!deal) { _openPayStep(); return; }
    var dealId = deal.id || deal.deal_id;
    if (!dealId) { _openPayStep(); return; }

    var btn = _el('fz-confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming…';
    _setStatus('');

    window.Asterix.deals.confirmDeal(dealId)
      .then(function (res) {
        _state.deal = res.deal || res || _state.deal;
        toast('✅ Confirmed!', 'Now complete your payment.');
        _openPayStep();
      })
      .catch(function (err) {
        // Deal may already be confirmed by server — proceed anyway
        if (err.status === 400 && err.data && (err.data.error || '').includes('already')) {
          _openPayStep(); return;
        }
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> I Confirm This Deal';
        _setStatus(err.message || 'Could not confirm.', 'err');
      });
  }

  function _handleConfirmClose() {
    // Navigate to seller chat so they can finish in chat
    _closeOverlay();
    var item = window.Asterix && window.Asterix.status && window.Asterix.status._lastViewerItem;
    var sellerUsername = (_state.status && _state.status.username) || (item && item.username);
    if (sellerUsername && window.Asterix && window.Asterix.chat) {
      window.Asterix.chat.addConversationItem({ username: sellerUsername, profile_picture: '' });
      window.Asterix.chat.openConversation(sellerUsername);
      setTimeout(function () { window.Asterix.chat.loadMessages(sellerUsername, true); }, 300);
    }
    if (typeof _state.onDone === 'function') _state.onDone('confirmed');
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 3 — PAYMENT STEP
  // ═══════════════════════════════════════════════════════════════
  function _openPayStep() {
    _state.step = 'pay';
    var deal    = _state.deal;
    var status  = _state.status;
    var dealId  = (deal && (deal.id || deal.deal_id)) || null;

    var html = [
      '<div id="fz-checkout-sheet">',
      '  <div class="fz-handle"></div>',
      '  <div class="fz-sheet-header">',
      '    <span style="font-size:20px;">💳</span>',
      '    <span class="fz-sheet-title">Complete Payment</span>',
      '    <button class="fz-sheet-close" id="fz-close-btn"><i class="fas fa-times"></i></button>',
      '  </div>',
      '  <div class="fz-sheet-body">',

      _stepBreadcrumb('pay'),

      // Deal amount hero
      '<div style="text-align:center;padding:10px 0 14px;">',
      '  <div style="font-size:11px;color:var(--sub);text-transform:uppercase;letter-spacing:.7px;font-weight:700;margin-bottom:4px;">Amount Due</div>',
      '  <div style="font-size:38px;font-weight:900;color:#e6a817;">' + fmt(status.price || 0) + '</div>',
      '  <div style="font-size:12px;color:var(--sub);">to ' + (status.username || 'Seller') + '</div>',
      '</div>',

      '<div class="fz-section-label">📱 Mobile Money</div>',
      _mobileMethodGridHTML(_state.method),
      '<div style="margin-top:8px;">' + _otherMethodGridHTML(_state.method) + '</div>',

      '<div id="fz-method-fields" style="margin-top:12px;display:' + (_state.method ? 'block' : 'none') + ';">',
      '  <div id="fz-mobile-wrap" style="display:' + (METHOD_CONFIG[_state.method] && METHOD_CONFIG[_state.method].mobile ? 'block' : 'none') + ';">',
      '    <label class="fz-section-label" id="fz-mobile-label">' + (METHOD_CONFIG[_state.method] ? METHOD_CONFIG[_state.method].label : '') + '</label>',
      '    <input id="fz-mobile-input" class="fz-input" type="tel" maxlength="15" placeholder="e.g. 0977 123 456">',
      '    <div id="fz-mobile-hint" class="fz-input-hint"></div>',
      '  </div>',
      '  <div id="fz-account-wrap" style="display:none;margin-top:10px;">',
      '    <label class="fz-section-label">Account Holder</label>',
      '    <input id="fz-account-input" class="fz-input" type="text" placeholder="e.g. John Banda">',
      '  </div>',
      '  <div id="fz-ref-wrap" style="display:none;margin-top:10px;">',
      '    <label class="fz-section-label">Bank & Account Reference</label>',
      '    <input id="fz-ref-input" class="fz-input" type="text" placeholder="e.g. Zanaco — 1234567890">',
      '  </div>',
      '  <div id="fz-cash-note" style="display:' + (METHOD_CONFIG[_state.method] && METHOD_CONFIG[_state.method].cash ? 'block' : 'none') + ';">',
      '    <div class="fz-escrow-notice" style="border-color:rgba(39,174,96,.3);background:rgba(39,174,96,.07);">',
      '      <strong style="color:#27ae60;">💵 Cash Deal</strong><br>',
      '      Confirm to record the cash agreement on Fizzme. ',
      '      Both sides are protected.',
      '    </div>',
      '  </div>',
      '</div>',

      '<div id="fz-checkout-status"></div>',
      '<button class="fz-cta fz-cta-pay" id="fz-pay-btn"' + (!_state.method ? ' disabled' : '') + '>',
      '  <i class="fas fa-check-circle"></i> Confirm Payment',
      '</button>',

      '  </div>',
      '</div>',
    ].join('');

    _openOverlay(html);
    _el('fz-close-btn').onclick = _closeOverlay;

    // Wire method cards
    document.querySelectorAll('#fz-checkout-overlay .fz-method-card').forEach(function (card) {
      card.onclick = function () {
        document.querySelectorAll('#fz-checkout-overlay .fz-method-card').forEach(function (c) { c.classList.remove('active'); });
        card.classList.add('active');
        _state.method = card.dataset.method;
        _showPayFields(_state.method);
        _el('fz-pay-btn').disabled = false;
        _setStatus('');
      };
    });

    _el('fz-pay-btn').onclick = function () { _submitPay(dealId); };
  }

  function _showPayFields(method) {
    var cfg = METHOD_CONFIG[method] || {};
    _el('fz-method-fields').style.display     = 'block';
    _el('fz-mobile-wrap').style.display        = cfg.mobile  ? 'block' : 'none';
    _el('fz-account-wrap').style.display       = cfg.account ? 'block' : 'none';
    _el('fz-ref-wrap').style.display           = cfg.ref     ? 'block' : 'none';
    _el('fz-cash-note').style.display          = cfg.cash    ? 'block' : 'none';
    if (cfg.mobile) {
      _el('fz-mobile-label').textContent = cfg.label;
      setTimeout(function () { _el('fz-mobile-input').focus(); }, 100);
    }
  }

  function _submitPay(dealId) {
    var method = _state.method;
    if (!method) { _setStatus('Please select a payment method.', 'err'); return; }

    var fields = _collectPaymentFields(method);
    if (fields.error) { _setStatus(fields.error, 'err'); return; }

    var account = fields.account || fields.mobileNum;
    var ref     = fields.ref;

    var btn = _el('fz-pay-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…';
    _setStatus('');

    var id = dealId || (_state.deal && (_state.deal.id || _state.deal.deal_id));
    if (!id) { _setStatus('Missing deal ID. Please try from chat.', 'err'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Payment'; return; }

    window.Asterix.deals.completeDeal(id, method, account, ref)
      .then(function (res) {
        _state.deal = res.deal || res || _state.deal;
        toast('💚 Payment confirmed!', 'Deal complete. Track your delivery.');
        _openTrackStep();
        if (typeof _state.onDone === 'function') _state.onDone('completed', _state.deal);
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Payment';
        _setStatus(err.message || 'Could not confirm payment.', 'err');
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 4 — DELIVERY TRACKER STEP
  // ═══════════════════════════════════════════════════════════════
  var DELIVERY_STAGES = [
    { key: 'order_placed',     icon: '📦', label: 'Order Placed'    },
    { key: 'seller_confirmed', icon: '✅', label: 'Seller Confirmed' },
    { key: 'in_transit',       icon: '🚚', label: 'In Transit'       },
    { key: 'delivered',        icon: '📬', label: 'Delivered'        },
    { key: 'payment_released', icon: '💰', label: 'Payment Released' },
  ];

  function _openTrackStep() {
    _state.step = 'track';
    var deal    = _state.deal;
    var status  = _state.status;

    var stepsHtml = DELIVERY_STAGES.map(function (stage, i) {
      var isDone   = i === 0; // only first stage done at this point
      var isActive = i === 0;
      var iconCls  = isDone ? 'done' : isActive ? 'active' : 'pending';
      var connCls  = isDone ? 'done' : '';
      return [
        '<div class="fz-delivery-step">',
        '  <div style="display:flex;flex-direction:column;align-items:center;">',
        '    <div class="fz-ds-icon ' + iconCls + '">' + stage.icon + '</div>',
        i < DELIVERY_STAGES.length - 1 ? '    <div class="fz-ds-connector ' + connCls + '"></div>' : '',
        '  </div>',
        '  <div style="flex:1;padding-top:6px;">',
        '    <div style="font-size:14px;font-weight:' + (isActive ? '700' : '500') + ';color:' + (isDone || isActive ? 'var(--text)' : 'var(--sub)') + ';">' + stage.label + '</div>',
        isDone ? '<div style="font-size:11px;color:var(--sub);margin-top:2px;">Just now</div>' : '',
        '  </div>',
        '</div>',
      ].join('');
    }).join('');

    var html = [
      '<div id="fz-checkout-sheet">',
      '  <div class="fz-handle"></div>',
      '  <div class="fz-sheet-header">',
      '    <span style="font-size:20px;">🚚</span>',
      '    <span class="fz-sheet-title">Delivery Tracker</span>',
      '    <button class="fz-sheet-close" id="fz-close-btn"><i class="fas fa-times"></i></button>',
      '  </div>',
      '  <div class="fz-sheet-body">',

      _stepBreadcrumb('track'),

      _itemStripHTML(status, _state.selectedMedia),

      '<div style="margin:14px 0;">' + stepsHtml + '</div>',

      '<div class="fz-escrow-notice" style="border-color:rgba(230,168,23,.2);">',
      '  <strong style="color:#e6a817;">🔒 Your payment is safe</strong><br>',
      '  The seller is arranging your item now. You\'ll confirm delivery in chat, ',
      '  then release payment. <strong style="color:#25d366;">No receive, no pay.</strong>',
      '</div>',

      '<button class="fz-cta" id="fz-chat-btn" style="background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;margin-top:16px;">',
      '  <i class="fas fa-comment-dots"></i> Open Chat with Seller',
      '</button>',
      '<button class="fz-cta" id="fz-full-track-btn" style="margin-top:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--text);">',
      '  <i class="fas fa-map-marker-alt"></i> Full Delivery Details',
      '</button>',

      '  </div>',
      '</div>',
    ].join('');

    _openOverlay(html);
    _el('fz-close-btn').onclick = _closeOverlay;
    _el('fz-chat-btn').onclick  = function () {
      _closeOverlay();
      var sellerUsername = _state.status && _state.status.username;
      if (sellerUsername && window.Asterix && window.Asterix.chat) {
        window.Asterix.chat.addConversationItem({ username: sellerUsername, profile_picture: '' });
        window.Asterix.chat.openConversation(sellerUsername);
        setTimeout(function () { window.Asterix.chat.loadMessages(sellerUsername, true); }, 300);
      }
    };
    _el('fz-full-track-btn').onclick = function () {
      var dealId = _state.deal && (_state.deal.id || _state.deal.deal_id);
      if (dealId && window.Asterix && window.Asterix.pro) {
        window.Asterix.pro.openDeliveryPanel(dealId);
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MULTI-ITEM BASKET FLOW
  // "In case they are multiple items the user selected" — the buyer
  // ticks several listings from the same seller in chat, then hits
  // one "Buy Selected". Each item still gets its own real deal,
  // confirmation, payment and delivery tracker — this just walks
  // the buyer through all of them together instead of one at a time.
  // ═══════════════════════════════════════════════════════════════
  var _multi = {
    items:  [],   // [{ status, deal, confirmed, paid, error }]
    method: null,
    step:   'buy',
    onDone: null,
  };

  function openMultiCheckout(statuses, onDone) {
    if (!statuses || !statuses.length) return;
    // Single item — just use the normal one-item flow.
    if (statuses.length === 1) { openBuySheet(statuses[0], null, onDone); return; }

    _multi.items  = statuses.map(function (s) { return { status: s, deal: null, confirmed: false, paid: false, error: null }; });
    _multi.method = null;
    _multi.step   = 'buy';
    _multi.onDone = onDone || null;

    _renderMultiBuy();
  }

  function _multiTotal(filterFn) {
    var items = filterFn ? _multi.items.filter(filterFn) : _multi.items;
    return items.reduce(function (sum, it) { return sum + (parseFloat(it.status.price) || 0); }, 0);
  }

  function _multiItemRowHTML(it) {
    return [
      '<div class="fz-item-strip" style="margin-bottom:8px;">',
      it.status.media_url
        ? '<img class="fz-item-thumb" style="width:44px;height:44px;" src="' + it.status.media_url + '" onerror="this.style.display=\'none\'">'
        : '<div class="fz-item-thumb" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;">🏷️</div>',
      '<div class="fz-item-info">',
      '  <div class="fz-item-caption">' + (it.status.caption || 'Item').slice(0, 40) + '</div>',
      it.status.username ? '<div style="font-size:11px;color:var(--sub);">seller: ' + it.status.username + '</div>' : '',
      '</div>',
      '<div class="fz-item-price" style="font-size:15px;">' + fmt(it.status.price) + '</div>',
      '</div>',
    ].join('');
  }

  function _renderMultiBuy() {
    _multi.step = 'buy';
    var itemsHtml = _multi.items.map(_multiItemRowHTML).join('');

    var html = [
      '<div id="fz-checkout-sheet">',
      '  <div class="fz-handle"></div>',
      '  <div class="fz-sheet-header">',
      '    <span style="font-size:20px;">🛍️</span>',
      '    <span class="fz-sheet-title">Buy ' + _multi.items.length + ' Items</span>',
      '    <button class="fz-sheet-close" id="fz-close-btn"><i class="fas fa-times"></i></button>',
      '  </div>',
      '  <div class="fz-sheet-body">',

      _stepBreadcrumb('buy'),

      '<div class="fz-section-label">🧺 Your Basket</div>',
      itemsHtml,
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0 2px;border-top:1px solid rgba(255,255,255,.08);margin-top:2px;">',
      '  <span style="font-size:13px;color:var(--sub);">Total (' + _multi.items.length + ' items)</span>',
      '  <span style="font-size:20px;font-weight:900;color:#e6a817;">' + fmt(_multiTotal()) + '</span>',
      '</div>',

      '<div class="fz-section-label">📱 Mobile Money</div>',
      _mobileMethodGridHTML(null),
      '<div class="fz-section-label">Other</div>',
      _otherMethodGridHTML(null),

      METHOD_FIELDS_HTML,

      '<div style="margin-top:12px;">',
      '  <label class="fz-section-label">📍 Delivery / Pickup Address</label>',
      '  <input id="fz-address-input" class="fz-input" type="text" placeholder="e.g. Shoprite Kitwe · Chisokone Market">',
      '</div>',
      '<div style="margin-top:10px;">',
      '  <label class="fz-section-label">📝 Note to Seller (optional)</label>',
      '  <input id="fz-note-input" class="fz-input" type="text" placeholder="e.g. Call when near">',
      '</div>',

      ESCROW_HTML,
      '<div class="fz-escrow-notice" style="margin-top:8px;border-color:rgba(230,168,23,.2);">',
      '  <strong style="color:#e6a817;">🧺 One basket, many hands</strong><br>',
      '  Each item still gets its own confirmation, payment record and delivery ',
      '  tracker — we just carry you through them together, one after another.',
      '</div>',

      '<div id="fz-checkout-status"></div>',
      '<button class="fz-cta fz-cta-buy" id="fz-buy-btn" disabled>',
      '  <i class="fas fa-shopping-basket"></i> Send ' + _multi.items.length + ' Purchase Requests',
      '</button>',

      '  </div>',
      '</div>',
    ].join('');

    _openOverlay(html);
    _wireMultiBuySheet();
  }

  function _wireMultiBuySheet() {
    _el('fz-close-btn').onclick = _closeOverlay;
    document.querySelectorAll('#fz-checkout-overlay .fz-method-card').forEach(function (card) {
      card.onclick = function () {
        document.querySelectorAll('#fz-checkout-overlay .fz-method-card').forEach(function (c) { c.classList.remove('active'); });
        card.classList.add('active');
        _multi.method = card.dataset.method;
        _showMethodFields(_multi.method);
        _el('fz-buy-btn').disabled = false;
        _setStatus('');
      };
    });
    _el('fz-buy-btn').onclick = _submitMultiBuy;
  }

  function _submitMultiBuy() {
    var method = _multi.method;
    if (!method) { _setStatus('Please select a payment method.', 'err'); return; }

    var fields = _collectPaymentFields(method);
    if (fields.error) { _setStatus(fields.error, 'err'); return; }

    var address = (_el('fz-address-input').value || '').trim();
    var note    = (_el('fz-note-input').value    || '').trim();
    var deliveryParts = [address];
    if (fields.mobileNum) deliveryParts.push('Pay to: ' + fields.mobileNum);
    if (fields.account)   deliveryParts.push('Account: ' + fields.account);
    if (fields.ref)       deliveryParts.push('Ref: ' + fields.ref);
    var deliveryString = deliveryParts.filter(Boolean).join(' | ');

    var btn = _el('fz-buy-btn');
    btn.disabled = true;
    _setStatus('');

    var i = 0;
    function next() {
      if (i >= _multi.items.length) { _openMultiConfirm(); return; }
      var it = _multi.items[i];
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending ' + (i + 1) + ' of ' + _multi.items.length + '…';
      window.Asterix.deals.takeListing(it.status.status_id, method, deliveryString, note)
        .then(function (res) { it.deal = res.deal || res; i++; next(); })
        .catch(function (err) { it.error = err.message || 'Could not create this deal.'; i++; next(); });
    }
    next();
  }

  // ── MULTI CONFIRM ────────────────────────────────────────────
  function _openMultiConfirm() {
    _multi.step = 'confirm';

    var rows = _multi.items.map(function (it, idx) {
      if (it.error) {
        return [
          '<div class="fz-multi-deal-row error">',
          '  <div style="flex:1;"><div style="font-size:13px;font-weight:700;">' + (it.status.caption || 'Item').slice(0, 30) + '</div>',
          '  <div style="font-size:11px;color:#f15c6d;">⚠️ ' + it.error + '</div></div>',
          '</div>',
        ].join('');
      }
      var label = it.confirmed ? '✅ Confirmed' : 'Awaiting confirmation';
      return [
        '<div class="fz-multi-deal-row' + (it.confirmed ? ' done' : '') + '">',
        '  <div style="flex:1;min-width:0;">',
        '    <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (it.status.caption || 'Item').slice(0, 30) + '</div>',
        '    <div style="font-size:11px;color:var(--sub);">' + fmt(it.status.price) + ' · ' + label + '</div>',
        '  </div>',
        it.confirmed ? '' : '<button class="fz-multi-mini-btn" data-confirm-idx="' + idx + '">Confirm</button>',
        '</div>',
      ].join('');
    }).join('');

    var anyPending = _multi.items.some(function (it) { return !it.error && !it.confirmed; });
    var anyConfirmedAlready = _multi.items.some(function (it) { return it.confirmed; });

    var html = [
      '<div id="fz-checkout-sheet">',
      '  <div class="fz-handle"></div>',
      '  <div class="fz-sheet-header">',
      '    <span style="font-size:20px;">🤝</span>',
      '    <span class="fz-sheet-title">Confirm ' + _multi.items.length + ' Deals</span>',
      '    <button class="fz-sheet-close" id="fz-close-btn"><i class="fas fa-times"></i></button>',
      '  </div>',
      '  <div class="fz-sheet-body">',
      _stepBreadcrumb('confirm'),
      rows,
      ESCROW_HTML,
      '<div id="fz-checkout-status"></div>',
      anyPending ? '<button class="fz-cta fz-cta-confirm" id="fz-confirm-all-btn"><i class="fas fa-check-double"></i> Confirm All</button>' : '',
      (!anyPending && anyConfirmedAlready) ? '<button class="fz-cta fz-cta-pay" id="fz-goto-pay-btn"><i class="fas fa-arrow-right"></i> Continue to Payment</button>' : '',
      '  </div>',
      '</div>',
    ].join('');

    _openOverlay(html);
    _el('fz-close-btn').onclick = _closeOverlay;

    document.querySelectorAll('[data-confirm-idx]').forEach(function (btn) {
      btn.onclick = function () {
        btn.disabled = true;
        btn.textContent = '…';
        _confirmOne(parseInt(btn.dataset.confirmIdx, 10), function () { _openMultiConfirm(); });
      };
    });
    var allBtn = _el('fz-confirm-all-btn');
    if (allBtn) allBtn.onclick = _confirmAllRemaining;
    var gotoPay = _el('fz-goto-pay-btn');
    if (gotoPay) gotoPay.onclick = _openMultiPay;
  }

  function _confirmOne(idx, cb) {
    var it = _multi.items[idx];
    if (!it || it.error || it.confirmed || !it.deal) { if (cb) cb(); return; }
    var dealId = it.deal.id || it.deal.deal_id;
    window.Asterix.deals.confirmDeal(dealId)
      .then(function () { it.confirmed = true; if (cb) cb(); })
      .catch(function (err) {
        if (err.status === 400 && err.data && (err.data.error || '').includes('already')) { it.confirmed = true; }
        else { it.error = err.message || 'Could not confirm.'; }
        if (cb) cb();
      });
  }

  function _confirmAllRemaining() {
    var btn = _el('fz-confirm-all-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming…'; }

    var pending = [];
    _multi.items.forEach(function (it, i) { if (!it.error && !it.confirmed) pending.push(i); });

    var p = Promise.resolve();
    pending.forEach(function (i) {
      p = p.then(function () { return new Promise(function (res) { _confirmOne(i, res); }); });
    });
    p.then(function () {
      var anyConfirmed = _multi.items.some(function (it) { return it.confirmed; });
      if (anyConfirmed) { toast('✅ Confirmed', 'Now pay for what\'s confirmed.'); _openMultiPay(); }
      else _openMultiConfirm();
    });
  }

  // ── MULTI PAY ─────────────────────────────────────────────────
  function _openMultiPay() {
    _multi.step = 'pay';
    var payable = _multi.items.filter(function (it) { return it.confirmed && !it.paid; });
    var total   = _multiTotal(function (it) { return it.confirmed && !it.paid; });

    var rows = _multi.items.filter(function (it) { return !it.error; }).map(function (it) {
      var label = it.paid ? '✅ Paid' : it.confirmed ? 'Ready to pay' : '⏳ Not yet confirmed';
      return [
        '<div class="fz-multi-deal-row' + (it.paid ? ' done' : '') + '">',
        '  <div style="flex:1;"><div style="font-size:13px;font-weight:700;">' + (it.status.caption || 'Item').slice(0, 30) + '</div>',
        '  <div style="font-size:11px;color:var(--sub);">' + fmt(it.status.price) + ' · ' + label + '</div></div>',
        '</div>',
      ].join('');
    }).join('');

    var html = [
      '<div id="fz-checkout-sheet">',
      '  <div class="fz-handle"></div>',
      '  <div class="fz-sheet-header">',
      '    <span style="font-size:20px;">💳</span>',
      '    <span class="fz-sheet-title">Pay ' + payable.length + ' of ' + _multi.items.length + '</span>',
      '    <button class="fz-sheet-close" id="fz-close-btn"><i class="fas fa-times"></i></button>',
      '  </div>',
      '  <div class="fz-sheet-body">',
      _stepBreadcrumb('pay'),

      '<div style="text-align:center;padding:6px 0 14px;">',
      '  <div style="font-size:11px;color:var(--sub);text-transform:uppercase;letter-spacing:.7px;font-weight:700;">Amount Due</div>',
      '  <div style="font-size:34px;font-weight:900;color:#e6a817;">' + fmt(total) + '</div>',
      '</div>',

      rows,

      payable.length ? [
        '<div class="fz-section-label">📱 Mobile Money</div>',
        _mobileMethodGridHTML(_multi.method),
        '<div style="margin-top:8px;">' + _otherMethodGridHTML(_multi.method) + '</div>',
        METHOD_FIELDS_HTML,
      ].join('') : '',

      '<div id="fz-checkout-status"></div>',
      payable.length ? '<button class="fz-cta fz-cta-pay" id="fz-pay-all-btn" disabled><i class="fas fa-check-circle"></i> Pay All (' + fmt(total) + ')</button>' : '',
      '  </div>',
      '</div>',
    ].join('');

    _openOverlay(html);
    _el('fz-close-btn').onclick = _closeOverlay;

    document.querySelectorAll('#fz-checkout-overlay .fz-method-card').forEach(function (card) {
      card.onclick = function () {
        document.querySelectorAll('#fz-checkout-overlay .fz-method-card').forEach(function (c) { c.classList.remove('active'); });
        card.classList.add('active');
        _multi.method = card.dataset.method;
        _showMethodFields(_multi.method);
        var b = _el('fz-pay-all-btn'); if (b) b.disabled = false;
        _setStatus('');
      };
    });

    var payAllBtn = _el('fz-pay-all-btn');
    if (payAllBtn) payAllBtn.onclick = _submitMultiPayAll;
  }

  function _payOne(it, method, fields, cb) {
    if (it.error || it.paid || !it.confirmed || !it.deal) { cb(); return; }
    var dealId = it.deal.id || it.deal.deal_id;
    window.Asterix.deals.completeDeal(dealId, method, fields.account || fields.mobileNum, fields.ref)
      .then(function (res) { it.paid = true; it.deal = res.deal || res || it.deal; cb(); })
      .catch(function (err) { it.error = err.message || 'Payment failed.'; cb(); });
  }

  function _submitMultiPayAll() {
    var method = _multi.method;
    if (!method) { _setStatus('Please select a payment method.', 'err'); return; }

    var fields = _collectPaymentFields(method);
    if (fields.error) { _setStatus(fields.error, 'err'); return; }

    var btn = _el('fz-pay-all-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…';

    var payable = _multi.items.filter(function (it) { return it.confirmed && !it.paid && !it.error; });
    var p = Promise.resolve();
    payable.forEach(function (it) {
      p = p.then(function () { return new Promise(function (res) { _payOne(it, method, fields, res); }); });
    });
    p.then(function () {
      var paidCount = _multi.items.filter(function (it) { return it.paid; }).length;
      toast('💚 Payments processed', paidCount + ' of ' + _multi.items.length + ' items completed.');
      _openMultiTrack();
      if (typeof _multi.onDone === 'function') _multi.onDone('completed', _multi.items);
    });
  }

  // ── MULTI TRACK / SUMMARY ────────────────────────────────────
  function _openMultiTrack() {
    _multi.step = 'track';

    var rows = _multi.items.map(function (it) {
      if (it.error) {
        return [
          '<div class="fz-multi-deal-row error">',
          '  <div style="flex:1;font-size:13px;">' + (it.status.caption || 'Item').slice(0, 30),
          '  <div style="font-size:11px;color:#f15c6d;">⚠️ ' + it.error + '</div></div>',
          '</div>',
        ].join('');
      }
      var dealId = it.deal && (it.deal.id || it.deal.deal_id);
      var label  = it.paid ? '✅ Paid — tracking delivery' : it.confirmed ? '⏳ Confirmed, unpaid' : '🔔 Awaiting confirmation';
      return [
        '<div class="fz-multi-deal-row' + (it.paid ? ' done' : '') + '">',
        '  <div style="flex:1;min-width:0;">',
        '    <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (it.status.caption || 'Item').slice(0, 30) + '</div>',
        '    <div style="font-size:11px;color:var(--sub);">' + fmt(it.status.price) + ' · ' + label + '</div>',
        '  </div>',
        (dealId && it.paid) ? '<button class="fz-multi-mini-btn" data-track-id="' + dealId + '">Track</button>' : '',
        '</div>',
      ].join('');
    }).join('');

    var html = [
      '<div id="fz-checkout-sheet">',
      '  <div class="fz-handle"></div>',
      '  <div class="fz-sheet-header">',
      '    <span style="font-size:20px;">🚚</span>',
      '    <span class="fz-sheet-title">Order Summary</span>',
      '    <button class="fz-sheet-close" id="fz-close-btn"><i class="fas fa-times"></i></button>',
      '  </div>',
      '  <div class="fz-sheet-body">',
      _stepBreadcrumb('track'),
      rows,
      '<div class="fz-escrow-notice" style="border-color:rgba(230,168,23,.2);">',
      '  <strong style="color:#e6a817;">🔒 Ma kwacha ali pa kati</strong> — your money for ',
      '  each item sits safe in escrow. Sellers arrange delivery, you confirm receipt, ',
      '  then each payment releases. <strong style="color:#25d366;">No receive, no pay.</strong>',
      '</div>',
      '<button class="fz-cta" id="fz-multi-done-btn" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--text);margin-top:14px;">Done</button>',
      '  </div>',
      '</div>',
    ].join('');

    _openOverlay(html);
    _el('fz-close-btn').onclick = _closeOverlay;
    _el('fz-multi-done-btn').onclick = _closeOverlay;
    document.querySelectorAll('[data-track-id]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.dataset.trackId;
        if (window.Asterix && window.Asterix.pro) window.Asterix.pro.openDeliveryPanel(id);
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  /**
   * openCheckout(status, selectedMedia, onDone)
   *
   * status       — the status object from viewer.playlist
   * selectedMedia — { url, caption, index, total } or null
   * onDone       — optional callback(step, deal)
   */
  function openCheckout(status, selectedMedia, onDone) {
    openBuySheet(status, selectedMedia, onDone);
  }

  /**
   * openMultiCheckout(statuses, onDone)
   *
   * statuses — array of status objects (all from the same seller)
   * onDone   — optional callback(step, items[])
   */
  // (defined above as openMultiCheckout)

  /**
   * openPaymentForDeal(dealId, amount, buyer, seller, onDone)
   * Entry point from existing deal cards in chat (keeps backwards compat).
   */
  function openPaymentForDeal(dealId, amount, buyer, seller, onDone) {
    _state.deal   = { id: dealId, deal_id: dealId };
    _state.status = { price: amount, username: seller };
    _state.selectedMedia = null;
    _state.step   = 'pay';
    _state.method = null;
    _state.onDone = onDone || null;
    _openPayStep();
  }

  window.Asterix = window.Asterix || {};
  window.Asterix.checkout = {
    open:               openCheckout,
    openMulti:          openMultiCheckout,
    openPaymentForDeal: openPaymentForDeal,
    openTrack:          _openTrackStep,
    close:              _closeOverlay,
  };

  // ── Backwards-compat shim: redirect old payment.open() calls ──
  // so existing deal card buttons still work without changes.
  function _shimOldPayment() {
    if (!window.Asterix.payment) {
      window.Asterix.payment = {
        open:  openPaymentForDeal,
        close: _closeOverlay,
      };
    } else {
      // Wrap existing open() so deal card "Complete Sale" goes through
      // the new full flow
      var origOpen = window.Asterix.payment.open;
      window.Asterix.payment.open = function (dealId, amount, buyer, seller, cb) {
        openPaymentForDeal(dealId, amount, buyer, seller, cb);
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _shimOldPayment);
  } else {
    _shimOldPayment();
  }

  console.log('[Fizzme] Checkout module loaded — Buy · Confirm · Pay · Track · Basket');
})();