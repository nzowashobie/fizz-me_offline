// ============================================================
// negotiate.js — Fizzme in-chat Zambian bargaining engine
// ============================================================

(function () {
  'use strict';

  if (!window.Asterix) window.Asterix = {};

  function _fzProxy(url) {
    if (!url) return '';
    var s = String(url);
    if (s.indexOf('res.cloudinary.com') !== -1 || s.indexOf('cloudinary.com') !== -1) {
      return '/api/status/proxy-media/?url=' + encodeURIComponent(s);
    }
    return s;
  }

  window.Asterix.deals = {
    createOffer: function (statusId, amount, options) {
      options = options || {};
      return _apiPost('/api/offers/create/', {
        status_id:          statusId,
        amount:             amount,
        note:               options.note || '',
        selected_media_url: options.selectedMediaUrl || '',
      });
    },
    respondToOffer: function (offerId, action, amount, options) {
      options = options || {};
      var payload = { offer_id: offerId, action: action, note: options.note || '' };
      if (action === 'counter' && amount !== undefined) payload.amount = amount;
      return _apiPost('/api/offers/respond/', payload);
    },
    withdrawOffer: function (offerId) {
      return _apiPost('/api/offers/withdraw/', { offer_id: offerId });
    },
    takeListing: function (statusId, paymentMethod, deliveryAddress, instructions, selectedMediaUrl) {
      return _apiPost('/api/deals/take/', {
        status_id:             statusId,
        payment_method:        paymentMethod    || '',
        delivery_address:      deliveryAddress  || '',
        delivery_instructions: instructions     || '',
        selected_media_url:    selectedMediaUrl || '',
      });
    },
    confirmDeal: function (dealId) {
      return _apiPost('/api/deals/confirm/', { deal_id: dealId });
    },
    completeDeal: function (dealId, paymentMethod, paymentAccount, paymentRef) {
      return _apiPost('/api/deals/complete/', {
        deal_id:           dealId,
        payment_method:    paymentMethod  || '',
        payment_account:   paymentAccount || '',
        payment_reference: paymentRef     || '', // 👈 FIXED: Matches backend
      });
    },
    cancelDeal: function (dealId) {
      return _apiPost('/api/deals/cancel/', { deal_id: dealId });
    },
  };

  function _apiPost(url, data) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-CSRFToken', _getCsrf());
      xhr.onload = function () {
        var parsed;
        try { parsed = JSON.parse(xhr.responseText); }
        catch (e) { parsed = { error: xhr.responseText || 'Server error' }; }
        if (xhr.status >= 200 && xhr.status < 300) resolve(parsed);
        else {
          var err = new Error(parsed.error || 'Request failed');
          err.status = xhr.status; err.data = parsed;
          reject(err);
        }
      };
      xhr.onerror = function () { reject(new Error('Network error')); };
      xhr.ontimeout = function () { reject(new Error('Request timeout')); };
      xhr.timeout = 30000;
      xhr.send(JSON.stringify(data));
    });
  }

  function _getCsrf() {
    var cookies = document.cookie.split('; ');
    for (var i = 0; i < cookies.length; i++) {
      if (cookies[i].indexOf('csrftoken=') === 0) return cookies[i].slice('csrftoken='.length);
    }
    return (window.ASTERIX && window.ASTERIX.CSRF) || '';
  }

  // ── CSS ────────────────────────────────────────────────────
  (function injectCSS() {
    if (document.getElementById('fz-negotiate-css')) return;
    var s = document.createElement('style');
    s.id = 'fz-negotiate-css';
    s.textContent = [
      '#fz-bargain-overlay{position:fixed;inset:0;z-index:28000;background:rgba(0,0,0,0.75);display:flex;flex-direction:column;justify-content:flex-end;}',
      '@keyframes fzNegFade{from{opacity:0}to{opacity:1}}',
      '@keyframes fzNegSlide{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '#fz-bargain-sheet{background:linear-gradient(160deg,#1a2020 0%,#111616 100%);border-radius:22px 22px 0 0;border-top:2px solid #e6a817;max-height:90dvh;overflow-y:auto;padding:0 0 calc(16px + env(safe-area-inset-bottom));}',
      '.fz-neg-handle{width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.15);margin:12px auto 0;}',
      '.fz-neg-listing-pill{display:flex;align-items:center;gap:10px;background:rgba(230,168,23,0.08);border:1px solid rgba(230,168,23,0.2);border-radius:14px;padding:10px 14px;margin:14px 16px 0;}',
      '.fz-neg-listing-thumb{width:52px;height:52px;border-radius:9px;object-fit:cover;flex-shrink:0;border:2px solid #e6a817;background:var(--mid,#2a2f2f);}',
      '.fz-neg-listing-thumb-icon{width:52px;height:52px;border-radius:9px;flex-shrink:0;background:var(--mid,#2a2f2f);border:2px solid rgba(230,168,23,.3);display:flex;align-items:center;justify-content:center;font-size:22px;}',
      '.fz-neg-listing-info{flex:1;min-width:0;}',
      '.fz-neg-listing-title{font-size:13px;font-weight:700;color:var(--text,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.fz-neg-listing-price{font-size:14px;font-weight:800;color:#e6a817;margin-top:2px;}',
      '.fz-neg-listing-badge{font-size:10px;color:rgba(255,255,255,.5);background:rgba(255,255,255,.06);border-radius:6px;padding:2px 6px;margin-top:3px;display:inline-block;}',
      '.fz-neg-history{margin:14px 16px 0;display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto;}',
      '.fz-neg-hist-row{display:flex;justify-content:space-between;align-items:center;padding:7px 12px;background:rgba(255,255,255,.04);border-radius:10px;border:1px solid rgba(255,255,255,.07);font-size:12px;}',
      '.fz-neg-hist-who{color:rgba(255,255,255,.5);font-size:11px;}',
      '.fz-neg-hist-amt{font-weight:800;color:#e6a817;font-size:13px;}',
      '.fz-neg-hist-state{font-size:10px;padding:2px 7px;border-radius:8px;font-weight:700;}',
      '.fz-neg-hist-state.pending{background:rgba(230,168,23,.15);color:#e6a817;}',
      '.fz-neg-hist-state.accepted{background:rgba(37,211,102,.15);color:#25d366;}',
      '.fz-neg-hist-state.declined{background:rgba(241,92,109,.15);color:#f15c6d;}',
      '.fz-neg-hist-state.countered{background:rgba(43,140,255,.15);color:#2b8cff;}',
      '.fz-neg-hist-state.withdrawn{background:rgba(255,255,255,.07);color:#888;}',
      '.fz-neg-actions{padding:14px 16px 0;display:flex;flex-direction:column;gap:10px;}',
      '.fz-neg-label{font-size:10px;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.6px;font-weight:700;margin-bottom:-4px;}',
      '.fz-neg-input-row{display:flex;gap:8px;align-items:stretch;}',
      '.fz-neg-k{font-size:17px;font-weight:900;color:#e6a817;align-self:center;flex-shrink:0;}',
      '.fz-neg-amount{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(230,168,23,.35);border-radius:10px;padding:11px 12px;color:var(--text,#fff);font-size:17px;font-weight:700;outline:none;}',
      '.fz-neg-amount.err{border-color:#f15c6d;}',
      '.fz-neg-note{width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 12px;color:var(--text,#fff);font-size:13px;resize:none;outline:none;min-height:52px;font-family:inherit;}',
      '.fz-neg-btn-row{display:flex;gap:8px;flex-wrap:wrap;}',
      '.fz-neg-btn{flex:1;min-width:80px;border:none;border-radius:12px;padding:12px 10px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;}',
      '.fz-neg-btn:disabled{opacity:.45;cursor:default;}',
      '.fz-neg-btn.offer{background:#e6a817;color:#000;}',
      '.fz-neg-btn.accept{background:#25d366;color:#000;}',
      '.fz-neg-btn.decline{background:rgba(241,92,109,.15);color:#f15c6d;border:1px solid rgba(241,92,109,.35);}',
      '.fz-neg-btn.buy{background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;}',
      '.fz-neg-btn.cancel-close{background:transparent;color:rgba(255,255,255,.35);font-size:12px;flex:none;padding:8px 14px;}',
      '.fz-txn-card{margin-top:6px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);font-size:12px;}',
      '.fz-txn-header{display:flex;align-items:center;justify-content:space-between;padding:9px 12px 8px;}',
      '.fz-txn-header.offer-header{background:rgba(230,168,23,0.12);border-bottom:1px solid rgba(230,168,23,0.2);}',
      '.fz-txn-header.deal-header{background:rgba(37,211,102,0.12);border-bottom:1px solid rgba(37,211,102,0.2);}',
      '.fz-txn-header.closed-header{background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.08);}',
      '.fz-txn-header-left{display:flex;align-items:center;gap:7px;}',
      '.fz-txn-icon{font-size:16px;flex-shrink:0;}',
      '.fz-txn-type{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;}',
      '.fz-txn-type.offer-type{color:#e6a817;}',
      '.fz-txn-type.deal-type{color:#25d366;}',
      '.fz-txn-type.closed-type{color:rgba(255,255,255,.4);}',
      '.fz-txn-state{font-size:10px;font-weight:800;padding:3px 9px;border-radius:20px;}',
      '.fz-txn-state.pending{background:rgba(230,168,23,.2);color:#e6a817;}',
      '.fz-txn-state.accepted{background:rgba(37,211,102,.2);color:#25d366;}',
      '.fz-txn-state.countered{background:rgba(43,140,255,.2);color:#2b8cff;}',
      '.fz-txn-state.declined{background:rgba(241,92,109,.2);color:#f15c6d;}',
      '.fz-txn-state.withdrawn{background:rgba(255,255,255,.08);color:#888;}',
      '.fz-txn-state.pending_confirmation{background:rgba(230,168,23,.2);color:#e6a817;}',
      '.fz-txn-state.confirmed{background:rgba(43,140,255,.2);color:#2b8cff;}',
      '.fz-txn-state.completed{background:rgba(37,211,102,.2);color:#25d366;}',
      '.fz-txn-state.cancelled{background:rgba(241,92,109,.2);color:#f15c6d;}',
      '.fz-txn-body{padding:10px 12px;background:rgba(0,0,0,0.25);}',
      '.fz-txn-listing-row{display:flex;align-items:center;gap:9px;padding:8px 10px;margin-bottom:10px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.07);}',
      '.fz-txn-listing-thumb{width:40px;height:40px;border-radius:7px;object-fit:cover;flex-shrink:0;background:var(--mid,#2a2f2f);}',
      '.fz-txn-listing-icon{width:40px;height:40px;border-radius:7px;flex-shrink:0;background:var(--mid,#2a2f2f);display:flex;align-items:center;justify-content:center;font-size:17px;}',
      '.fz-txn-listing-info{flex:1;min-width:0;}',
      '.fz-txn-listing-name{font-size:12px;font-weight:700;color:var(--text,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.fz-txn-listing-price{font-size:11px;color:#e6a817;font-weight:700;margin-top:1px;}',
      '.fz-txn-amount-row{display:flex;align-items:baseline;gap:6px;margin-bottom:8px;}',
      '.fz-txn-amount-label{font-size:10px;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.4px;flex-shrink:0;}',
      '.fz-txn-amount{font-size:26px;font-weight:900;color:#e6a817;line-height:1;}',
      '.fz-txn-amount.deal-amount{color:#25d366;}',
      '.fz-txn-meta{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin-bottom:10px;}',
      '.fz-txn-meta-k{font-size:10px;color:rgba(255,255,255,.38);text-transform:uppercase;letter-spacing:.3px;}',
      '.fz-txn-meta-v{font-size:11px;color:rgba(255,255,255,.75);font-weight:600;}',
      '.fz-txn-note{font-size:12px;color:rgba(255,255,255,.7);font-style:italic;margin-bottom:8px;padding:8px 10px;background:rgba(230,168,23,.06);border-left:3px solid rgba(230,168,23,.5);border-radius:0 8px 8px 0;white-space:pre-wrap;word-break:break-word;}',
      '.fz-txn-message{font-size:12px;color:rgba(255,255,255,.75);line-height:1.5;margin-bottom:8px;padding:8px 10px;background:rgba(255,255,255,.03);border-radius:0 8px 8px 0;border-left:3px solid rgba(37,211,102,.7);white-space:pre-wrap;word-break:break-word;}',
      '.fz-txn-enquiry{margin-bottom:10px;padding:8px 10px;background:rgba(43,140,255,.06);border-left:3px solid rgba(43,140,255,.5);border-radius:0 8px 8px 0;}',
      '.fz-txn-enquiry-label{font-size:10px;color:rgba(43,140,255,.9);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;}',
      '.fz-txn-enquiry-body{font-size:12px;color:rgba(255,255,255,.8);line-height:1.5;white-space:pre-wrap;word-break:break-word;}',
      '.fz-txn-closed{display:flex;align-items:center;gap:8px;justify-content:center;padding:9px 12px;font-size:12px;font-weight:700;border-top:1px solid rgba(255,255,255,.07);}',
      '.fz-txn-closed.accepted{color:#25d366;background:rgba(37,211,102,.06);}',
      '.fz-txn-closed.countered{color:#2b8cff;background:rgba(43,140,255,.06);}',
      '.fz-txn-closed.declined{color:#f15c6d;background:rgba(241,92,109,.06);}',
      '.fz-txn-closed.withdrawn{color:#888;background:rgba(255,255,255,.04);}',
      '.fz-txn-closed.completed{color:#25d366;background:rgba(37,211,102,.06);}',
      '.fz-txn-closed.cancelled{color:#f15c6d;background:rgba(241,92,109,.06);}',
      '.fz-txn-btns{display:flex;gap:7px;flex-wrap:wrap;padding:0 12px 12px;}',
      '.fz-txn-btn{border:none;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex:1;min-width:70px;}',
      '.fz-txn-btn:disabled{opacity:.4;cursor:default;}',
      '.fz-txn-btn.accept{background:#25d366;color:#000;}',
      '.fz-txn-btn.counter{background:#e6a817;color:#000;}',
      '.fz-txn-btn.decline{background:rgba(241,92,109,.15);color:#f15c6d;border:1px solid rgba(241,92,109,.3);}',
      '.fz-txn-btn.withdraw{background:rgba(255,255,255,.07);color:rgba(255,255,255,.55);}',
      '.fz-txn-btn.confirm{background:#2b8cff;color:#fff;}',
      '.fz-txn-btn.pay{background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;}',
      '.fz-txn-btn.confirm-pay{background:linear-gradient(135deg,#e6a817,#25d366);color:#000;}',
      '.fz-txn-btn.cancel{background:rgba(241,92,109,.08);color:rgba(241,92,109,.6);border:1px solid rgba(241,92,109,.15);font-size:11px;}',
    ].join('\n');
    document.head.appendChild(s);
  })();

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
  function _isServerGeneratedMessage(text) {
    if (!text) return false;
    var patterns = [
      /Offer:\s*K[\d,]/, /Counter offer:\s*K[\d,]/, /Deal agreed at K[\d,]/, /Purchase request — K[\d,]/, /Payment confirmed — K[\d,]/, /Your offer was K[\d,]/,
    ];
    for (var i = 0; i < patterns.length; i++) if (patterns[i].test(text)) return true;
    return false;
  }

  function _findEnquiryTextForOffer(msg) {
    var all = window._currentMessages || [];
    if (!all.length) return '';
    var statusId = msg.related_status && msg.related_status.status_id;
    if (!statusId) return '';
    var offer = msg.offer;
    if (!offer) return '';
    var buyer = offer.buyer || '';

    for (var i = 0; i < all.length; i++) {
      var m = all[i];
      if (m.message_type && m.message_type !== 'text') continue;
      if (!m.related_status || m.related_status.status_id !== statusId) continue;
      if (buyer && m.sender !== buyer) continue;
      var text = (m.message || '').trim();
      if (!text) continue;
      var stripped = text.replace(/^>.*(?:\r?\n|$)/gm, '').trim();
      if (stripped && stripped.length > 5 && !_isServerGeneratedMessage(stripped)) {
        return stripped;
      }
    }
    return '';
  }

  function _resolveEnquiry(msg) {
    var rt = (msg.reply_text || '').trim();
    if (rt && rt.length > 5 && !_isServerGeneratedMessage(rt)) return rt;
    return _findEnquiryTextForOffer(msg);
  }

  function _routeBuyerToCheckout(res, sellerUsername) {
    if (!res || !res.deal_id) return;
    if (!(window.Asterix && window.Asterix.checkout)) return;
    var myName = me();
    var sellerName = sellerUsername || '';
    if (!myName) return;
    if (!sellerName || myName === sellerName) return;
    if (res.deal && res.deal.buyer && myName !== res.deal.buyer) return;
    setTimeout(function () {
      window.Asterix.checkout.openPaymentForDeal(
        res.deal_id, res.final_price, myName, sellerName,
        function () { refreshThread(); }
      );
    }, 800);
  }

  var _autoCheckoutFired = new Set();
  function _maybeAutoCheckout(deal, sellerUsername) {
    if (!deal || !deal.id) return;
    if (_autoCheckoutFired.has(deal.id)) return;
    if (!(window.Asterix && window.Asterix.checkout)) return;
    var myName = me();
    var buyerUsername = _displayName(deal.buyer);
    if (!buyerUsername || myName !== buyerUsername) return;
    if (!sellerUsername || myName === sellerUsername) return;
    if (deal.buyer_confirmed) return;
    _autoCheckoutFired.add(deal.id);
    setTimeout(function () {
      toast('🎉 Offer accepted!', 'The seller agreed — complete your purchase.');
      window.Asterix.checkout.openPaymentForDeal(
        deal.id, deal.final_price, myName, sellerUsername,
        function () { refreshThread(); }
      );
    }, 1200);
  }

  function buildTransactionCard(msg) {
    try {
      var myName = me();
      if (msg.message_type === 'offer' && msg.offer) return _buildOfferCard(msg, myName);
      if ((msg.message_type === 'deal_confirmation' || msg.message_type === 'status_update') && msg.deal) {
        return _buildDealCard(msg, myName);
      }
      if (msg.message_type === 'status_update') {
        var el = document.createElement('div');
        el.style.cssText = 'font-size:11px;color:rgba(255,255,255,.45);font-style:italic;margin-top:4px;padding:5px 8px;border-left:2px solid rgba(255,255,255,.12);border-radius:0 4px 4px 0;';
        el.textContent = msg.message;
        return el;
      }
      return null;
    } catch (err) {
      console.error('[Fizzme] buildTransactionCard failed', msg.id, err);
      return null;
    }
  }

  function _buildOfferCard(msg, myName) {
    var offer = msg.offer;
    var rs = msg.related_status;
    var isPending = offer.state === 'pending';

    var card = document.createElement('div');
    card.className = 'fz-txn-card';

    var header = document.createElement('div');
    header.className = 'fz-txn-header ' + (isPending ? 'offer-header' : 'closed-header');
    var left = document.createElement('div'); left.className = 'fz-txn-header-left';
    var icon = document.createElement('span'); icon.className = 'fz-txn-icon'; icon.textContent = _offerIcon(offer);
    var typeLabel = document.createElement('span'); typeLabel.className = 'fz-txn-type ' + (isPending ? 'offer-type' : 'closed-type'); typeLabel.textContent = _offerTypeLabel(offer, myName);
    left.appendChild(icon); left.appendChild(typeLabel);
    var statePill = document.createElement('span'); statePill.className = 'fz-txn-state ' + (offer.state || 'pending'); statePill.textContent = _stateLabel(offer.state);
    header.appendChild(left); header.appendChild(statePill);
    card.appendChild(header);

    var body = document.createElement('div'); body.className = 'fz-txn-body';

    var selectedMediaUrl = msg.reply_media || (rs && rs.media_url);
    if (rs && rs.is_commercial) body.appendChild(_buildListingRow(rs, selectedMediaUrl));

    var amtRow = document.createElement('div'); amtRow.className = 'fz-txn-amount-row';
    var amtLabel = document.createElement('span'); amtLabel.className = 'fz-txn-amount-label';
    amtLabel.textContent = offer.state === 'accepted' ? 'Agreed price' : 'Offered price';
    var amtEl = document.createElement('span'); amtEl.className = 'fz-txn-amount'; amtEl.textContent = fmtK(offer.amount);
    amtRow.appendChild(amtLabel); amtRow.appendChild(amtEl);
    body.appendChild(amtRow);

    var meta = document.createElement('div'); meta.className = 'fz-txn-meta';
    _addMeta(meta, 'Proposed by', offer.proposed_by);
    _addMeta(meta, 'Time', _fmtDate(offer.created_at));
    if (rs && rs.collection_point) _addMeta(meta, 'Collection', rs.collection_point);
    body.appendChild(meta);

    var noteText = (offer.note || '').trim();
    if (noteText) {
      var noteEl = document.createElement('div');
      noteEl.className = 'fz-txn-note';
      noteEl.textContent = '\u201C' + noteText + '\u201D';
      body.appendChild(noteEl);
    }

    var enquiryText = _resolveEnquiry(msg);
    if (enquiryText) {
      var eqWrap = document.createElement('div');
      eqWrap.className = 'fz-txn-enquiry';
      var eqLabel = document.createElement('div');
      eqLabel.className = 'fz-txn-enquiry-label';
      eqLabel.textContent = '📩 Original enquiry';
      eqWrap.appendChild(eqLabel);
      var eqBody = document.createElement('div');
      eqBody.className = 'fz-txn-enquiry-body';
      eqBody.textContent = enquiryText;
      eqWrap.appendChild(eqBody);
      body.appendChild(eqWrap);
    }

    var rawMsg = (msg.message || '').trim();
    if (rawMsg && !_isServerGeneratedMessage(rawMsg)) {
      var msgTextEl = document.createElement('div');
      msgTextEl.className = 'fz-txn-message';
      msgTextEl.textContent = rawMsg;
      body.appendChild(msgTextEl);
    }
    card.appendChild(body);

    if (!isPending) {
      var cb = document.createElement('div');
      cb.className = 'fz-txn-closed ' + (offer.state || '');
      cb.textContent = _closedBannerText(offer.state);
      card.appendChild(cb);
      return card;
    }

    var iProposed = offer.proposed_by === myName;
    var iCanRespond = !iProposed;
    var sellerUsername = (rs && rs.username) ? rs.username : '';

    if (iProposed) {
      var bw = document.createElement('div'); bw.className = 'fz-txn-btns';
      var wdBtn = _txnBtn('↩️ Withdraw', 'withdraw', function () {
        if (!confirm('Withdraw your offer of ' + fmtK(offer.amount) + '?')) return;
        wdBtn.disabled = true;
        window.Asterix.deals.withdrawOffer(offer.id)
          .then(function () { toast('Offer withdrawn', ''); refreshThread(); })
          .catch(function (err) { wdBtn.disabled = false; toast('Error', err.message || ''); });
      });
      bw.appendChild(wdBtn);
      card.appendChild(bw);
    } else if (iCanRespond) {
      var bw2 = document.createElement('div'); bw2.className = 'fz-txn-btns';
      var accBtn = _txnBtn('✅ Accept  ' + fmtK(offer.amount), 'accept', function () {
        _disableAll(bw2);
        window.Asterix.deals.respondToOffer(offer.id, 'accept')
          .then(function (res) {
            toast('Deal agreed! 🎉', fmtK(offer.amount));
            refreshThread();
            _routeBuyerToCheckout(res, sellerUsername);
          })
          .catch(function (err) { _enableAll(bw2); toast('Error', err.message || ''); });
      });
      var cntBtn = _txnBtn('🔄 Counter', 'counter', function () {
        openBargainSheet(
          rs || { status_id: null, caption: msg.message, price: offer.amount, is_negotiable: true },
          offer, null, 'counter', null
        );
      });
      var decBtn = _txnBtn('❌ Decline', 'decline', function () {
        if (!confirm('Decline this offer?')) return;
        _disableAll(bw2);
        window.Asterix.deals.respondToOffer(offer.id, 'decline')
          .then(function () { toast('Offer declined', ''); refreshThread(); })
          .catch(function (err) { _enableAll(bw2); toast('Error', err.message || ''); });
      });
      bw2.appendChild(accBtn); bw2.appendChild(cntBtn); bw2.appendChild(decBtn);
      card.appendChild(bw2);
    }
    return card;
  }

  function _buildDealCard(msg, myName) {
    var deal = msg.deal;
    var rs = msg.related_status;
    var isTerminal = (deal.state === 'completed' || deal.state === 'cancelled');
    var isConfirmed = deal.state === 'confirmed';

    var sellerUsername = _displayName(deal.seller);
    var isBuyer = myName === _displayName(deal.buyer);
    var isSeller = myName === sellerUsername;

    if (isBuyer && deal.state === 'pending_confirmation' && !deal.buyer_confirmed) {
      _maybeAutoCheckout(deal, sellerUsername);
    }

    var card = document.createElement('div'); card.className = 'fz-txn-card';

    var header = document.createElement('div');
    header.className = 'fz-txn-header ' + (isTerminal ? 'closed-header' : 'deal-header');
    var left = document.createElement('div'); left.className = 'fz-txn-header-left';
    var icon = document.createElement('span'); icon.className = 'fz-txn-icon'; icon.textContent = _dealIcon(deal.state);
    var typeLabel = document.createElement('span'); typeLabel.className = 'fz-txn-type ' + (isTerminal ? 'closed-type' : 'deal-type'); typeLabel.textContent = 'Transaction Receipt';
    left.appendChild(icon); left.appendChild(typeLabel);
    var statePill = document.createElement('span'); statePill.className = 'fz-txn-state ' + (deal.state || ''); statePill.textContent = _dealStateLabel(deal.state);
    header.appendChild(left); header.appendChild(statePill);
    card.appendChild(header);

    var body = document.createElement('div'); body.className = 'fz-txn-body';
    var selectedMediaUrl = msg.reply_media || (rs && rs.media_url);
    if (rs && rs.is_commercial) body.appendChild(_buildListingRow(rs, selectedMediaUrl));

    var amtRow = document.createElement('div'); amtRow.className = 'fz-txn-amount-row';
    var amtLabel = document.createElement('span'); amtLabel.className = 'fz-txn-amount-label'; amtLabel.textContent = 'Final price';
    var amtEl = document.createElement('span'); amtEl.className = 'fz-txn-amount deal-amount'; amtEl.textContent = fmtK(deal.final_price);
    amtRow.appendChild(amtLabel); amtRow.appendChild(amtEl);
    body.appendChild(amtRow);

    var meta = document.createElement('div'); meta.className = 'fz-txn-meta';
    _addMeta(meta, 'Buyer', _displayName(deal.buyer));
    _addMeta(meta, 'Seller', sellerUsername);
    if (deal.payment_method) _addMeta(meta, 'Payment', deal.payment_method.replace(/_/g, ' '));
    if (deal.collection_point) _addMeta(meta, 'Collection', deal.collection_point);
    _addMeta(meta, 'Buyer confirmed', (deal.buyer_confirmed ? '✅' : '⏳') + ' ' + (deal.buyer_confirmed ? 'Yes' : 'Pending'));
    _addMeta(meta, 'Seller confirmed', (deal.seller_confirmed ? '✅' : '⏳') + ' ' + (deal.seller_confirmed ? 'Yes' : 'Pending'));
    body.appendChild(meta);

    var enquiryText = _resolveEnquiry(msg);
    if (enquiryText) {
      var eqWrap = document.createElement('div');
      eqWrap.className = 'fz-txn-enquiry';
      var eqLabel = document.createElement('div'); eqLabel.className = 'fz-txn-enquiry-label'; eqLabel.textContent = '📩 Original enquiry';
      eqWrap.appendChild(eqLabel);
      var eqBody = document.createElement('div'); eqBody.className = 'fz-txn-enquiry-body'; eqBody.textContent = enquiryText;
      eqWrap.appendChild(eqBody);
      body.appendChild(eqWrap);
    }

    var rawDealMsg = (msg.message || '').trim();
    if (rawDealMsg && !_isServerGeneratedMessage(rawDealMsg)) {
      var dealMsgEl = document.createElement('div'); dealMsgEl.className = 'fz-txn-message';
      dealMsgEl.textContent = rawDealMsg;
      body.appendChild(dealMsgEl);
    }
    card.appendChild(body);

    if (isTerminal) {
      if (deal.state === 'completed') {
        var tbar = document.createElement('div');
        tbar.style.cssText = 'display:flex;gap:8px;padding:8px 12px 10px;';
        var tbtn = document.createElement('a');
        tbtn.href = '/deals/' + deal.id + '/delivery/';
        tbtn.textContent = (myName === _displayName(deal.seller)) ? '💳 Review payment & accept' : '🚚 Track delivery';
        tbtn.style.cssText = 'flex:1;text-align:center;padding:10px;border-radius:20px;background:#25d366;color:#000;font-weight:700;text-decoration:none;';
        var rbtn = document.createElement('a');
        rbtn.href = '/deals/' + deal.id + '/receipt/';
        rbtn.textContent = '🧾 View receipt';
        rbtn.style.cssText = 'flex:1;text-align:center;padding:10px;border-radius:20px;background:#e6a817;color:#000;font-weight:700;text-decoration:none;';
        tbar.appendChild(tbtn); tbar.appendChild(rbtn);
        card.appendChild(tbar);
      }
      var cb = document.createElement('div');
      cb.className = 'fz-txn-closed ' + deal.state;
      cb.textContent = deal.state === 'completed'
        ? '✅ Transaction complete — payment released'
        : '❌ Deal cancelled — item available again';
      card.appendChild(cb);
      return card;
    }

    var bw = document.createElement('div'); bw.className = 'fz-txn-btns';

    if (deal.state === 'pending_confirmation') {
      var myConfirmed = (isBuyer && deal.buyer_confirmed) || (isSeller && deal.seller_confirmed);
      if (isBuyer && !myConfirmed) {
        var cpBtn = _txnBtn('💳 Confirm & Pay  ' + fmtK(deal.final_price), 'confirm-pay', function () {
          cpBtn.disabled = true; cpBtn.textContent = '…';
          window.Asterix.deals.confirmDeal(deal.id)
            .then(function () {
              if (window.Asterix && window.Asterix.checkout) {
                window.Asterix.checkout.openPaymentForDeal(
                  deal.id, deal.final_price, myName, sellerUsername,
                  function () { refreshThread(); }
                );
              } else { refreshThread(); }
            })
            .catch(function (err) {
              if (err.status === 400 && err.data && (err.data.error || '').includes('already')) {
                if (window.Asterix && window.Asterix.checkout) {
                  window.Asterix.checkout.openPaymentForDeal(
                    deal.id, deal.final_price, myName, sellerUsername,
                    function () { refreshThread(); }
                  );
                }
              } else {
                cpBtn.disabled = false; cpBtn.textContent = '💳 Confirm & Pay  ' + fmtK(deal.final_price);
                toast('Error', err.message || '');
              }
            });
        });
        bw.appendChild(cpBtn);
      } else if (isSeller && !myConfirmed) {
        var sConfBtn = _txnBtn('✅ Confirm my side', 'confirm', function () {
          sConfBtn.disabled = true; sConfBtn.textContent = '…';
          window.Asterix.deals.confirmDeal(deal.id)
            .then(function () { toast('Confirmed!', ''); refreshThread(); })
            .catch(function (err) { sConfBtn.disabled = false; sConfBtn.textContent = '✅ Confirm my side'; toast('Error', err.message || ''); });
        });
        bw.appendChild(sConfBtn);
      } else {
        var waitEl = document.createElement('div');
        waitEl.style.cssText = 'font-size:11px;color:rgba(255,255,255,.4);font-style:italic;padding:4px 2px 10px;';
        waitEl.textContent = isBuyer ? '✓ You confirmed — complete payment to proceed.' : '✓ You confirmed — waiting for the buyer to pay.';
        bw.appendChild(waitEl);
        if (isBuyer && deal.buyer_confirmed) {
          var payBtn2 = _txnBtn('💳 Pay  ' + fmtK(deal.final_price), 'pay', function () {
            if (window.Asterix && window.Asterix.checkout) {
              window.Asterix.checkout.openPaymentForDeal(deal.id, deal.final_price, myName, sellerUsername, function () { refreshThread(); });
            }
          });
          bw.appendChild(payBtn2);
        }
      }
    }

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
      bw.appendChild(setupBtn);
    }

    if (isConfirmed && isBuyer) {
      var payBtn = _txnBtn('💳 Pay  ' + fmtK(deal.final_price), 'pay', function () {
        if (window.Asterix && window.Asterix.checkout) {
          window.Asterix.checkout.openPaymentForDeal(deal.id, deal.final_price, myName, sellerUsername, function () { refreshThread(); });
        } else if (window.Asterix && window.Asterix.payment) {
          window.Asterix.payment.open(deal.id, deal.final_price, myName, sellerUsername, function () { refreshThread(); });
        }
      });
      bw.appendChild(payBtn);
    }

    if (isBuyer || isSeller) {
      var cancelBtn = _txnBtn('Cancel deal', 'cancel', function () {
        if (!confirm('Cancel this deal? The item will go back to available.')) return;
        cancelBtn.disabled = true;
        window.Asterix.deals.cancelDeal(deal.id)
          .then(function () { toast('Deal cancelled', 'Item is available again.'); refreshThread(); })
          .catch(function (err) { cancelBtn.disabled = false; toast('Error', err.message || ''); });
      });
      bw.appendChild(cancelBtn);
    }

    if (bw.children.length) card.appendChild(bw);
    return card;
  }

  function _buildListingRow(rs, overrideMediaUrl) {
    var row = document.createElement('div');
    row.className = 'fz-txn-listing-row';
    var thumbUrl = overrideMediaUrl || (rs && rs.media_url);
    if (thumbUrl) {
      var img = document.createElement('img');
      img.className = 'fz-txn-listing-thumb';
      img.src = _fzProxy(thumbUrl);
      img.onerror = function () {
        if (!img.dataset.triedFallback && rs && rs.media_url && img.src !== _fzProxy(rs.media_url)) {
          img.dataset.triedFallback = '1';
          img.src = _fzProxy(rs.media_url);
          return;
        }
        img.replaceWith(_listingIcon());
      };
      row.appendChild(img);
    } else { row.appendChild(_listingIcon()); }
    var info = document.createElement('div'); info.className = 'fz-txn-listing-info';
    var name = document.createElement('div'); name.className = 'fz-txn-listing-name';
    name.textContent = (rs.caption || 'Listing').slice(0, 50);
    var price = document.createElement('div'); price.className = 'fz-txn-listing-price';
    price.textContent = rs.price ? fmtK(rs.price) + (rs.is_negotiable ? '  · negotiable' : '  · fixed price') : 'Price on request';
    info.appendChild(name); info.appendChild(price);
    row.appendChild(info);
    return row;
  }
  function _listingIcon() { var d = document.createElement('div'); d.className = 'fz-txn-listing-icon'; d.textContent = '🏷️'; return d; }
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
      return d.toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' }) + '  ' + d.toLocaleTimeString('en-ZM', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }
  function _txnBtn(label, cls, onClick) {
    var btn = document.createElement('button');
    btn.className = 'fz-txn-btn ' + cls;
    btn.textContent = label;
    btn.onclick = function (e) { e.stopPropagation(); onClick(); };
    return btn;
  }
  function _disableAll(c) { c.querySelectorAll('button').forEach(function (b) { b.disabled = true; }); }
  function _enableAll(c) { c.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); }
  function _stateLabel(s) { return ({pending:'Pending',accepted:'Accepted ✅',countered:'Countered 🔄',declined:'Declined ❌',withdrawn:'Withdrawn'})[s] || s || 'Pending'; }
  function _dealStateLabel(s) { return ({pending_confirmation:'Awaiting Confirmation',confirmed:'Confirmed',completed:'Completed ✅',cancelled:'Cancelled ❌'})[s] || s || ''; }
  function _closedBannerText(s) { return ({accepted:'✅ Offer accepted — deal created',countered:'🔄 Countered — see latest offer below',declined:'❌ Offer declined',withdrawn:'Offer withdrawn'})[s] || 'Closed'; }
  function _offerIcon(offer) { return ({pending:'🤝',accepted:'✅',countered:'🔄',declined:'❌',withdrawn:'↩️'})[offer.state] || '🤝'; }
  function _dealIcon(s) { return ({pending_confirmation:'⏳',confirmed:'✅',completed:'💰',cancelled:'❌'})[s] || '🤝'; }
  function _offerTypeLabel(offer, myName) {
    if (offer.state === 'countered') return 'Counter Offer';
    if (offer.state !== 'pending') return 'Offer';
    return offer.proposed_by === myName ? 'Your Offer' : 'Incoming Offer';
  }

  function openBargainSheet(listingData, offerData, selectedMedia, mode, historyChain) {
    _closeSheet();
    var overlay = document.createElement('div');
    overlay.id = 'fz-bargain-overlay';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) _closeSheet(); });
    var sheet = document.createElement('div'); sheet.id = 'fz-bargain-sheet';
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    var handle = document.createElement('div'); handle.className = 'fz-neg-handle'; sheet.appendChild(handle);

    var pill = document.createElement('div'); pill.className = 'fz-neg-listing-pill';
    var thumbUrl = (selectedMedia && selectedMedia.url) || listingData.media_url || '';
    if (thumbUrl) {
      var img = document.createElement('img');
      img.className = 'fz-neg-listing-thumb'; img.src = _fzProxy(thumbUrl);
      img.onerror = function () { img.replaceWith(_iconThumb()); };
      pill.appendChild(img);
    } else { pill.appendChild(_iconThumb()); }

    var info = document.createElement('div'); info.className = 'fz-neg-listing-info';
    var titleEl = document.createElement('div'); titleEl.className = 'fz-neg-listing-title';
    titleEl.textContent = (listingData.caption || 'Listing').slice(0, 60);
    info.appendChild(titleEl);
    if (listingData.price) {
      var priceEl = document.createElement('div'); priceEl.className = 'fz-neg-listing-price';
      priceEl.textContent = fmtK(listingData.price) + (listingData.is_negotiable ? '  · negotiable' : '  · fixed');
      info.appendChild(priceEl);
    }
    if (selectedMedia) {
      var badge = document.createElement('div'); badge.className = 'fz-neg-listing-badge';
      badge.textContent = '📸 Photo ' + (selectedMedia.index + 1) + ' of ' + selectedMedia.total + ' selected';
      info.appendChild(badge);
    }
    pill.appendChild(info); sheet.appendChild(pill);

    if (historyChain && historyChain.length) {
      var histTitle = document.createElement('div');
      histTitle.style.cssText = 'font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin:14px 16px 0;';
      histTitle.textContent = 'Negotiation history';
      sheet.appendChild(histTitle);
      var hist = document.createElement('div'); hist.className = 'fz-neg-history';
      historyChain.forEach(function (o) {
        var row = document.createElement('div'); row.className = 'fz-neg-hist-row';
        var left2 = document.createElement('div');
        left2.innerHTML = '<div class="fz-neg-hist-who">' + o.proposed_by + '</div><div class="fz-neg-hist-amt">' + fmtK(o.amount) + '</div>';
        var stEl = document.createElement('span'); stEl.className = 'fz-neg-hist-state ' + (o.state || 'pending'); stEl.textContent = _stateLabel(o.state);
        row.appendChild(left2); row.appendChild(stEl);
        hist.appendChild(row);
      });
      sheet.appendChild(hist);
    }

    var actions = document.createElement('div'); actions.className = 'fz-neg-actions'; sheet.appendChild(actions);
    var myName = me();
    var iAmBuyer = listingData.username !== myName;

    if (mode === 'respond' && offerData) {
      _buildRespondUI(actions, listingData, offerData, selectedMedia, myName, !iAmBuyer);
    } else {
      _buildOfferUI(actions, listingData, offerData, selectedMedia, myName, iAmBuyer, mode);
    }

    var closeBtn = document.createElement('button'); closeBtn.className = 'fz-neg-btn cancel-close';
    closeBtn.textContent = 'Cancel'; closeBtn.onclick = _closeSheet;
    actions.appendChild(closeBtn);
  }

  function _iconThumb() { var d = document.createElement('div'); d.className = 'fz-neg-listing-thumb-icon'; d.textContent = '🏷️'; return d; }

  function _buildOfferUI(container, listing, existingOffer, selectedMedia, myName, iAmBuyer, mode) {
    var labelEl = document.createElement('div'); labelEl.className = 'fz-neg-label';
    labelEl.textContent = mode === 'counter' ? 'Your counter price' : (iAmBuyer ? 'Your offer price' : 'Counter price');
    container.appendChild(labelEl);

    var inputRow = document.createElement('div'); inputRow.className = 'fz-neg-input-row';
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

    var btnRow = document.createElement('div'); btnRow.className = 'fz-neg-btn-row';
    var sendBtn = document.createElement('button'); sendBtn.className = 'fz-neg-btn offer';
    sendBtn.textContent = mode === 'counter' ? '🔄 Send Counter' : '🤝 Send Offer';
    sendBtn.onclick = function () {
      var amt = parseFloat(amtEl.value);
      if (isNaN(amt) || amt <= 0) { amtEl.classList.add('err'); amtEl.focus(); return; }
      amtEl.classList.remove('err');
      sendBtn.disabled = true; sendBtn.textContent = '…';
      var note = noteEl.value.trim();
      var smUrl = selectedMedia ? selectedMedia.url : '';
      var doSend = (mode === 'counter' && existingOffer)
        ? window.Asterix.deals.respondToOffer(existingOffer.id, 'counter', amt, { note: note })
        : window.Asterix.deals.createOffer(listing.status_id || listing.id, amt, { selectedMediaUrl: smUrl, note: note });
      doSend
        .then(function () { toast('Offer sent 🤝', fmtK(amt)); _closeSheet(); refreshThread(); })
        .catch(function (err) {
          sendBtn.disabled = false;
          sendBtn.textContent = mode === 'counter' ? '🔄 Send Counter' : '🤝 Send Offer';
          if (err.data && err.data.error && err.data.error.includes('already have a pending')) {
            toast('Offer pending', 'Withdraw your existing offer first.'); _closeSheet();
          } else {
            toast('Error', (err && err.message) || 'Could not send offer.');
          }
        });
    };
    btnRow.appendChild(sendBtn);

    if (iAmBuyer && listing.price) {
      var buyBtn = document.createElement('button'); buyBtn.className = 'fz-neg-btn buy';
      buyBtn.textContent = '🛒 Buy Now  ' + fmtK(listing.price);
      buyBtn.onclick = function () {
        _closeSheet();
        if (window.Asterix && window.Asterix.checkout) {
          window.Asterix.checkout.open(listing, selectedMedia, function () { refreshThread(); });
        }
      };
      btnRow.appendChild(buyBtn);
    }
    container.appendChild(btnRow);
  }

  function _buildRespondUI(container, listing, offer, selectedMedia, myName, iAmSeller) {
    var sellerUsername = listing.username || '';
    var incomingEl = document.createElement('div');
    incomingEl.style.cssText = 'text-align:center;padding:8px 0;';
    incomingEl.innerHTML =
      '<div style="font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px;">Buyer\'s offer</div>' +
      '<div style="font-size:28px;font-weight:900;color:#e6a817;margin:4px 0;">' + fmtK(offer.amount) + '</div>' +
      (listing.price ? '<div style="font-size:11px;color:rgba(255,255,255,.35);">Listed at ' + fmtK(listing.price) + '</div>' : '');
    container.appendChild(incomingEl);

    if (offer.note) {
      var nEl = document.createElement('div'); nEl.className = 'fz-txn-note';
      nEl.textContent = '\u201C' + offer.note + '\u201D';
      container.appendChild(nEl);
    }

    var noteEl = document.createElement('textarea');
    noteEl.className = 'fz-neg-note';
    noteEl.placeholder = '💬 Add a note to your response (optional)…';
    noteEl.maxLength = 200;
    container.appendChild(noteEl);

    var counterLabel = document.createElement('div'); counterLabel.className = 'fz-neg-label';
    counterLabel.style.marginTop = '6px'; counterLabel.textContent = 'Counter with (optional)';
    container.appendChild(counterLabel);

    var inputRow = document.createElement('div'); inputRow.className = 'fz-neg-input-row';
    var kEl = document.createElement('div'); kEl.className = 'fz-neg-k'; kEl.textContent = 'K';
    var amtEl = document.createElement('input');
    amtEl.type = 'number'; amtEl.min = '0.01'; amtEl.step = '0.01';
    amtEl.className = 'fz-neg-amount';
    amtEl.placeholder = listing.price ? parseFloat(listing.price).toFixed(2) : '0.00';
    inputRow.appendChild(kEl); inputRow.appendChild(amtEl);
    container.appendChild(inputRow);

    var btnRow = document.createElement('div'); btnRow.className = 'fz-neg-btn-row';

    var acceptBtn = document.createElement('button'); acceptBtn.className = 'fz-neg-btn accept';
    acceptBtn.textContent = '✅ Accept  ' + fmtK(offer.amount);
    acceptBtn.onclick = function () {
      _disableAll(btnRow);
      window.Asterix.deals.respondToOffer(offer.id, 'accept', null, { note: noteEl.value.trim() })
        .then(function (res) {
          toast('Deal agreed! 🎉', fmtK(offer.amount));
          _closeSheet(); refreshThread();
          _routeBuyerToCheckout(res, sellerUsername);
        })
        .catch(function (err) { _enableAll(btnRow); acceptBtn.textContent = '✅ Accept  ' + fmtK(offer.amount); toast('Error', (err && err.message) || ''); });
    };

    var counterBtn = document.createElement('button'); counterBtn.className = 'fz-neg-btn offer';
    counterBtn.textContent = '🔄 Counter';
    counterBtn.onclick = function () {
      var amt = parseFloat(amtEl.value);
      if (isNaN(amt) || amt <= 0) { amtEl.classList.add('err'); amtEl.focus(); return; }
      amtEl.classList.remove('err');
      _disableAll(btnRow);
      window.Asterix.deals.respondToOffer(offer.id, 'counter', amt, { note: noteEl.value.trim() })
        .then(function () { toast('Counter sent 🔄', fmtK(amt)); _closeSheet(); refreshThread(); })
        .catch(function (err) { _enableAll(btnRow); counterBtn.textContent = '🔄 Counter'; toast('Error', (err && err.message) || ''); });
    };

    var declineBtn = document.createElement('button'); declineBtn.className = 'fz-neg-btn decline';
    declineBtn.textContent = '❌ Decline';
    declineBtn.onclick = function () {
      if (!confirm('Decline this offer?')) return;
      _disableAll(btnRow);
      window.Asterix.deals.respondToOffer(offer.id, 'decline', null, { note: noteEl.value.trim() })
        .then(function () { toast('Offer declined', ''); _closeSheet(); refreshThread(); })
        .catch(function (err) { _enableAll(btnRow); toast('Error', (err && err.message) || ''); });
    };

    btnRow.appendChild(acceptBtn); btnRow.appendChild(counterBtn); btnRow.appendChild(declineBtn);
    container.appendChild(btnRow);
  }

  function _disableAll(row) { row.querySelectorAll('button').forEach(function (b) { b.disabled = true; }); }
  function _enableAll(row) { row.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); }

  function openInterestSheet(status, selectedMedia) {
    if (window.Asterix && window.Asterix.status) window.Asterix.status.pauseViewer();
    var overlay = document.getElementById('fz-interest-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'fz-interest-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);';

    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--card,#1e1e1e);border-radius:20px 20px 0 0;padding:20px 18px 28px;';
    var hasSelected = !!(selectedMedia && selectedMedia.url);

    var pill = document.createElement('div');
    pill.style.cssText = 'border-radius:12px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,0.08);' + (hasSelected ? 'background:rgba(230,168,23,0.08);border-color:rgba(230,168,23,0.2);' : 'background:rgba(255,255,255,0.05);');

    if (hasSelected) {
      var selThumb = document.createElement('div');
      selThumb.style.cssText = 'width:56px;height:56px;border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--mid,#2a2f2f);border:2px solid #e6a817;';
      var selImg = document.createElement('img');
      selImg.src = _fzProxy(selectedMedia.url);
      selImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      selImg.onerror = function () { selThumb.innerHTML = '<span style="font-size:22px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">🏷️</span>'; };
      selThumb.appendChild(selImg); pill.appendChild(selThumb);
      var selInfo = document.createElement('div'); selInfo.style.cssText = 'flex:1;min-width:0;';
      var photoLabel = document.createElement('div');
      photoLabel.style.cssText = 'font-size:10px;color:#e6a817;font-weight:700;text-transform:uppercase;margin-bottom:3px;';
      photoLabel.textContent = 'Photo ' + (selectedMedia.index + 1) + ' of ' + selectedMedia.total + ' selected';
      var selCaption = document.createElement('div');
      selCaption.style.cssText = 'font-size:13px;font-weight:700;color:var(--text,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      selCaption.textContent = (selectedMedia.caption || status.caption || 'Listing').slice(0, 55);
      selInfo.appendChild(photoLabel); selInfo.appendChild(selCaption);
      if (status.price) {
        var selPrice = document.createElement('div');
        selPrice.style.cssText = 'font-size:12px;color:#e6a817;font-weight:600;margin-top:2px;';
        selPrice.textContent = fmtK(status.price) + (status.is_negotiable ? ' · negotiable' : '');
        selInfo.appendChild(selPrice);
      }
      pill.appendChild(selInfo);
    } else {
      var iconSpan = document.createElement('span');
      iconSpan.style.cssText = 'font-size:20px;flex-shrink:0;'; iconSpan.textContent = '🏷️';
      var pillInfo = document.createElement('div');
      pillInfo.innerHTML = '<div style="font-size:13px;font-weight:700;color:var(--text,#fff);">' + (status.caption || 'Listing').slice(0, 60) + '</div>' +
        (status.price ? '<div style="font-size:12px;color:#e6a817;font-weight:600;">' + fmtK(status.price) + (status.is_negotiable ? ' · negotiable' : '') + '</div>' : '');
      pill.appendChild(iconSpan); pill.appendChild(pillInfo);
    }
    sheet.appendChild(pill);

    var title = document.createElement('div');
    title.style.cssText = 'font-size:11px;color:var(--sub,#aaa);text-transform:uppercase;font-weight:700;margin-bottom:12px;';
    title.textContent = hasSelected ? 'Interested in this item?' : 'How do you want to proceed?';
    sheet.appendChild(title);

    var rows = document.createElement('div'); rows.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

    function sheetRow(icon, label, sub, accent, onClick) {
      var row = document.createElement('button');
      row.style.cssText = 'display:flex;align-items:center;gap:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:13px 16px;cursor:pointer;text-align:left;width:100%;';
      row.innerHTML = '<span style="font-size:22px;flex-shrink:0;">' + icon + '</span><div style="flex:1;"><div style="font-size:14px;font-weight:700;color:' + accent + ';">' + label + '</div><div style="font-size:11px;color:var(--sub,#aaa);margin-top:2px;">' + sub + '</div></div>';
      row.onclick = onClick; return row;
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
      }
    }));
    sheet.appendChild(rows);

    var cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'width:100%;margin-top:16px;background:transparent;border:none;color:var(--sub,#aaa);font-size:13px;padding:8px;cursor:pointer;';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = function () { _closeInterestSheet(); if (window.Asterix && window.Asterix.status) window.Asterix.status.resumeViewer(); };
    sheet.appendChild(cancelBtn);

    overlay.appendChild(sheet);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { _closeInterestSheet(); if (window.Asterix && window.Asterix.status) window.Asterix.status.resumeViewer(); }
    });
    var svModal = document.getElementById('status-viewer-modal');
    if (svModal) svModal.appendChild(overlay);
  }

  function _closeInterestSheet() {
    var el = document.getElementById('fz-interest-overlay'); if (el) el.remove();
    var grid = document.querySelector('.sv-market-grid');
    if (grid && typeof grid._clearSelection === 'function') grid._clearSelection();
  }
  function _statusToListing(status) {
    return {
      status_id: status.status_id || status.id,
      caption: status.caption || '',
      price: status.price,
      is_negotiable: status.is_negotiable,
      availability: status.availability,
      media_url: status.media_url || '',
      username: status.username || '',
      is_commercial: status.is_commercial,
      collection_point: status.collection_point || '',
    };
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
      API.sendMessage(fd)
        .then(function (res) {
          if (res.ok && res.data.status === 'success') _openChatWith(targetUser, status.profile_picture);
          else toast('Error', (res.data && res.data.message) || 'Could not send enquiry.');
        })
        .catch(function () { toast('Error', 'Could not send enquiry.'); });
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

  window.Asterix.negotiate = {
    openBargainSheet:     openBargainSheet,
    openInterestSheet:    openInterestSheet,
    openOfferFromBanner:  openOfferFromBanner,
    openCounterFromCard:  openCounterFromCard,
    buildTransactionCard: buildTransactionCard,
  };

  window.openInterestSheet = openInterestSheet;
  window.closeInterestSheet = _closeInterestSheet;

  console.log('[Fizzme] negotiate.js — XHR fix for completeDeal payload');
})();