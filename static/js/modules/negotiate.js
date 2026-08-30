// ============================================================
// negotiate.js  —  Fizzme in-chat Zambian bargaining engine
//
// Load order:  deals_v2.js  →  negotiate.js  →  chat.js
//
// KEY CHANGES in this revision
// ─────────────────────────────
// 1. Offer cards now render as formal business receipts (not raw text):
//      • Structured "Transaction Receipt" header
//      • Listing line-item block (photo + Item/Price/Location rows)
//        inside every card — no more single wrapped run-on line.
//      • Offer amount large and prominent
//      • State pill colour-coded
//      • Action buttons only rendered when offer.state === 'pending'
//      • Non-pending cards show a clear "closed" banner instead
//
// 2. Deal cards rendered the same way — full receipt with all parties,
//    final price, collection point, payment method.
//
// 3. Stale-card lockout: once ANY action fires (accept / decline /
//    counter / withdraw / confirm / cancel), _lockdownThread()
//    immediately disables every action button across the ENTIRE
//    thread — not just the card that was clicked — closing the
//    window where a second click on some other still-rendered card
//    could race the in-flight request. refreshThread() then re-
//    renders everything from server state, restoring correct button
//    state.
//
// 4. buildTransactionCard() is now wrapped in try/catch. A malformed
//    or unexpected message shape logs a console.error naming the
//    message id, message_type, and offer/deal payload instead of
//    silently degrading to plain text with no diagnostic trail.
//
// 5. _buildOfferUI and _buildRespondUI in the bargain sheet are
//    unchanged in behaviour but use the same fmtK() helper, and now
//    also call _lockdownThread() before firing their requests.
// ============================================================

