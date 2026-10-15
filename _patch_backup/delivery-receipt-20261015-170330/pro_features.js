// ============================================================
// pro_features.js — Delivery Tracking · Ratings · Listing Bump
// Load this AFTER chat.js, status.js, deals.js, payment.js.
// ============================================================

(function () {
  'use strict';

  // ── CSRF helper ───────────────────────────────────────────────
  function csrf() {
    var c = document.cookie.split('; ').find(function (r) { return r.startsWith('csrftoken='); });
    return c ? c.split('=')[1] : (window.ASTERIX && window.ASTERIX.CSRF) || '';
  }

  function postJSON(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf() },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok || d.error) { var e = new Error(d.error || 'Request failed'); e.data = d; throw e; }
        return d;
      });
    });
  }

  function getJSON(url) {
    return fetch(url).then(function (r) { return r.json(); });
  }

  // ── Stars helper ──────────────────────────────────────────────
  function renderStars(score, max) {
    max = max || 5;
    var s = '';
    for (var i = 1; i <= max; i++) {
      s += '<span style="color:' + (i <= score ? '#e6a817' : 'rgba(255,255,255,.2)') + ';font-size:18px;">★</span>';
    }
    return s;
  }

  // ═══════════════════════════════════════════════════════════════
  // FEATURE 1 — DELIVERY TRACKING PANEL
  // ═══════════════════════════════════════════════════════════════

  var STAGES = ['order_placed', 'seller_confirmed', 'in_transit', 'delivered', 'payment_released'];
  var STAGE_META = {
    order_placed:      { icon: '📦', label: 'Order Placed',        actor: null },
    seller_confirmed:  { icon: '✅', label: 'Seller Confirmed',     actor: 'seller' },
    in_transit:        { icon: '🚚', label: 'In Transit',           actor: 'seller' },
    delivered:         { icon: '📬', label: 'Delivered',            actor: 'buyer' },
    payment_released:  { icon: '💰', label: 'Payment Released',     actor: 'buyer' },
    disputed:          { icon: '⚠️', label: 'Dispute Raised',       actor: 'both' },
  };

  function openDeliveryPanel(dealId) {
    var panel = document.getElementById('delivery-panel');
    if (!panel) { panel = _buildDeliveryPanel(); }
    panel.dataset.dealId = dealId;
    document.getElementById('delivery-panel-overlay').classList.add('open');
    panel.classList.add('open');
    _loadDelivery(dealId);
  }

  function _buildDeliveryPanel() {
    var html = [
      '<div id="delivery-panel-overlay" class="modal-overlay"></div>',
      '<div id="delivery-panel" class="modal-card" style="',
      '  position:fixed;bottom:0;left:50%;transform:translateX(-50%);',
      '  width:min(420px,100vw);max-height:90dvh;overflow-y:auto;',
      '  border-radius:20px 20px 0 0;border-top:2px solid var(--accent2);',
      '  z-index:20600;padding:0;',
      '">',
      '  <div style="',
      '    background:linear-gradient(135deg,#128c7e,#25d366);',
      '    padding:16px 20px;display:flex;align-items:center;gap:12px;',
      '    position:sticky;top:0;z-index:2;">',
      '    <i class="fas fa-shipping-fast" style="font-size:18px;color:#fff;"></i>',
      '    <h3 style="flex:1;font-size:16px;font-weight:700;color:#fff;margin:0;">',
      '      Delivery Tracker</h3>',
      '    <button id="delivery-close" style="',
      '      background:rgba(255,255,255,.15);border:none;color:#fff;',
      '      width:30px;height:30px;border-radius:50%;font-size:16px;cursor:pointer;',
      '      display:flex;align-items:center;justify-content:center;">',
      '      <i class="fas fa-times"></i></button>',
      '  </div>',
      '  <div id="delivery-body" style="padding:20px;"></div>',
      '</div>',
    ].join('');
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);

    document.getElementById('delivery-close').onclick = _closeDeliveryPanel;
    document.getElementById('delivery-panel-overlay').onclick = _closeDeliveryPanel;
    return document.getElementById('delivery-panel');
  }

  function _closeDeliveryPanel() {
    var ov = document.getElementById('delivery-panel-overlay');
    var p  = document.getElementById('delivery-panel');
    if (ov) ov.classList.remove('open');
    if (p)  p.classList.remove('open');
  }

  function _loadDelivery(dealId) {
    var body = document.getElementById('delivery-body');
    body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--sub);">' +
      '<i class="fas fa-spinner fa-spin"></i> Loading…</div>';

    getJSON('/api/delivery/status/?deal_id=' + dealId)
      .then(function (d) {
        if (d.error) { body.innerHTML = '<p style="color:#f15c6d;">' + d.error + '</p>'; return; }
        _renderDelivery(body, d);
      })
      .catch(function () {
        body.innerHTML = '<p style="color:#f15c6d;">Could not load tracking info.</p>';
      });
  }

  function _renderDelivery(body, d) {
    var myRole   = d.my_role;       // 'buyer' or 'seller'
    var current  = d.stage;
    var nextS    = d.next_stage;
    var nextActor= d.next_actor;
    var ci = STAGES.indexOf(current);

    var html = '<div style="margin-bottom:20px;">';

    // Stage timeline
    STAGES.forEach(function (s, i) {
      var meta    = STAGE_META[s];
      var done    = i <= ci;
      var active  = s === current;
      var color   = done ? '#25d366' : 'rgba(255,255,255,.15)';
      var textCol = done ? 'var(--text)' : 'var(--sub)';
      html += '<div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;">';
      html += '  <div style="display:flex;flex-direction:column;align-items:center;">';
      html += '    <div style="width:36px;height:36px;border-radius:50%;background:' + color + ';';
      html += '      display:flex;align-items:center;justify-content:center;font-size:16px;';
      html += '      border:2px solid ' + (active ? 'var(--accent2)' : color) + ';';
      html += '      box-shadow:' + (active ? '0 0 0 4px rgba(37,211,102,.2)' : 'none') + ';">';
      html += '      ' + meta.icon + '</div>';
      if (i < STAGES.length - 1) {
        html += '    <div style="width:2px;height:20px;background:' +
          (i < ci ? '#25d366' : 'rgba(255,255,255,.1)') + ';margin-top:4px;"></div>';
      }
      html += '  </div>';
      html += '  <div style="flex:1;padding-top:6px;">';
      html += '    <div style="font-size:14px;font-weight:' + (active ? '700' : '500') + ';color:' + textCol + ';">' + meta.label + '</div>';

      // Timestamp for this stage
      var tsKey = s === 'seller_confirmed' ? 'seller_confirmed_at'
                : s === 'in_transit'       ? 'in_transit_at'
                : s === 'delivered'        ? 'delivered_at'
                : s === 'payment_released' ? 'payment_released_at' : null;
      if (tsKey && d[tsKey]) {
        html += '    <div style="font-size:11px;color:var(--sub);margin-top:2px;">' +
          new Date(d[tsKey]).toLocaleString() + '</div>';
      }
      html += '  </div>';
      html += '</div>';
    });

    // Dispute row
    if (current !== 'payment_released') {
      var disputed = d.stage === 'disputed';
      html += '<div style="display:flex;align-items:center;gap:14px;margin-bottom:4px;">';
      html += '  <div style="width:36px;height:36px;border-radius:50%;background:' +
        (disputed ? '#f15c6d' : 'rgba(255,255,255,.08)') + ';' +
        'display:flex;align-items:center;justify-content:center;font-size:16px;">⚠️</div>';
      html += '  <div style="font-size:13px;color:' + (disputed ? '#f15c6d' : 'var(--sub)') + ';">Raise a Dispute</div>';
      html += '</div>';
    }

    html += '</div>';

    // Notes
    if (d.notes) {
      html += '<div style="background:rgba(255,255,255,.05);border-radius:10px;padding:10px 14px;';
      html += 'font-size:13px;color:var(--text);margin-bottom:16px;">' +
        '<i class="fas fa-sticky-note" style="color:var(--accent2);margin-right:6px;"></i>' +
        d.notes + '</div>';
    }

    // Action button
    var canAct = nextS && (
      nextActor === 'both' ||
      (nextActor === 'seller' && myRole === 'seller') ||
      (nextActor === 'buyer'  && myRole === 'buyer')
    );

    if (canAct) {
      var nextMeta = STAGE_META[nextS] || {};
      html += '<button id="delivery-advance-btn" style="';
      html += 'width:100%;padding:13px;background:linear-gradient(135deg,#25d366,#128c7e);';
      html += 'color:#fff;border:none;border-radius:25px;font-size:14px;font-weight:700;cursor:pointer;">';
      html += nextMeta.icon + ' Mark: ' + nextMeta.label + '</button>';
    }

    if (current !== 'payment_released' && current !== 'disputed') {
      html += '<button id="delivery-dispute-btn" style="';
      html += 'width:100%;padding:10px;margin-top:10px;background:rgba(241,92,109,.1);';
      html += 'color:#f15c6d;border:1px solid rgba(241,92,109,.3);border-radius:25px;';
      html += 'font-size:13px;font-weight:600;cursor:pointer;">⚠️ Raise Dispute</button>';
    }

    // Rating prompt if payment released
    if (current === 'payment_released') {
      html += '<div style="margin-top:16px;text-align:center;">';
      html += '<div style="font-size:13px;color:var(--sub);margin-bottom:8px;">Rate this transaction</div>';
      html += '<div id="delivery-rating-stars" style="display:flex;justify-content:center;gap:6px;">';
      for (var i = 1; i <= 5; i++) {
        html += '<button data-star="' + i + '" style="font-size:28px;background:none;border:none;';
        html += 'cursor:pointer;color:rgba(255,255,255,.2);transition:color .15s;">★</button>';
      }
      html += '</div>';
      html += '<input id="delivery-rating-note" placeholder="Leave a note (optional)…" maxlength="200" style="';
      html += 'width:100%;margin-top:10px;background:var(--mid);border:1px solid var(--border);';
      html += 'border-radius:10px;padding:10px 14px;color:var(--text);font-size:13px;outline:none;">';
      html += '<button id="delivery-rating-submit" style="';
      html += 'width:100%;margin-top:10px;padding:11px;background:#e6a817;color:#000;border:none;';
      html += 'border-radius:25px;font-size:14px;font-weight:700;cursor:pointer;">Submit Rating</button>';
      html += '</div>';
    }

    body.innerHTML = html;

    // Wire advance
    var advBtn = document.getElementById('delivery-advance-btn');
    if (advBtn) {
      advBtn.onclick = function () {
        advBtn.disabled = true;
        advBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating…';
        postJSON('/api/delivery/advance/', { deal_id: parseInt(d.deal_id), stage: nextS })
          .then(function () { _loadDelivery(d.deal_id); toast('✅', STAGE_META[nextS].label); })
          .catch(function (e) {
            toast('Error', e.message || 'Could not update stage');
            advBtn.disabled = false;
            advBtn.innerHTML = (STAGE_META[nextS] || {}).icon + ' Mark: ' + (STAGE_META[nextS] || {}).label;
          });
      };
    }

    // Wire dispute
    var disBtn = document.getElementById('delivery-dispute-btn');
    if (disBtn) {
      disBtn.onclick = function () {
        var note = prompt('Briefly describe the issue:');
        if (!note) return;
        postJSON('/api/delivery/advance/', { deal_id: parseInt(d.deal_id), stage: 'disputed', notes: note })
          .then(function () { _loadDelivery(d.deal_id); toast('⚠️', 'Dispute raised'); })
          .catch(function (e) { toast('Error', e.message); });
      };
    }

    // Wire stars
    var selectedStar = 0;
    var stars = body.querySelectorAll('[data-star]');
    stars.forEach(function (btn) {
      btn.onmouseenter = function () {
        var v = parseInt(this.dataset.star);
        stars.forEach(function (s) {
          s.style.color = parseInt(s.dataset.star) <= v ? '#e6a817' : 'rgba(255,255,255,.2)';
        });
      };
      btn.onmouseleave = function () {
        stars.forEach(function (s) {
          s.style.color = parseInt(s.dataset.star) <= selectedStar ? '#e6a817' : 'rgba(255,255,255,.2)';
        });
      };
      btn.onclick = function () {
        selectedStar = parseInt(this.dataset.star);
        stars.forEach(function (s) {
          s.style.color = parseInt(s.dataset.star) <= selectedStar ? '#e6a817' : 'rgba(255,255,255,.2)';
        });
      };
    });

    var ratingSubmit = document.getElementById('delivery-rating-submit');
    if (ratingSubmit) {
      ratingSubmit.onclick = function () {
        if (!selectedStar) { toast('', 'Please select a star rating'); return; }
        var note = (document.getElementById('delivery-rating-note').value || '').trim();
        ratingSubmit.disabled = true;
        ratingSubmit.textContent = 'Submitting…';
        postJSON('/api/ratings/submit/', { deal_id: parseInt(d.deal_id), score: selectedStar, note: note })
          .then(function () { toast('⭐', 'Rating submitted! Thank you.'); _closeDeliveryPanel(); })
          .catch(function (e) {
            toast('Error', e.message || 'Could not submit rating');
            ratingSubmit.disabled = false;
            ratingSubmit.textContent = 'Submit Rating';
          });
      };
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // FEATURE 2 — SELLER REPUTATION BADGE (in chat header)
  // ═══════════════════════════════════════════════════════════════
  // Call renderSellerReputation(username, containerEl) to inject
  // the star badge next to any seller username in the UI.

  function renderSellerReputation(username, containerEl) {
    if (!containerEl) return;
    getJSON('/api/ratings/seller/?username=' + encodeURIComponent(username))
      .then(function (d) {
        if (!d.avg_score) return;
        var badge = document.createElement('span');
        badge.className = 'seller-rep-badge';
        badge.style.cssText = [
          'display:inline-flex;align-items:center;gap:3px;',
          'background:rgba(230,168,23,.12);border:1px solid rgba(230,168,23,.25);',
          'border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700;',
          'color:#e6a817;cursor:pointer;margin-left:6px;',
        ].join('');
        badge.innerHTML = '★ ' + d.avg_score + ' <span style="color:var(--sub);font-weight:400;">(' + d.total_ratings + ')</span>';
        badge.title = 'View seller reviews';
        badge.onclick = function (e) {
          e.stopPropagation();
          openRatingModal(username, d);
        };
        containerEl.appendChild(badge);
      })
      .catch(function () {}); // silent fail — ratings are optional
  }

  function openRatingModal(username, d) {
    var existing = document.getElementById('rating-modal');
    if (existing) existing.remove();

    var html = [
      '<div id="rating-modal" class="modal-overlay open" style="z-index:20700;">',
      '  <div class="modal-card" style="width:360px;max-width:96vw;">',
      '    <div class="modal-header">',
      '      <i class="fas fa-star"></i>',
      '      <h3>' + username + ' · Reviews</h3>',
      '      <button class="modal-close" id="rating-modal-close"><i class="fas fa-times"></i></button>',
      '    </div>',
      '    <div class="modal-body">',

      '      <div style="text-align:center;margin-bottom:16px;">',
      '        <div style="font-size:42px;font-weight:800;color:#e6a817;">' + (d.avg_score || '—') + '</div>',
      '        <div>' + renderStars(Math.round(d.avg_score || 0)) + '</div>',
      '        <div style="font-size:12px;color:var(--sub);margin-top:4px;">' + (d.total_ratings || 0) + ' ratings</div>',
      '      </div>',

      // Star distribution bars
      '      <div style="margin-bottom:16px;">',
      [5,4,3,2,1].map(function (n) {
        var count = (d.star_counts || {})[n] || 0;
        var pct   = d.total_ratings ? Math.round(count / d.total_ratings * 100) : 0;
        return [
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">',
          '  <span style="font-size:12px;color:var(--sub);width:12px;text-align:right;">' + n + '</span>',
          '  <span style="color:#e6a817;font-size:13px;">★</span>',
          '  <div style="flex:1;height:8px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;">',
          '    <div style="width:' + pct + '%;height:100%;background:#e6a817;border-radius:4px;"></div>',
          '  </div>',
          '  <span style="font-size:11px;color:var(--sub);width:28px;">' + count + '</span>',
          '</div>',
        ].join('');
      }).join(''),
      '      </div>',

      // Reviews
      '      <div style="border-top:1px solid var(--border);padding-top:14px;">',
      (d.reviews || []).map(function (r) {
        return [
          '<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.05);">',
          '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">',
          '    <span style="font-size:13px;font-weight:600;color:var(--text);">' + r.buyer + '</span>',
          '    <span>' + renderStars(r.score) + '</span>',
          '  </div>',
          r.note ? '<div style="font-size:12px;color:var(--sub);">' + r.note + '</div>' : '',
          '</div>',
        ].join('');
      }).join('') || '<div style="font-size:13px;color:var(--sub);">No reviews yet.</div>',
      '      </div>',

      '    </div>',
      '  </div>',
      '</div>',
    ].join('');

    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
    document.getElementById('rating-modal-close').onclick = function () {
      document.getElementById('rating-modal').remove();
    };
    document.getElementById('rating-modal').addEventListener('click', function (e) {
      if (e.target === this) this.remove();
    });
  }


  // ═══════════════════════════════════════════════════════════════
  // FEATURE 3 — LISTING EXTENSION & BUMP (My Status panel)
  // ═══════════════════════════════════════════════════════════════

  function extendListing(statusId, btn) {
    btn.disabled = true;
    btn.textContent = '…';
    postJSON('/api/listings/extend/', { status_id: statusId })
      .then(function (d) {
        toast('🕐', 'Extended! Now expires ' + new Date(d.expires_at).toLocaleTimeString());
        btn.textContent = '✅';
        setTimeout(function () {
          btn.disabled = false;
          btn.textContent = '+24h';
          var info = btn.closest('.my-status-item');
          if (info) {
            var left = info.querySelector('.views');
            if (left && d.extends_left !== undefined) {
              var exts = left.querySelector('.ext-count');
              if (exts) exts.textContent = ' · ' + d.extends_left + ' ext left';
            }
          }
        }, 2000);
      })
      .catch(function (e) {
        toast('Error', e.message || 'Could not extend listing');
        btn.disabled = false;
        btn.textContent = '+24h';
      });
  }

  function bumpListing(statusId, btn) {
    btn.disabled = true;
    btn.textContent = '…';
    postJSON('/api/listings/bump/', { status_id: statusId })
      .then(function (d) {
        toast('🚀', 'Listing bumped to the top of Market!');
        btn.textContent = '✅';
        setTimeout(function () { btn.disabled = false; btn.textContent = '🚀 Bump'; }, 3000);
      })
      .catch(function (e) {
        var msg = (e.data && e.data.next_bump_at)
          ? 'Next bump available ' + new Date(e.data.next_bump_at).toLocaleTimeString()
          : (e.message || 'Could not bump');
        toast('', msg);
        btn.disabled = false;
        btn.textContent = '🚀 Bump';
      });
  }

  function patchMyStatusItems() {
    document.querySelectorAll('.my-status-item').forEach(function(item) {
      if (item.dataset.proPatched) return;
      item.dataset.proPatched = '1';

      // ── FIX: read status_id from data attribute ──────────────
      var statusId = parseInt(item.dataset.statusId);
      if (!statusId) return;
      // ────────────────────────────────────────────────────────────

      // Only add to market listings (if product_category or is_commercial is flagged)
      // We detect by checking if the del-s-btn sibling already exists (market panel items
      // won't have a bump-wrap yet)
      var btnWrap = document.createElement('div');
      btnWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex-shrink:0;';

      var extBtn = document.createElement('button');
      extBtn.textContent = '+24h';
      extBtn.title = 'Extend listing by 24 hours (free, up to 3×)';
      extBtn.style.cssText = [
        'background:rgba(230,168,23,.15);border:1px solid rgba(230,168,23,.3);',
        'color:#e6a817;font-size:10px;font-weight:700;border-radius:8px;',
        'padding:4px 8px;cursor:pointer;white-space:nowrap;',
      ].join('');
      extBtn.onclick = function (e) { e.stopPropagation(); extendListing(statusId, extBtn); };

      var bumpBtn = document.createElement('button');
      bumpBtn.textContent = '🚀 Bump';
      bumpBtn.title = 'Move to top of Market feed (1× free per day)';
      bumpBtn.style.cssText = [
        'background:rgba(37,211,102,.12);border:1px solid rgba(37,211,102,.25);',
        'color:var(--accent2);font-size:10px;font-weight:700;border-radius:8px;',
        'padding:4px 8px;cursor:pointer;white-space:nowrap;',
      ].join('');
      bumpBtn.onclick = function (e) { e.stopPropagation(); bumpListing(statusId, bumpBtn); };

      btnWrap.appendChild(extBtn);
      btnWrap.appendChild(bumpBtn);

      // Insert before the del button
      var delBtn = item.querySelector('.del-s-btn');
      if (delBtn) item.insertBefore(btnWrap, delBtn);
      else item.appendChild(btnWrap);
    });
  }

  // Auto-patch whenever My Status panel opens
  var _origOpenMyStatus = null;
  function _hookMyStatus() {
    if (window.Asterix && window.Asterix.status && window.Asterix.status.openMyStatus) {
      _origOpenMyStatus = window.Asterix.status.openMyStatus;
      window.Asterix.status.openMyStatus = function () {
        _origOpenMyStatus.apply(this, arguments);
        setTimeout(patchMyStatusItems, 600);
      };
    }
  }


  // ── Wire delivery panel into deal cards ───────────────────────
  // Override buildBubble's "Complete Sale" button to also show
  // "Track Delivery" once a deal is completed.
  // We hook into the existing deal_data returned by the server.
  var _origBuildBubble = null;
  function _hookBuildBubble() {
    if (!window.buildBubble) return;
    _origBuildBubble = window.buildBubble;
    window.buildBubble = function (msg) {
      var row = _origBuildBubble.call(this, msg);
      if (!msg.deal || msg.deal.state !== 'completed') return row;

      // Add "Track Delivery" button to the deal card
      var dcard = row.querySelector('.msg-deal-card');
      if (!dcard) return row;
      var trackBtn = document.createElement('button');
      trackBtn.className = 'deal-card-btn deal-btn-accept';
      trackBtn.style.marginTop = '6px';
      trackBtn.innerHTML = '🚚 Track Delivery';
      trackBtn.onclick = function (e) {
        e.stopPropagation();
        openDeliveryPanel(msg.deal.id);
      };
      var actions = dcard.querySelector('.deal-card-actions');
      if (actions) actions.appendChild(trackBtn);
      else dcard.appendChild(trackBtn);

      return row;
    };
  }

  // ── Wire seller rep badge into chat header ────────────────────
  // Called from loadMessages / renderMessages in chat.js whenever
  // the header is rebuilt.  We observe the chat-header-name element.
  function _hookChatHeader() {
    var headerInfo = document.getElementById('chat-header-info');
    if (!headerInfo) return;
    var observer = new MutationObserver(function () {
      var nameEl = headerInfo.querySelector('.chat-header-name');
      if (!nameEl || headerInfo.querySelector('.seller-rep-badge')) return;
      // Only show if this is a market conversation
      var bannerWrap = headerInfo.querySelector('.chat-product-banner-wrap');
      if (!bannerWrap) return;
      var recipientUsername = (State && State.activeRecipient) || '';
      if (recipientUsername) renderSellerReputation(recipientUsername, nameEl);
    });
    observer.observe(headerInfo, { childList: true, subtree: true });
  }

  // ── Expose public API ─────────────────────────────────────────
  window.Asterix = window.Asterix || {};
  window.Asterix.pro = {
    openDeliveryPanel:       openDeliveryPanel,
    renderSellerReputation:  renderSellerReputation,
    openRatingModal:         openRatingModal,
    extendListing:           extendListing,
    bumpListing:             bumpListing,
    patchMyStatusItems:      patchMyStatusItems,
  };

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    _hookBuildBubble();
    _hookChatHeader();
    _hookMyStatus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Asterix] Pro features loaded: Delivery · Ratings · Bump');
})();