(function () {
  'use strict';

  // ── CSS (one-time injection) ───────────────────────────────────
  (function injectCSS() {
    if (document.getElementById('fz-negotiate-css')) return;
    var s = document.createElement('style');
    s.id  = 'fz-negotiate-css';
    s.textContent = [
      /* ── Bargaining bottom-sheet ────────────────────────────────── */
      '#fz-bargain-overlay{',
      '  position:fixed;inset:0;z-index:28000;',
      '  background:rgba(0,0,0,0.75);',
      '  display:flex;flex-direction:column;justify-content:flex-end;',
      '  animation:fzNegFade .18s ease;',
      '}',
      '@keyframes fzNegFade{from{opacity:0}to{opacity:1}}',
      '@keyframes fzNegSlide{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}',

      '#fz-bargain-sheet{',
      '  background:linear-gradient(160deg,#1a2020 0%,#111616 100%);',
      '  border-radius:22px 22px 0 0;',
      '  border-top:2px solid #e6a817;',
      '  max-height:90dvh;overflow-y:auto;',
      '  padding:0 0 calc(16px + env(safe-area-inset-bottom));',
      '  animation:fzNegSlide .22s cubic-bezier(.32,1.1,.6,1);',
      '  scrollbar-width:thin;scrollbar-color:#2a3030 transparent;',
      '}',
      '.fz-neg-handle{width:36px;height:4px;border-radius:2px;',
      '  background:rgba(255,255,255,.15);margin:12px auto 0;}',

      /* Listing pill at top of sheet */
      '.fz-neg-listing-pill{',
      '  display:flex;align-items:center;gap:10px;',
      '  background:rgba(230,168,23,0.08);',
      '  border:1px solid rgba(230,168,23,0.2);',
      '  border-radius:14px;padding:10px 14px;margin:14px 16px 0;',
      '}',
      '.fz-neg-listing-thumb{',
      '  width:52px;height:52px;border-radius:9px;',
      '  object-fit:cover;flex-shrink:0;',
      '  border:2px solid #e6a817;background:var(--mid,#2a2f2f);',
      '}',
      '.fz-neg-listing-thumb-icon{',
      '  width:52px;height:52px;border-radius:9px;flex-shrink:0;',
      '  background:var(--mid,#2a2f2f);border:2px solid rgba(230,168,23,.3);',
      '  display:flex;align-items:center;justify-content:center;font-size:22px;',
      '}',
      '.fz-neg-listing-info{flex:1;min-width:0;}',
      '.fz-neg-listing-title{font-size:13px;font-weight:700;color:var(--text,#fff);',
      '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.fz-neg-listing-price{font-size:14px;font-weight:800;color:#e6a817;margin-top:2px;}',
      '.fz-neg-listing-badge{font-size:10px;color:rgba(255,255,255,.5);',
      '  background:rgba(255,255,255,.06);border-radius:6px;padding:2px 6px;',
      '  margin-top:3px;display:inline-block;}',

      /* History strip */
      '.fz-neg-history{margin:14px 16px 0;display:flex;flex-direction:column;gap:6px;',
      '  max-height:160px;overflow-y:auto;scrollbar-width:thin;}',
      '.fz-neg-hist-row{display:flex;justify-content:space-between;align-items:center;',
      '  padding:7px 12px;background:rgba(255,255,255,.04);',
      '  border-radius:10px;border:1px solid rgba(255,255,255,.07);font-size:12px;}',
      '.fz-neg-hist-who{color:rgba(255,255,255,.5);font-size:11px;}',
      '.fz-neg-hist-amt{font-weight:800;color:#e6a817;font-size:13px;}',
      '.fz-neg-hist-state{font-size:10px;padding:2px 7px;border-radius:8px;font-weight:700;}',
      '.fz-neg-hist-state.pending  {background:rgba(230,168,23,.15);color:#e6a817;}',
      '.fz-neg-hist-state.accepted {background:rgba(37,211,102,.15);color:#25d366;}',
      '.fz-neg-hist-state.declined {background:rgba(241,92,109,.15);color:#f15c6d;}',
      '.fz-neg-hist-state.countered{background:rgba(43,140,255,.15);color:#2b8cff;}',
      '.fz-neg-hist-state.withdrawn{background:rgba(255,255,255,.07);color:#888;}',

      /* Action area */
      '.fz-neg-actions{padding:14px 16px 0;display:flex;flex-direction:column;gap:10px;}',
      '.fz-neg-label{font-size:10px;color:rgba(255,255,255,.45);text-transform:uppercase;',
      '  letter-spacing:.6px;font-weight:700;margin-bottom:-4px;}',
      '.fz-neg-input-row{display:flex;gap:8px;align-items:stretch;}',
      '.fz-neg-k{font-size:17px;font-weight:900;color:#e6a817;align-self:center;flex-shrink:0;}',
      '.fz-neg-amount{flex:1;background:rgba(255,255,255,.07);',
      '  border:1px solid rgba(230,168,23,.35);border-radius:10px;',
      '  padding:11px 12px;color:var(--text,#fff);font-size:17px;font-weight:700;outline:none;}',
      '.fz-neg-amount:focus{border-color:#e6a817;}',
      '.fz-neg-amount.err{border-color:#f15c6d;}',
      '.fz-neg-note{width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);',
      '  border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 12px;',
      '  color:var(--text,#fff);font-size:13px;resize:none;outline:none;min-height:52px;',
      '  font-family:inherit;}',
      '.fz-neg-note:focus{border-color:rgba(230,168,23,.4);}',
      '.fz-neg-note::placeholder{color:rgba(255,255,255,.3);}',
      '.fz-neg-btn-row{display:flex;gap:8px;flex-wrap:wrap;}',
      '.fz-neg-btn{flex:1;min-width:80px;border:none;border-radius:12px;',
      '  padding:12px 10px;font-size:13px;font-weight:700;cursor:pointer;',
      '  transition:opacity .15s,transform .1s;white-space:nowrap;}',
      '.fz-neg-btn:active{transform:scale(.97);}',
      '.fz-neg-btn:disabled{opacity:.45;cursor:default;}',
      '.fz-neg-btn.offer   {background:#e6a817;color:#000;}',
      '.fz-neg-btn.accept  {background:#25d366;color:#000;}',
      '.fz-neg-btn.decline {background:rgba(241,92,109,.15);color:#f15c6d;border:1px solid rgba(241,92,109,.35);}',
      '.fz-neg-btn.withdraw{background:rgba(255,255,255,.07);color:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.12);}',
      '.fz-neg-btn.buy     {background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;}',
      '.fz-neg-btn.cancel-close{background:transparent;color:rgba(255,255,255,.35);font-size:12px;flex:none;padding:8px 14px;}',

      /* ── Transaction receipt card ────────────────────────────────── */
      '.fz-txn-card{',
      '  margin-top:6px;border-radius:14px;overflow:hidden;',
      '  border:1px solid rgba(255,255,255,0.1);',
      '  font-size:12px;',
      '}',

      /* Receipt header bar */
      '.fz-txn-header{',
      '  display:flex;align-items:center;justify-content:space-between;',
      '  padding:9px 12px 8px;',
      '}',
      '.fz-txn-header.offer-header  {background:rgba(230,168,23,0.12);border-bottom:1px solid rgba(230,168,23,0.2);}',
      '.fz-txn-header.deal-header   {background:rgba(37,211,102,0.12);border-bottom:1px solid rgba(37,211,102,0.2);}',
      '.fz-txn-header.closed-header {background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.08);}',
      '.fz-txn-header-left{display:flex;align-items:center;gap:7px;}',
      '.fz-txn-icon{font-size:16px;flex-shrink:0;}',
      '.fz-txn-type{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;}',
      '.fz-txn-type.offer-type  {color:#e6a817;}',
      '.fz-txn-type.deal-type   {color:#25d366;}',
      '.fz-txn-type.closed-type {color:rgba(255,255,255,.4);}',

      /* State pill */
      '.fz-txn-state{font-size:10px;font-weight:800;padding:3px 9px;border-radius:20px;}',
      '.fz-txn-state.pending  {background:rgba(230,168,23,.2); color:#e6a817;}',
      '.fz-txn-state.accepted {background:rgba(37,211,102,.2); color:#25d366;}',
      '.fz-txn-state.countered{background:rgba(43,140,255,.2); color:#2b8cff;}',
      '.fz-txn-state.declined {background:rgba(241,92,109,.2); color:#f15c6d;}',
      '.fz-txn-state.withdrawn{background:rgba(255,255,255,.08);color:#888;}',
      '.fz-txn-state.pending_confirmation{background:rgba(230,168,23,.2);color:#e6a817;}',
      '.fz-txn-state.confirmed{background:rgba(43,140,255,.2); color:#2b8cff;}',
      '.fz-txn-state.completed{background:rgba(37,211,102,.2); color:#25d366;}',
      '.fz-txn-state.cancelled{background:rgba(241,92,109,.2); color:#f15c6d;}',

      /* Receipt body */
      '.fz-txn-body{padding:10px 12px;background:rgba(0,0,0,0.25);}',

      /* Listing line-item block inside body */
      '.fz-txn-listing-row{',
      '  display:flex;flex-direction:column;align-items:stretch;gap:8px;',
      '  padding:8px 10px;margin-bottom:10px;',
      '  background:rgba(255,255,255,0.04);border-radius:10px;',
      '  border:1px solid rgba(255,255,255,0.07);',
      '}',
      '.fz-txn-listing-top{display:flex;align-items:center;gap:9px;}',
      '.fz-txn-listing-thumb{width:40px;height:40px;border-radius:7px;',
      '  object-fit:cover;flex-shrink:0;background:var(--mid,#2a2f2f);}',
      '.fz-txn-listing-icon{width:40px;height:40px;border-radius:7px;flex-shrink:0;',
      '  background:var(--mid,#2a2f2f);display:flex;align-items:center;',
      '  justify-content:center;font-size:17px;}',
      '.fz-txn-listing-name{font-size:13px;font-weight:700;color:var(--text,#fff);',
      '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.fz-txn-listing-fields{',
      '  padding-top:6px;border-top:1px solid rgba(255,255,255,.06);',
      '  display:grid;grid-template-columns:auto 1fr;gap:3px 10px;',
      '}',

      /* Amount row */
      '.fz-txn-amount-row{display:flex;align-items:baseline;gap:6px;margin-bottom:8px;}',
      '.fz-txn-amount-label{font-size:10px;color:rgba(255,255,255,.45);',
      '  text-transform:uppercase;letter-spacing:.4px;flex-shrink:0;}',
      '.fz-txn-amount{font-size:26px;font-weight:900;color:#e6a817;line-height:1;}',
      '.fz-txn-amount.deal-amount{color:#25d366;}',

      /* Meta grid */
      '.fz-txn-meta{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;',
      '  margin-bottom:10px;}',
      '.fz-txn-meta-k{font-size:10px;color:rgba(255,255,255,.38);text-transform:uppercase;',
      '  letter-spacing:.3px;white-space:nowrap;}',
      '.fz-txn-meta-v{font-size:11px;color:rgba(255,255,255,.75);font-weight:600;}',

      /* Divider */
      '.fz-txn-divider{height:1px;background:rgba(255,255,255,.07);margin:8px 0;}',

      /* Note block */
      '.fz-txn-note{font-size:11px;color:rgba(255,255,255,.5);font-style:italic;',
      '  margin-bottom:8px;padding:6px 8px;background:rgba(255,255,255,.03);',
      '  border-left:2px solid rgba(230,168,23,.3);border-radius:0 6px 6px 0;}',

      /* Closed banner (replaces buttons when offer/deal is no longer pending) */
      '.fz-txn-closed{',
      '  display:flex;align-items:center;gap:8px;justify-content:center;',
      '  padding:9px 12px;',
      '  font-size:12px;font-weight:700;',
      '  border-top:1px solid rgba(255,255,255,.07);',
      '}',
      '.fz-txn-closed.accepted {color:#25d366;background:rgba(37,211,102,.06);}',
      '.fz-txn-closed.countered{color:#2b8cff;background:rgba(43,140,255,.06);}',
      '.fz-txn-closed.declined {color:#f15c6d;background:rgba(241,92,109,.06);}',
      '.fz-txn-closed.withdrawn{color:#888;   background:rgba(255,255,255,.04);}',
      '.fz-txn-closed.completed{color:#25d366;background:rgba(37,211,102,.06);}',
      '.fz-txn-closed.cancelled{color:#f15c6d;background:rgba(241,92,109,.06);}',

      /* Action buttons inside card */
      '.fz-txn-btns{display:flex;gap:7px;flex-wrap:wrap;padding:0 12px 12px;}',
      '.fz-txn-btn{border:none;border-radius:10px;padding:8px 14px;',
      '  font-size:12px;font-weight:700;cursor:pointer;',
      '  transition:opacity .15s;white-space:nowrap;flex:1;min-width:70px;}',
      '.fz-txn-btn:disabled{opacity:.4;cursor:default;}',
      '.fz-txn-btn.accept  {background:#25d366;color:#000;}',
      '.fz-txn-btn.counter {background:#e6a817;color:#000;}',
      '.fz-txn-btn.decline {background:rgba(241,92,109,.15);color:#f15c6d;',
      '  border:1px solid rgba(241,92,109,.3);}',
      '.fz-txn-btn.withdraw{background:rgba(255,255,255,.07);color:rgba(255,255,255,.55);}',
      '.fz-txn-btn.confirm {background:#2b8cff;color:#fff;}',
      '.fz-txn-btn.pay     {background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;}',
      '.fz-txn-btn.cancel  {background:rgba(241,92,109,.08);color:rgba(241,92,109,.6);',
      '  border:1px solid rgba(241,92,109,.15);font-size:11px;}',

      /* Listing mini-chip (inside bargain sheet pill) */
      '.fz-listing-chip{display:flex;align-items:center;gap:8px;',
      '  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);',
      '  border-radius:10px;padding:7px 10px;margin-bottom:6px;max-width:260px;}',
      '.fz-listing-chip-thumb{width:40px;height:40px;border-radius:7px;',
      '  object-fit:cover;flex-shrink:0;background:var(--mid,#2a2f2f);}',
    ].join('\n');
    document.head.appendChild(s);
  })();


  // ── Utilities ──────────────────────────────────────────────────
  function fmtK(price) {
    var n = parseFloat(price);
    if (isNaN(n)) return '';
    return 'K' + n.toLocaleString('en-ZM', { minimumFractionDigits: 2 });
  }

  function me() { return (window.State && window.State.ME) || ''; }

  function toast(title, body) {
    if (window.toast) window.toast(title, body);
    else console.info('[Negotiate]', title, body);
  }

  function refreshThread() {
    if (window.Asterix && window.Asterix.chat && window.State && window.State.activeRecipient) {
      window.Asterix.chat.loadMessages(window.State.activeRecipient, true);
    }
  }

  function _closeSheet() {
    var el = document.getElementById('fz-bargain-overlay');
    if (el) el.remove();
  }

  // ── FIX #2: Thread-wide lockdown ─────────────────────────────────
  // Called as the FIRST line inside every action handler (accept,
  // decline, counter, withdraw, confirm, cancel — both in the inline
  // receipt cards AND the bargain sheet). Disables every action
  // button currently rendered in the whole message thread, not just
  // the one that was clicked, so a second click on some OTHER still-
  // rendered card can't race the in-flight request. refreshThread()
  // then re-renders from server state afterwards, restoring correct
  // (re-enabled, re-computed) button state.
  function _lockdownThread() {
    var container = document.getElementById('id_chat_item_container');
    if (!container) return;
    container.querySelectorAll('.fz-txn-btns button, .fz-neg-btn-row button')
      .forEach(function (b) { b.disabled = true; });
  }


  // ─────────────────────────────────────────────────────────────────
  // TRANSACTION RECEIPT CARD — buildTransactionCard entry point
  // Called by chat.js for every msg where message_type !== 'text'.
  //
  // FIX #1 (Bug 2): wrapped in try/catch. Previously any exception
  // thrown while building a card (missing field, unexpected shape,
  // etc.) propagated up silently — chat.js would catch nothing,
  // buildBubble() would never append the card, and the message would
  // effectively vanish or fall back to plain text with zero trace in
  // the console. Now any failure is logged with the message id,
  // message_type, and offer/deal payload so it's actually debuggable,
  // and null is returned so the caller's existing plain-text fallback
  // still applies.
  // ─────────────────────────────────────────────────────────────────
  function buildTransactionCard(msg) {
    try {
      var myName = me();

      if (msg.message_type === 'offer' && msg.offer) {
        return _buildOfferCard(msg, myName);
      }
      if ((msg.message_type === 'deal_confirmation' || msg.message_type === 'status_update') && msg.deal) {
        return _buildDealCard(msg, myName);
      }
      // Plain status update with no deal attached
      if (msg.message_type === 'status_update') {
        var el = document.createElement('div');
        el.style.cssText = 'font-size:11px;color:rgba(255,255,255,.45);font-style:italic;margin-top:4px;padding:5px 8px;border-left:2px solid rgba(255,255,255,.12);border-radius:0 4px 4px 0;';
        el.textContent = msg.message;
        return el;
      }
      return null;
    } catch (err) {
      console.error(
        '[Fizzme] buildTransactionCard failed for msg', msg && msg.id,
        '— message_type:', msg && msg.message_type,
        'offer:', msg && msg.offer,
        'deal:', msg && msg.deal,
        err
      );
      return null;
    }
  }


  // ── OFFER RECEIPT CARD ──────────────────────────────────────────
  function _buildOfferCard(msg, myName) {
    var offer = msg.offer;
    var rs    = msg.related_status;
    var isPending = offer.state === 'pending';

    var card = document.createElement('div');
    card.className = 'fz-txn-card';

    // ── Header ────────────────────────────────────────────────────
    var header = document.createElement('div');
    header.className = 'fz-txn-header ' + (isPending ? 'offer-header' : 'closed-header');

    var left = document.createElement('div');
    left.className = 'fz-txn-header-left';

    var icon = document.createElement('span');
    icon.className = 'fz-txn-icon';
    icon.textContent = _offerIcon(offer);

    var typeLabel = document.createElement('span');
    typeLabel.className = 'fz-txn-type ' + (isPending ? 'offer-type' : 'closed-type');
    typeLabel.textContent = _offerTypeLabel(offer, myName);

    left.appendChild(icon);
    left.appendChild(typeLabel);

    var statePill = document.createElement('span');
    statePill.className = 'fz-txn-state ' + (offer.state || 'pending');
    statePill.textContent = _stateLabel(offer.state);

    header.appendChild(left);
    header.appendChild(statePill);
    card.appendChild(header);

    // ── Body ─────────────────────────────────────────────────────
    var body = document.createElement('div');
    body.className = 'fz-txn-body';

    // Listing line-item block
    if (rs && rs.is_commercial) {
      body.appendChild(_buildListingRow(rs));
    }

    // Amount
    var amtRow = document.createElement('div');
    amtRow.className = 'fz-txn-amount-row';
    var amtLabel = document.createElement('span');
    amtLabel.className = 'fz-txn-amount-label';
    amtLabel.textContent = offer.state === 'accepted' ? 'Agreed price' : 'Offered price';
    var amtEl = document.createElement('span');
    amtEl.className = 'fz-txn-amount';
    amtEl.textContent = fmtK(offer.amount);
    amtRow.appendChild(amtLabel);
    amtRow.appendChild(amtEl);
    body.appendChild(amtRow);

    // Meta grid
    var meta = document.createElement('div');
    meta.className = 'fz-txn-meta';
    _addMeta(meta, 'Proposed by', offer.proposed_by);
    _addMeta(meta, 'Time', _fmtDate(offer.created_at));
    body.appendChild(meta);

    // Note (buyer's message to seller)
    var note = offer.note || '';
    if (note) {
      var noteEl = document.createElement('div');
      noteEl.className = 'fz-txn-note';
      noteEl.textContent = '\u201C' + note + '\u201D';
      body.appendChild(noteEl);
    }

    card.appendChild(body);

    // ── Closed banner (non-pending offers) ───────────────────────
    if (!isPending) {
      var closedBanner = document.createElement('div');
      closedBanner.className = 'fz-txn-closed ' + (offer.state || '');
      closedBanner.textContent = _closedBannerText(offer.state);
      card.appendChild(closedBanner);
      return card;
    }

    // ── Action buttons (pending only) ────────────────────────────
    var iProposed  = offer.proposed_by === myName;
    var iCanRespond = !iProposed;

    if (iProposed) {
      var btnWrap = document.createElement('div');
      btnWrap.className = 'fz-txn-btns';
      var wdBtn = _txnBtn('Withdraw', 'withdraw', function () {
        if (!confirm('Withdraw your offer of ' + fmtK(offer.amount) + '?')) return;
        _lockdownThread();
        wdBtn.disabled = true;
        window.Asterix.deals.withdrawOffer(offer.id)
          .then(function () { toast('Offer withdrawn', ''); refreshThread(); })
          .catch(function (err) { wdBtn.disabled = false; toast('Error', err.message || ''); });
      });
      btnWrap.appendChild(wdBtn);
      card.appendChild(btnWrap);

    } else if (iCanRespond) {
      var btnWrap2 = document.createElement('div');
      btnWrap2.className = 'fz-txn-btns';

      var accBtn = _txnBtn('✅ Accept  ' + fmtK(offer.amount), 'accept', function () {
        _lockdownThread();
        _disableAll(btnWrap2);
        window.Asterix.deals.respondToOffer(offer.id, 'accept')
          .then(function (res) {
            toast('Deal agreed! 🎉', fmtK(offer.amount));
            refreshThread();
            if (res.deal_id && window.Asterix && window.Asterix.checkout) {
              setTimeout(function () {
                window.Asterix.checkout.openDealConfirm(res.deal_id, res.final_price);
              }, 800);
            }
          })
          .catch(function (err) { _enableAll(btnWrap2); toast('Error', err.message || ''); });
      });

      var cntBtn = _txnBtn('🔄 Counter', 'counter', function () {
        openBargainSheet(
          rs || { status_id: null, caption: msg.message, price: offer.amount, is_negotiable: true },
          offer, null, 'counter', null
        );
      });

      var decBtn = _txnBtn('❌ Decline', 'decline', function () {
        if (!confirm('Decline this offer?')) return;
        _lockdownThread();
        _disableAll(btnWrap2);
        window.Asterix.deals.respondToOffer(offer.id, 'decline')
          .then(function () { toast('Offer declined', ''); refreshThread(); })
          .catch(function (err) { _enableAll(btnWrap2); toast('Error', err.message || ''); });
      });

      btnWrap2.appendChild(accBtn);
      btnWrap2.appendChild(cntBtn);
      btnWrap2.appendChild(decBtn);
      card.appendChild(btnWrap2);
    }

    return card;
  }


  // ── DEAL RECEIPT CARD ───────────────────────────────────────────
  function _buildDealCard(msg, myName) {
    var deal = msg.deal;
    var rs   = msg.related_status;

    var isTerminal = (deal.state === 'completed' || deal.state === 'cancelled');
    var isConfirmed = deal.state === 'confirmed';

    var card = document.createElement('div');
    card.className = 'fz-txn-card';

    // ── Header ────────────────────────────────────────────────────
    var header = document.createElement('div');
    header.className = 'fz-txn-header ' + (isTerminal ? 'closed-header' : 'deal-header');

    var left = document.createElement('div');
    left.className = 'fz-txn-header-left';
    var icon = document.createElement('span');
    icon.className = 'fz-txn-icon';
    icon.textContent = _dealIcon(deal.state);
    var typeLabel = document.createElement('span');
    typeLabel.className = 'fz-txn-type ' + (isTerminal ? 'closed-type' : 'deal-type');
    typeLabel.textContent = 'Transaction Receipt';
    left.appendChild(icon); left.appendChild(typeLabel);

    var statePill = document.createElement('span');
    statePill.className = 'fz-txn-state ' + (deal.state || '');
    statePill.textContent = _dealStateLabel(deal.state);

    header.appendChild(left); header.appendChild(statePill);
    card.appendChild(header);

    // ── Body ─────────────────────────────────────────────────────
    var body = document.createElement('div');
    body.className = 'fz-txn-body';

    // Listing line-item block
    if (rs && rs.is_commercial) body.appendChild(_buildListingRow(rs));

    // Final price
    var amtRow = document.createElement('div');
    amtRow.className = 'fz-txn-amount-row';
    var amtLabel = document.createElement('span');
    amtLabel.className = 'fz-txn-amount-label';
    amtLabel.textContent = 'Final price';
    var amtEl = document.createElement('span');
    amtEl.className = 'fz-txn-amount deal-amount';
    amtEl.textContent = fmtK(deal.final_price);
    amtRow.appendChild(amtLabel); amtRow.appendChild(amtEl);
    body.appendChild(amtRow);

    // Meta
    var meta = document.createElement('div');
    meta.className = 'fz-txn-meta';
    _addMeta(meta, 'Buyer',  _displayName(deal.buyer));
    _addMeta(meta, 'Seller', _displayName(deal.seller));
    if (deal.payment_method) _addMeta(meta, 'Payment', deal.payment_method.replace(/_/g, ' '));
    if (deal.collection_point) _addMeta(meta, 'Collection', deal.collection_point);

    // Confirmation status
    var buyerTick  = deal.buyer_confirmed  ? '✅' : '⏳';
    var sellerTick = deal.seller_confirmed ? '✅' : '⏳';
    _addMeta(meta, 'Buyer confirmed',  buyerTick  + ' ' + (deal.buyer_confirmed  ? 'Yes' : 'Pending'));
    _addMeta(meta, 'Seller confirmed', sellerTick + ' ' + (deal.seller_confirmed ? 'Yes' : 'Pending'));

    body.appendChild(meta);
    card.appendChild(body);

    // ── Terminal / closed state ───────────────────────────────────
    if (isTerminal) {
      var closedBanner = document.createElement('div');
      closedBanner.className = 'fz-txn-closed ' + deal.state;
      closedBanner.textContent = deal.state === 'completed'
        ? '✅ Transaction complete — payment released'
        : '❌ Deal cancelled — item available again';
      card.appendChild(closedBanner);
      return card;
    }

    // ── Action buttons ────────────────────────────────────────────
    var isBuyer  = myName === _displayName(deal.buyer);
    var isSeller = myName === _displayName(deal.seller);

    var btnWrap = document.createElement('div');
    btnWrap.className = 'fz-txn-btns';

    // Confirm button (pending_confirmation state)
    if (deal.state === 'pending_confirmation' && (isBuyer || isSeller)) {
      var myConfirmed = (isBuyer && deal.buyer_confirmed) || (isSeller && deal.seller_confirmed);
      if (!myConfirmed) {
        var confBtn = _txnBtn('✅ Confirm my side', 'confirm', function () {
          _lockdownThread();
          confBtn.disabled = true; confBtn.textContent = '…';
          window.Asterix.deals.confirmDeal(deal.id)
            .then(function () { toast('Confirmed!', ''); refreshThread(); })
            .catch(function (err) {
              confBtn.disabled = false; confBtn.textContent = '✅ Confirm my side';
              toast('Error', err.message || '');
            });
        });
        btnWrap.appendChild(confBtn);
      } else {
        var waitEl = document.createElement('div');
        waitEl.style.cssText = 'font-size:11px;color:rgba(255,255,255,.4);font-style:italic;padding:4px 2px 10px;';
        waitEl.textContent = '✓ You confirmed — waiting for the other party…';
        btnWrap.appendChild(waitEl);
      }
    }

    // Pay button (confirmed state, buyer side)
    if (isConfirmed && isBuyer) {
      var payBtn = _txnBtn('💳 Pay  ' + fmtK(deal.final_price), 'pay', function () {
        if (window.Asterix && window.Asterix.payment) {
          window.Asterix.payment.open(deal.id, deal.final_price, myName, _displayName(deal.seller),
            function () { refreshThread(); });
        } else if (window.Asterix && window.Asterix.checkout) {
          window.Asterix.checkout.openDealConfirm(deal.id, deal.final_price);
        }
      });
      btnWrap.appendChild(payBtn);
    }

    // Cancel (either party, not terminal)
    if (isBuyer || isSeller) {
      var cancelBtn = _txnBtn('Cancel deal', 'cancel', function () {
        if (!confirm('Cancel this deal? The item will go back to available.')) return;
        _lockdownThread();
        cancelBtn.disabled = true;
        window.Asterix.deals.cancelDeal(deal.id)
          .then(function () { toast('Deal cancelled', 'Item is available again.'); refreshThread(); })
          .catch(function (err) { cancelBtn.disabled = false; toast('Error', err.message || ''); });
      });
      btnWrap.appendChild(cancelBtn);
    }

    if (btnWrap.children.length) card.appendChild(btnWrap);
    return card;
  }


  // ── FIX #3: Listing line-item block ─────────────────────────────
  // Was a single flex row with everything crammed onto one wrapped
  // line ("caption ... K820.00 · negotiable"). Now renders as a
  // labeled Item / Listed price / Location block underneath the
  // thumbnail, matching the same label/value receipt language used
  // by the rest of the card (_addMeta / .fz-txn-meta).
  function _buildListingRow(rs) {
    var wrap = document.createElement('div');
    wrap.className = 'fz-txn-listing-row';

    var top = document.createElement('div');
    top.className = 'fz-txn-listing-top';

    if (rs.media_url) {
      var img = document.createElement('img');
      img.className = 'fz-txn-listing-thumb';
      img.src = rs.media_url;
      img.onerror = function () { img.replaceWith(_listingIcon()); };
      top.appendChild(img);
    } else {
      top.appendChild(_listingIcon());
    }

    var name = document.createElement('div');
    name.className = 'fz-txn-listing-name';
    name.textContent = (rs.caption || 'Listing').slice(0, 50);
    top.appendChild(name);
    wrap.appendChild(top);

    var fields = document.createElement('div');
    fields.className = 'fz-txn-listing-fields';
    _addMeta(fields, 'Item', rs.caption || 'Listing');
    _addMeta(
      fields,
      'Listed price',
      rs.price ? fmtK(rs.price) + (rs.is_negotiable ? '  (negotiable)' : '  (fixed)') : 'On request'
    );
    if (rs.collection_point) _addMeta(fields, 'Location', rs.collection_point);
    wrap.appendChild(fields);

    return wrap;
  }

  function _listingIcon() {
    var d = document.createElement('div');
    d.className = 'fz-txn-listing-icon';
    d.textContent = '🏷️';
    return d;
  }

  function _addMeta(grid, key, value) {
    if (!value) return;
    var k = document.createElement('div'); k.className = 'fz-txn-meta-k'; k.textContent = key;
    var v = document.createElement('div'); v.className = 'fz-txn-meta-v'; v.textContent = value;
    grid.appendChild(k); grid.appendChild(v);
  }

  function _displayName(userObj) {
    if (!userObj) return '';
    if (typeof userObj === 'string') return userObj;
    return userObj.username || String(userObj);
  }

  function _fmtDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })
        + '  ' + d.toLocaleTimeString('en-ZM', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }

  function _txnBtn(label, cls, onClick) {
    var btn = document.createElement('button');
    btn.className = 'fz-txn-btn ' + cls;
    btn.textContent = label;
    btn.onclick = function (e) { e.stopPropagation(); onClick(); };
    return btn;
  }

  function _disableAll(container) {
    container.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
  }
  function _enableAll(container) {
    container.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
  }

  // ── Label helpers ──────────────────────────────────────────────
  function _stateLabel(state) {
    var map = {
      pending:   'Pending',
      accepted:  'Accepted ✅',
      countered: 'Countered 🔄',
      declined:  'Declined ❌',
      withdrawn: 'Withdrawn',
    };
    return map[state] || state || 'Pending';
  }

  function _dealStateLabel(state) {
    var map = {
      pending_confirmation: 'Awaiting Confirmation',
      confirmed:            'Confirmed',
      completed:            'Completed ✅',
      cancelled:            'Cancelled ❌',
    };
    return map[state] || state || '';
  }

  function _closedBannerText(state) {
    var map = {
      accepted:  '✅ Offer accepted — deal created',
      countered: '🔄 Countered — see latest offer below',
      declined:  '❌ Offer declined',
      withdrawn: 'Offer withdrawn',
    };
    return map[state] || 'Closed';
  }

  function _offerIcon(offer) {
    var map = {
      pending:   '🤝',
      accepted:  '✅',
      countered: '🔄',
      declined:  '❌',
      withdrawn: '↩️',
    };
    return map[offer.state] || '🤝';
  }

  function _dealIcon(state) {
    var map = {
      pending_confirmation: '⏳',
      confirmed:            '✅',
      completed:            '💰',
      cancelled:            '❌',
    };
    return map[state] || '🤝';
  }

  function _offerTypeLabel(offer, myName) {
    if (offer.state === 'countered') return 'Counter Offer';
    if (offer.state !== 'pending')   return 'Offer';
    return offer.proposed_by === myName ? 'Your Offer' : 'Incoming Offer';
  }


  // ─────────────────────────────────────────────────────────────────
  // BARGAINING BOTTOM-SHEET (unchanged in behaviour, same fmtK)
  // ─────────────────────────────────────────────────────────────────
  function openBargainSheet(listingData, offerData, selectedMedia, mode, historyChain) {
    _closeSheet();

    var overlay = document.createElement('div');
    overlay.id  = 'fz-bargain-overlay';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) _closeSheet(); });

    var sheet = document.createElement('div');
    sheet.id  = 'fz-bargain-sheet';
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    var handle = document.createElement('div');
    handle.className = 'fz-neg-handle';
    sheet.appendChild(handle);

    // ── Listing pill ─────────────────────────────────────────────
    var pill = document.createElement('div');
    pill.className = 'fz-neg-listing-pill';

    var thumbUrl = (selectedMedia && selectedMedia.url) || listingData.media_url || '';
    if (thumbUrl) {
      var img = document.createElement('img');
      img.className = 'fz-neg-listing-thumb';
      img.src = thumbUrl;
      img.onerror = function () { img.replaceWith(_iconThumb()); };
      pill.appendChild(img);
    } else {
      pill.appendChild(_iconThumb());
    }

    var info = document.createElement('div');
    info.className = 'fz-neg-listing-info';

    var titleEl = document.createElement('div');
    titleEl.className = 'fz-neg-listing-title';
    titleEl.textContent = (listingData.caption || 'Listing').slice(0, 60);
    info.appendChild(titleEl);

    if (listingData.price) {
      var priceEl = document.createElement('div');
      priceEl.className = 'fz-neg-listing-price';
      priceEl.textContent = fmtK(listingData.price) + (listingData.is_negotiable ? '  · negotiable' : '  · fixed');
      info.appendChild(priceEl);
    }

    if (selectedMedia) {
      var badge = document.createElement('div');
      badge.className = 'fz-neg-listing-badge';
      badge.textContent = '📸 Photo ' + (selectedMedia.index + 1) + ' of ' + selectedMedia.total + ' selected';
      info.appendChild(badge);
    }

    pill.appendChild(info);
    sheet.appendChild(pill);

    // ── Offer history ─────────────────────────────────────────────
    if (historyChain && historyChain.length) {
      var histTitle = document.createElement('div');
      histTitle.style.cssText = 'font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin:14px 16px 0;';
      histTitle.textContent = 'Negotiation history';
      sheet.appendChild(histTitle);
      var hist = document.createElement('div');
      hist.className = 'fz-neg-history';
      historyChain.forEach(function (o) {
        var row = document.createElement('div');
        row.className = 'fz-neg-hist-row';
        var left2 = document.createElement('div');
        left2.innerHTML = '<div class="fz-neg-hist-who">' + o.proposed_by + '</div>' +
          '<div class="fz-neg-hist-amt">' + fmtK(o.amount) + '</div>';
        var stateEl2 = document.createElement('span');
        stateEl2.className = 'fz-neg-hist-state ' + (o.state || 'pending');
        stateEl2.textContent = _stateLabel(o.state);
        row.appendChild(left2); row.appendChild(stateEl2);
        hist.appendChild(row);
      });
      sheet.appendChild(hist);
    }

    var actions = document.createElement('div');
    actions.className = 'fz-neg-actions';
    sheet.appendChild(actions);

    var myName = me();
    var iAmBuyer = listingData.username !== myName;

    if (mode === 'respond' && offerData) {
      _buildRespondUI(actions, listingData, offerData, selectedMedia, myName, !iAmBuyer);
    } else {
      _buildOfferUI(actions, listingData, offerData, selectedMedia, myName, iAmBuyer, mode);
    }

    var closeBtn = document.createElement('button');
    closeBtn.className = 'fz-neg-btn cancel-close';
    closeBtn.textContent = 'Cancel';
    closeBtn.onclick = _closeSheet;
    actions.appendChild(closeBtn);
  }

  function _iconThumb() {
    var d = document.createElement('div');
    d.className = 'fz-neg-listing-thumb-icon';
    d.textContent = '🏷️';
    return d;
  }

  function _buildOfferUI(container, listing, existingOffer, selectedMedia, myName, iAmBuyer, mode) {
    var labelEl = document.createElement('div');
    labelEl.className = 'fz-neg-label';
    labelEl.textContent = mode === 'counter' ? 'Your counter price' : (iAmBuyer ? 'Your offer price' : 'Counter price');
    container.appendChild(labelEl);

    var inputRow = document.createElement('div');
    inputRow.className = 'fz-neg-input-row';
    var kEl = document.createElement('div'); kEl.className = 'fz-neg-k'; kEl.textContent = 'K';
    var amtEl = document.createElement('input');
    amtEl.type = 'number'; amtEl.min = '0.01'; amtEl.step = '0.01';
    amtEl.className = 'fz-neg-amount';
    amtEl.placeholder = listing.price ? parseFloat(listing.price).toFixed(2) : '0.00';
    inputRow.appendChild(kEl); inputRow.appendChild(amtEl);
    container.appendChild(inputRow);

    var noteEl = document.createElement('textarea');
    noteEl.className = 'fz-neg-note';
    noteEl.placeholder = '💬 Add a note… e.g. "Last price, Ba Seller!"';
    noteEl.maxLength = 200;
    container.appendChild(noteEl);

    var btnRow = document.createElement('div');
    btnRow.className = 'fz-neg-btn-row';

    var sendBtn = document.createElement('button');
    sendBtn.className = 'fz-neg-btn offer';
    sendBtn.textContent = mode === 'counter' ? '🔄 Send Counter' : '🤝 Send Offer';
    sendBtn.onclick = function () {
      var amt = parseFloat(amtEl.value);
      if (isNaN(amt) || amt <= 0) { amtEl.classList.add('err'); amtEl.focus(); return; }
      amtEl.classList.remove('err');
      _lockdownThread();
      sendBtn.disabled = true; sendBtn.textContent = '…';

      var note = noteEl.value.trim();
      var smUrl = selectedMedia ? selectedMedia.url : '';
      var doSend;

      if (mode === 'counter' && existingOffer) {
        doSend = window.Asterix.deals.respondToOffer(existingOffer.id, 'counter', amt, { note: note });
      } else {
        doSend = window.Asterix.deals.createOffer(
          listing.status_id || listing.id, amt,
          { selectedMediaUrl: smUrl, note: note }
        );
      }

      doSend
        .then(function () {
          toast('Offer sent 🤝', fmtK(amt) + ' — the seller will respond here.');
          _closeSheet(); refreshThread();
        })
        .catch(function (err) {
          sendBtn.disabled = false;
          sendBtn.textContent = mode === 'counter' ? '🔄 Send Counter' : '🤝 Send Offer';
          if (err.data && err.data.error && err.data.error.includes('already have a pending')) {
            toast('Offer pending', 'Withdraw your existing offer in chat first.'); _closeSheet();
          } else {
            toast('Error', (err && err.message) || 'Could not send offer.');
          }
        });
    };
    btnRow.appendChild(sendBtn);

    if (iAmBuyer && listing.price) {
      var buyBtn = document.createElement('button');
      buyBtn.className = 'fz-neg-btn buy';
      buyBtn.textContent = '🛒 Buy Now  ' + fmtK(listing.price);
      buyBtn.onclick = function () {
        _closeSheet();
        if (window.Asterix && window.Asterix.checkout) {
          window.Asterix.checkout.open(listing, selectedMedia, function () { refreshThread(); });
        } else if (window.openBuyModal) {
          window.openBuyModal(listing.status_id || listing.id, listing.price,
            listing.caption || 'Item', selectedMedia ? selectedMedia.url : listing.media_url, listing.username);
        }
      };
      btnRow.appendChild(buyBtn);
    }

    container.appendChild(btnRow);
  }

  function _buildRespondUI(container, listing, offer, selectedMedia, myName, iAmSeller) {
    var incomingEl = document.createElement('div');
    incomingEl.style.cssText = 'text-align:center;padding:8px 0;';
    incomingEl.innerHTML =
      '<div style="font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px;">Buyer\'s offer</div>' +
      '<div style="font-size:28px;font-weight:900;color:#e6a817;margin:4px 0;">' + fmtK(offer.amount) + '</div>' +
      (listing.price ? '<div style="font-size:11px;color:rgba(255,255,255,.35);">Listed at ' + fmtK(listing.price) + '</div>' : '');
    container.appendChild(incomingEl);

    var noteEl = document.createElement('textarea');
    noteEl.className = 'fz-neg-note';
    noteEl.placeholder = '💬 Add a note to your response (optional)…';
    noteEl.maxLength = 200;
    container.appendChild(noteEl);

    var counterLabel = document.createElement('div');
    counterLabel.className = 'fz-neg-label';
    counterLabel.style.marginTop = '6px';
    counterLabel.textContent = 'Counter with (optional)';
    container.appendChild(counterLabel);

    var inputRow = document.createElement('div');
    inputRow.className = 'fz-neg-input-row';
    var kEl = document.createElement('div'); kEl.className = 'fz-neg-k'; kEl.textContent = 'K';
    var amtEl = document.createElement('input');
    amtEl.type = 'number'; amtEl.min = '0.01'; amtEl.step = '0.01';
    amtEl.className = 'fz-neg-amount';
    amtEl.placeholder = listing.price ? parseFloat(listing.price).toFixed(2) : '0.00';
    inputRow.appendChild(kEl); inputRow.appendChild(amtEl);
    container.appendChild(inputRow);

    var btnRow = document.createElement('div');
    btnRow.className = 'fz-neg-btn-row';

    var acceptBtn = document.createElement('button');
    acceptBtn.className = 'fz-neg-btn accept';
    acceptBtn.textContent = '✅ Accept  ' + fmtK(offer.amount);
    acceptBtn.onclick = function () {
      _lockdownThread();
      _disableAll(btnRow);
      window.Asterix.deals.respondToOffer(offer.id, 'accept', null, { note: noteEl.value.trim() })
        .then(function (res) {
          toast('Deal agreed! 🎉', fmtK(offer.amount)); _closeSheet(); refreshThread();
          if (res.deal_id && window.Asterix && window.Asterix.checkout) {
            setTimeout(function () { window.Asterix.checkout.openDealConfirm(res.deal_id, res.final_price); }, 800);
          }
        })
        .catch(function (err) { _enableAll(btnRow); acceptBtn.textContent = '✅ Accept  ' + fmtK(offer.amount); toast('Error', (err && err.message) || ''); });
    };

    var counterBtn = document.createElement('button');
    counterBtn.className = 'fz-neg-btn offer';
    counterBtn.textContent = '🔄 Counter';
    counterBtn.onclick = function () {
      var amt = parseFloat(amtEl.value);
      if (isNaN(amt) || amt <= 0) { amtEl.classList.add('err'); amtEl.focus(); return; }
      amtEl.classList.remove('err');
      _lockdownThread();
      _disableAll(btnRow);
      window.Asterix.deals.respondToOffer(offer.id, 'counter', amt, { note: noteEl.value.trim() })
        .then(function () { toast('Counter sent 🔄', fmtK(amt)); _closeSheet(); refreshThread(); })
        .catch(function (err) { _enableAll(btnRow); counterBtn.textContent = '🔄 Counter'; toast('Error', (err && err.message) || ''); });
    };

    var declineBtn = document.createElement('button');
    declineBtn.className = 'fz-neg-btn decline';
    declineBtn.textContent = '❌ Decline';
    declineBtn.onclick = function () {
      if (!confirm('Decline this offer?')) return;
      _lockdownThread();
      _disableAll(btnRow);
      window.Asterix.deals.respondToOffer(offer.id, 'decline', null, { note: noteEl.value.trim() })
        .then(function () { toast('Offer declined', ''); _closeSheet(); refreshThread(); })
        .catch(function (err) { _enableAll(btnRow); toast('Error', (err && err.message) || ''); });
    };

    btnRow.appendChild(acceptBtn); btnRow.appendChild(counterBtn); btnRow.appendChild(declineBtn);
    container.appendChild(btnRow);
  }

  function _disableAll(row) { row.querySelectorAll('button').forEach(function (b) { b.disabled = true; }); }
  function _enableAll(row)  { row.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); }


  // ─────────────────────────────────────────────────────────────────
  // INTEREST SHEET (unchanged from previous version)
  // ─────────────────────────────────────────────────────────────────
  function openInterestSheet(status, selectedMedia) {
    if (window.Asterix && window.Asterix.status) window.Asterix.status.pauseViewer();

    var overlay = document.getElementById('fz-interest-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'fz-interest-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);animation:fzNegFade .18s ease;';

    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--card,#1e1e1e);border-radius:20px 20px 0 0;padding:20px 18px 28px;animation:fzNegSlide .2s ease;';
    var hasSelected = !!(selectedMedia && selectedMedia.url);

    var pill = document.createElement('div');
    pill.style.cssText = 'border-radius:12px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,0.08);' + (hasSelected ? 'background:rgba(230,168,23,0.08);border-color:rgba(230,168,23,0.2);' : 'background:rgba(255,255,255,0.05);');

    if (hasSelected) {
      var selThumb = document.createElement('div');
      selThumb.style.cssText = 'width:56px;height:56px;border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--mid,#2a2f2f);border:2px solid #e6a817;';
      var selImg = document.createElement('img');
      selImg.src = selectedMedia.url; selImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      selImg.onerror = function () { selThumb.innerHTML = '<span style="font-size:22px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">🏷️</span>'; };
      selThumb.appendChild(selImg); pill.appendChild(selThumb);
      var selInfo = document.createElement('div'); selInfo.style.cssText = 'flex:1;min-width:0;';
      var photoLabel = document.createElement('div'); photoLabel.style.cssText = 'font-size:10px;color:#e6a817;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;';
      photoLabel.textContent = 'Photo ' + (selectedMedia.index + 1) + ' of ' + selectedMedia.total + ' selected';
      var selCaption = document.createElement('div'); selCaption.style.cssText = 'font-size:13px;font-weight:700;color:var(--text,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      selCaption.textContent = ((selectedMedia.caption || status.caption || 'Listing').slice(0, 55));
      selInfo.appendChild(photoLabel); selInfo.appendChild(selCaption);
      if (status.price) { var selPrice = document.createElement('div'); selPrice.style.cssText = 'font-size:12px;color:#e6a817;font-weight:600;margin-top:2px;'; selPrice.textContent = fmtK(status.price) + (status.is_negotiable ? ' · negotiable' : ''); selInfo.appendChild(selPrice); }
      pill.appendChild(selInfo);
    } else {
      var iconSpan = document.createElement('span'); iconSpan.style.cssText = 'font-size:20px;flex-shrink:0;'; iconSpan.textContent = '🏷️';
      var pillInfo = document.createElement('div');
      pillInfo.innerHTML = '<div style="font-size:13px;font-weight:700;color:var(--text,#fff);">' + ((status.caption || 'Listing').slice(0, 60)) + '</div>' + (status.price ? '<div style="font-size:12px;color:#e6a817;font-weight:600;">' + fmtK(status.price) + (status.is_negotiable ? ' · negotiable' : '') + '</div>' : '');
      pill.appendChild(iconSpan); pill.appendChild(pillInfo);
    }
    sheet.appendChild(pill);

    var title = document.createElement('div');
    title.style.cssText = 'font-size:11px;color:var(--sub,#aaa);text-transform:uppercase;letter-spacing:.6px;font-weight:700;margin-bottom:12px;';
    title.textContent = hasSelected ? 'Interested in this item?' : 'How do you want to proceed?';
    sheet.appendChild(title);

    var rows = document.createElement('div');
    rows.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

    function sheetRow(icon, label, sub, accent, onClick) {
      var row = document.createElement('button');
      row.style.cssText = 'display:flex;align-items:center;gap:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:13px 16px;cursor:pointer;text-align:left;transition:background .15s;width:100%;';
      row.onmouseover = function () { row.style.background = 'rgba(255,255,255,0.1)'; };
      row.onmouseout  = function () { row.style.background = 'rgba(255,255,255,0.05)'; };
      row.innerHTML = '<span style="font-size:22px;flex-shrink:0;">' + icon + '</span><div style="flex:1;"><div style="font-size:14px;font-weight:700;color:' + accent + ';">' + label + '</div><div style="font-size:11px;color:var(--sub,#aaa);margin-top:2px;">' + sub + '</div></div><i class="fas fa-chevron-right" style="color:rgba(255,255,255,0.25);font-size:11px;"></i>';
      row.onclick = onClick;
      return row;
    }

    rows.appendChild(sheetRow('💬', 'Ask the Seller', 'Chat directly — free to negotiate', 'var(--text,#fff)', function () {
      _closeInterestSheet(); _sendEnquiryAndNavigate(status, selectedMedia);
    }));

    if (status.is_negotiable) {
      rows.appendChild(sheetRow('🤝', 'Make an Offer', 'Propose your price — seller can counter', '#e6a817', function () {
        _closeInterestSheet();
        openBargainSheet(_statusToListing(status), null, selectedMedia, 'offer', null);
      }));
    }

    rows.appendChild(sheetRow('🛒', 'Buy Now', status.price ? 'Purchase at ' + fmtK(status.price) : 'Purchase at listed price', '#25d366', function () {
      _closeInterestSheet();
      if (window.Asterix && window.Asterix.checkout) {
        window.Asterix.checkout.open(_statusToListing(status), selectedMedia, function () {});
      } else if (window.openBuyModal) {
        window.openBuyModal(status.status_id, status.price, status.caption || 'Item', selectedMedia ? selectedMedia.url : status.media_url, status.username);
      }
    }));

    sheet.appendChild(rows);
    var cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'width:100%;margin-top:16px;background:transparent;border:none;color:var(--sub,#aaa);font-size:13px;padding:8px;cursor:pointer;';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = function () { _closeInterestSheet(); if (window.Asterix && window.Asterix.status) window.Asterix.status.resumeViewer(); };
    sheet.appendChild(cancelBtn);

    overlay.appendChild(sheet);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { _closeInterestSheet(); if (window.Asterix && window.Asterix.status) window.Asterix.status.resumeViewer(); } });

    var svModal = document.getElementById('status-viewer-modal');
    if (svModal) svModal.appendChild(overlay);
  }

  function _closeInterestSheet() {
    var el = document.getElementById('fz-interest-overlay'); if (el) el.remove();
    var grid = document.querySelector('.sv-market-grid');
    if (grid && typeof grid._clearSelection === 'function') grid._clearSelection();
  }

  function _statusToListing(status) {
    return { status_id: status.status_id || status.id, caption: status.caption || '', price: status.price, is_negotiable: status.is_negotiable, availability: status.availability, media_url: status.media_url || '', username: status.username || '', is_commercial: status.is_commercial, collection_point: status.collection_point || '' };
  }

  function _sendEnquiryAndNavigate(status, selectedMedia) {
    var targetUser = status.username;
    if (targetUser === me()) { toast('Info', "That's your own listing."); return; }
    var priceText = status.price ? fmtK(status.price) : '';
    var quoteLine = '> 🏷️ Listing' + (status.caption ? ': ' + status.caption.slice(0, 60) : '') + (priceText ? ' — ' + priceText : '');
    var photoNote = selectedMedia ? '\n> 📸 Photo ' + (selectedMedia.index + 1) + ' of ' + selectedMedia.total : '';
    var messageText = quoteLine + photoNote + "\n\nHi, I'm interested in your listing. Can you tell me more?";
    var fd = new FormData();
    fd.append('recipient', targetUser); fd.append('message', messageText); fd.append('is_status_reply', 'true');
    if (status.status_id) fd.append('status_id', status.status_id);
    var mediaUrl = selectedMedia ? selectedMedia.url : (status.media_url || '');
    function finishSend() {
      if (!window.API || !window.API.sendMessage) return;
      API.sendMessage(fd).then(function (res) {
        if (res.ok && res.data.status === 'success') { _openChatWith(targetUser, status.profile_picture); }
        else toast('Error', (res.data && res.data.message) || 'Could not send enquiry.');
      }).catch(function () { toast('Error', 'Could not send enquiry.'); });
    }
    if (mediaUrl) {
      fetch('/api/status/proxy-media/?url=' + encodeURIComponent(mediaUrl))
        .then(function (r) { if (!r.ok) throw new Error(); return r.blob(); })
        .then(function (blob) { fd.append('files', blob, mediaUrl.split('/').pop().split('?')[0] || 'listing.jpg'); finishSend(); })
        .catch(finishSend);
    } else { finishSend(); }
  }

  function _openChatWith(username, pic) {
    if (window.Asterix && window.Asterix.chat) {
      window.Asterix.chat.addConversationItem({ username: username, profile_picture: pic || '' });
      window.Asterix.chat.openConversation(username);
      setTimeout(function () { window.Asterix.chat.loadMessages(username, true); }, 300);
    }
  }

  function openOfferFromBanner(rs) { openBargainSheet(rs, null, null, 'offer', null); }
  function openCounterFromCard(rs, offer, historyChain) {
    var mode = (offer.proposed_by !== me()) ? 'respond' : 'counter';
    openBargainSheet(rs, offer, null, mode, historyChain);
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────
  window.Asterix           = window.Asterix || {};
  window.Asterix.negotiate = {
    openBargainSheet:     openBargainSheet,
    openInterestSheet:    openInterestSheet,
    openOfferFromBanner:  openOfferFromBanner,
    openCounterFromCard:  openCounterFromCard,
    buildTransactionCard: buildTransactionCard,
  };

  window.openInterestSheet  = openInterestSheet;
  window.closeInterestSheet = _closeInterestSheet;

  console.log('[Fizzme] Negotiate v3 loaded — formal receipt cards + thread-wide lockdown + error-logged card build + line-item listing block');
})();