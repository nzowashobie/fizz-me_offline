// ============================================================
// status.js — Status upload, viewer, and My Status panel
// (with commerce: Buy Now, Make Offer, Enquire → chat navigation)
// ============================================================

(function() {
  'use strict';

  // ── DOM refs ─────────────────────────────────────────────────────────
  var dom = {
    // Status hub
    statusHub: document.getElementById('status-hub'),

    // My Status panel
    myStatusOverlay: document.getElementById('my-status-overlay'),
    myStatusPanel: document.getElementById('my-status-panel'),
    closeMyStatusBtn: document.getElementById('close-my-status'),
    openMyStatusBtn: document.getElementById('open-my-status-btn'),

    // Upload form
    catSel: document.getElementById('status-cat-sel'),
    mktLinkWrap: document.getElementById('market-link-wrap'),
    mktLinkInput: document.getElementById('status-mkt-link'),
    captionInput: document.getElementById('status-caption-input'),
    emojiRow: document.getElementById('status-upload-emojis'),
    dropZone: document.getElementById('status-drop-zone'),
    fileInput: document.getElementById('status-file-input'),
    prevImg: document.getElementById('status-prev-img'),
    prevVid: document.getElementById('status-prev-vid'),
    uploadBtn: document.getElementById('upload-status-btn'),
    uploadMsg: document.getElementById('upload-msg'),
    myStatusesList: document.getElementById('my-statuses-list'),
    weddingHint: document.getElementById('wedding-event-hint'),

    // Status viewer
    viewerModal: document.getElementById('status-viewer-modal'),
    svSegments: document.getElementById('sv-segments'),
    svAvatar: document.getElementById('sv-avatar'),
    svUsername: document.getElementById('sv-username'),
    svTime: document.getElementById('sv-time'),
    svCatBadge: document.getElementById('sv-cat'),
    svImg: document.getElementById('sv-img'),
    svVid: document.getElementById('sv-vid'),
    svCaption: document.getElementById('sv-caption'),
    svAdBar: document.getElementById('sv-ad-bar'),
    svAdLabel: document.getElementById('sv-ad-label'),
    svAdBadge: document.getElementById('sv-ad-badge'),
    svTapLeft: document.getElementById('sv-tap-left'),
    svTapRight: document.getElementById('sv-tap-right'),
    svCloseBtn: document.getElementById('sv-close'),
    svShareBtn: document.getElementById('sv-share-btn'),
    svReplyInput: document.getElementById('sv-reply-input'),
    svReplySend: document.getElementById('sv-reply-send'),
    svEmojiRow: document.getElementById('sv-emoji-row'),
    svCatEnd: document.getElementById('sv-cat-end'),
    svCatEndIcon: document.getElementById('sv-cat-end-icon'),
    svCatEndTitle: document.getElementById('sv-cat-end-title'),
    svCatEndSub: document.getElementById('sv-cat-end-sub'),
    svCatNextBtn: document.getElementById('sv-cat-next-btn'),
    svCatCloseBtn: document.getElementById('sv-cat-close-btn'),
    svCategoryTransition: document.getElementById('sv-category-transition'),
    svCtIcon: document.getElementById('sv-ct-icon'),
    svCtName: document.getElementById('sv-ct-name'),
    svShareOverlay: document.getElementById('sv-share-overlay'),
    svShareClose: document.getElementById('sv-share-close'),
    shareWa: document.getElementById('share-wa'),
    shareFb: document.getElementById('share-fb'),
    shareTk: document.getElementById('share-tk'),

    // Views panel
    viewsPanel: document.getElementById('status-views-panel'),
    viewsList: document.getElementById('vp-list-container'),
    closeViewsBtn: document.getElementById('close-views-panel'),

    // Edit status modal
    editStatusOverlay: document.getElementById('edit-status-overlay'),
    editStatusCaption: document.getElementById('edit-status-caption'),
    editStatusSaveBtn: document.getElementById('edit-status-save-btn'),
    editStatusMsg: document.getElementById('edit-status-msg'),
    editStatusClose: document.querySelector('#edit-status-overlay .modal-close'),

    // Commerce bar
    svCommerceBar: document.getElementById('sv-commerce-bar'),
    svPriceBadge: document.getElementById('sv-price-badge'),
    svAvailBadge: document.getElementById('sv-avail-badge'),
    svActionContainer: document.getElementById('sv-action-container'),
  };

  // ── Category constants ────────────────────────────────────────────
  var SV_CATEGORIES = window.SV_CATEGORIES || [
    'General', 'Funerals', 'Weddings', 'Market', 'Church'
  ];
  var SV_CAT_ICONS = window.SV_CAT_ICONS || {
    General:  '🌐',
    Funerals: '🕊️',
    Weddings: '💍',
    Market:   '🛒',
    Church:   '⛪',
  };

  // ── LABEL CHANGE: display name map ───────────────────────────────
  // DB/API values (Funerals, Weddings, Church) are NEVER changed.
  // Only the text rendered to the user is remapped here.
  var CAT_DISPLAY_NAMES = {
    'Funerals': 'Tributes',
    'Weddings': 'Celebrations',
    'Church':   'Spiritual',
  };
  function catLabel(cat) {
    return CAT_DISPLAY_NAMES[cat] || cat;
  }

  var viewer = {
    playlist: [],
    idx: 0,
    timer: null,
    duration: 5000,
    currentCategory: null,
    segFill: null,
    isPaused: false,
    pausedAt: null,
    isVideo: false,
    videoElement: null,
  };

  // ── Offer modal state ──────────────────────────────────────────────
  var offerTargetStatusId = null;
  var buyTargetStatusId = null;
  var counterTargetOfferId = null;

  // ── Category transition timer (fixes race condition) ──────────────
  var ctTimer = null;

  // ── Helpers ──────────────────────────────────────────────────────────
  function buildSegments(count) {
    dom.svSegments.innerHTML = '';
    for (var i = 0; i < count; i++) {
      var seg = document.createElement('div');
      seg.className = 'sv-seg';
      seg.id = 'sv-seg-' + i;
      seg.innerHTML = '<div class="sv-seg-fill"></div>';
      dom.svSegments.appendChild(seg);
    }
  }

  function animateSegment(idx, duration, onDone) {
    clearTimeout(viewer.timer);
    var fill = document.getElementById('sv-seg-' + idx)?.querySelector('.sv-seg-fill');
    if (!fill) { onDone(); return; }
    for (var i = 0; i < idx; i++) {
      var s = document.getElementById('sv-seg-' + i);
      if (s) s.classList.add('done');
    }
    var seg = document.getElementById('sv-seg-' + idx);
    if (seg) seg.classList.add('active');

    fill.style.transition = 'none';
    fill.style.width = '0%';
    requestAnimationFrame(function() {
      fill.style.transition = 'width ' + duration + 'ms linear';
      fill.style.width = '100%';
    });

    viewer.timer = setTimeout(onDone, duration);
  }

  function resetViewer() {
    clearTimeout(viewer.timer);
    dom.svVid.pause();
    dom.svVid.src = '';
    dom.svImg.src = '';
    dom.svImg.style.display = 'none';
    dom.svVid.style.display = 'none';
    dom.svCaption.style.display = 'none';
    dom.svAdBar.classList.remove('show');
    dom.svCatEnd.classList.remove('show');
    if (dom.svCommerceBar) dom.svCommerceBar.style.display = 'none';
    viewer.isPaused = false;
    viewer.isVideo = false;
    viewer.videoElement = null;
  }

  // ── Pause / Resume viewer ──────────────────────────────────────────
  function pauseViewer() {
    if (viewer.isPaused) return;
    viewer.isPaused = true;
    clearTimeout(viewer.timer);
    if (viewer.isVideo && dom.svVid && !dom.svVid.paused) {
      dom.svVid.pause();
    }
    var indicator = document.getElementById('sv-pause-indicator');
    if (indicator) indicator.classList.add('show');
  }

  function resumeViewer() {
    if (!viewer.isPaused) return;
    viewer.isPaused = false;
    var indicator = document.getElementById('sv-pause-indicator');
    if (indicator) indicator.classList.remove('show');
    var seg = document.getElementById('sv-seg-' + viewer.idx);
    if (seg) {
      var fill = seg.querySelector('.sv-seg-fill');
      if (fill) {
        var currentWidth = parseFloat(fill.style.width) || 0;
        if (currentWidth < 100) {
          var remaining = ((100 - currentWidth) / 100) * viewer.duration;
          animateSegment(viewer.idx, remaining, function() {
            if (!viewer.isPaused) showStatus(viewer.idx + 1);
          });
        } else {
          if (!viewer.isPaused) showStatus(viewer.idx + 1);
        }
      }
    }
    if (viewer.isVideo && dom.svVid) {
      dom.svVid.play().catch(function() {});
    }
  }

  // ── Open chat with seller helper ───────────────────────────────────
  function openChatWithUser(username, profilePicture) {
    closeViewer();
    if (window.Asterix && window.Asterix.chat) {
      var contact = {
        username: username,
        profile_picture: profilePicture || ''
      };
      window.Asterix.chat.addConversationItem(contact);
      window.Asterix.chat.openConversation(username);
      setTimeout(function() {
        window.Asterix.chat.loadMessages(username, true);
      }, 300);
    } else {
      toast('Error', 'Chat module not available.');
    }
  }

  // ── Offer modal functions ──────────────────────────────────────────
  function openOfferModal(statusId) {
    var id = parseInt(statusId, 10);
    if (isNaN(id) || id <= 0) {
      toast('Error', 'Invalid status ID. Please try again.');
      return;
    }
    offerTargetStatusId = id;
    var amountEl = document.getElementById('offer-amount');
    var statusEl = document.getElementById('offer-status');
    var btn = document.getElementById('offer-submit-btn');
    amountEl.value = '';
    statusEl.textContent = '';
    statusEl.className = 'modal-status';
    btn.disabled = false;
    btn.textContent = 'Send Offer';
    document.getElementById('offer-modal').classList.add('open');
    setTimeout(function() { amountEl.focus(); }, 200);
  }

  function closeOfferModal() {
    document.getElementById('offer-modal').classList.remove('open');
    offerTargetStatusId = null;
  }

  function submitOffer() {
    var amount = document.getElementById('offer-amount').value.trim();
    var statusEl = document.getElementById('offer-status');
    var btn = document.getElementById('offer-submit-btn');
    if (!amount) {
      statusEl.textContent = 'Please enter an amount.';
      statusEl.className = 'modal-status err';
      return;
    }
    var num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      statusEl.textContent = 'Please enter a positive number.';
      statusEl.className = 'modal-status err';
      return;
    }
    if (!offerTargetStatusId || isNaN(offerTargetStatusId) || offerTargetStatusId <= 0) {
      statusEl.textContent = 'Error: missing status ID. Please try again.';
      statusEl.className = 'modal-status err';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Sending…';
    statusEl.textContent = '';
    statusEl.className = 'modal-status';

    if (window.Asterix && window.Asterix.deals) {
      window.Asterix.deals.createOffer(offerTargetStatusId, num)
        .then(function(res) {
          toast('Offer sent', 'Your offer has been sent to the seller.');
          closeOfferModal();
          var item = viewer.playlist[viewer.idx];
          if (item && item.username) {
            openChatWithUser(item.username, item.profile_picture);
          }
        })
        .catch(function(err) {
          if (err.data && err.data.error && err.data.error.includes('already have a pending offer')) {
            toast('Offer pending', 'You already have a pending offer on this item. You can withdraw it first.');
            closeOfferModal();
          } else {
            statusEl.textContent = err.message || 'Could not send offer.';
            statusEl.className = 'modal-status err';
            btn.disabled = false;
            btn.textContent = 'Send Offer';
          }
        });
    } else {
      statusEl.textContent = 'Deals module not loaded.';
      statusEl.className = 'modal-status err';
      btn.disabled = false;
      btn.textContent = 'Send Offer';
    }
  }

  // ── Counter Offer modal functions ──────────────────────────────────
  function openCounterOfferModal(offerId, currentAmount) {
    var id = parseInt(offerId, 10);
    if (isNaN(id) || id <= 0) {
      toast('Error', 'Invalid offer ID.');
      return;
    }
    counterTargetOfferId = id;
    var amountEl = document.getElementById('counter-amount');
    var statusEl = document.getElementById('counter-status');
    var btn = document.getElementById('counter-submit-btn');
    amountEl.value = currentAmount || '';
    statusEl.textContent = '';
    statusEl.className = 'modal-status';
    btn.disabled = false;
    btn.textContent = 'Send Counter';
    document.getElementById('counter-offer-modal').classList.add('open');
    setTimeout(function() { amountEl.focus(); }, 200);
  }

  function closeCounterOfferModal() {
    document.getElementById('counter-offer-modal').classList.remove('open');
    counterTargetOfferId = null;
  }

  function submitCounterOffer() {
    var amount = document.getElementById('counter-amount').value.trim();
    var statusEl = document.getElementById('counter-status');
    var btn = document.getElementById('counter-submit-btn');
    if (!amount) {
      statusEl.textContent = 'Please enter an amount.';
      statusEl.className = 'modal-status err';
      return;
    }
    var num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      statusEl.textContent = 'Please enter a positive number.';
      statusEl.className = 'modal-status err';
      return;
    }
    if (!counterTargetOfferId || isNaN(counterTargetOfferId) || counterTargetOfferId <= 0) {
      statusEl.textContent = 'Error: missing offer ID.';
      statusEl.className = 'modal-status err';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Sending…';
    statusEl.textContent = '';
    statusEl.className = 'modal-status';

    if (window.Asterix && window.Asterix.deals) {
      window.Asterix.deals.respondToOffer(counterTargetOfferId, 'counter', num)
        .then(function(res) {
          toast('Counter sent', 'Your counter‑offer has been sent.');
          closeCounterOfferModal();
          if (typeof refreshThread === 'function') refreshThread();
        })
        .catch(function(err) {
          statusEl.textContent = err.message || 'Could not send counter.';
          statusEl.className = 'modal-status err';
          btn.disabled = false;
          btn.textContent = 'Send Counter';
        });
    } else {
      statusEl.textContent = 'Deals module not loaded.';
      statusEl.className = 'modal-status err';
      btn.disabled = false;
      btn.textContent = 'Send Counter';
    }
  }

  // ── Buy Now modal ──────────────────────────────────────────────────
  var _buyContext = null;

  function openBuyModal(statusId, price, title, mediaUrl, sellerUsername) {
    var id = parseInt(statusId, 10);
    if (isNaN(id) || id <= 0) { toast('Error', 'Invalid listing.'); return; }
    buyTargetStatusId = id;
    _buyContext = { statusId: id, price: price, title: title, mediaUrl: mediaUrl, sellerUsername: sellerUsername };

    var thumb = document.getElementById('buy-product-thumb');
    var thumbIcon = document.getElementById('buy-thumb-icon');
    if (mediaUrl) {
      thumb.src = mediaUrl;
      thumb.style.display = 'block';
      thumbIcon.style.display = 'none';
      thumb.onerror = function() { thumb.style.display = 'none'; thumbIcon.style.display = ''; };
    } else {
      thumb.style.display = 'none';
      thumbIcon.style.display = '';
    }
    document.getElementById('buy-item-title').textContent = title || 'Item';
    document.getElementById('buy-item-price').textContent = price ? 'K' + parseFloat(price).toLocaleString('en-ZM', {minimumFractionDigits: 2}) : '';
    document.getElementById('buy-item-note').textContent = sellerUsername ? 'Seller: @' + sellerUsername : '';

    document.getElementById('buy-payment-method').value = '';
    document.getElementById('buy-mobile-field').style.display = 'none';
    document.getElementById('buy-mobile-number').value = '';
    document.getElementById('buy-delivery-address').value = '';
    document.getElementById('buy-delivery-instructions').value = '';
    document.getElementById('buy-status').textContent = '';
    document.getElementById('buy-status').className = 'modal-status';
    document.getElementById('buy-submit-btn').disabled = false;
    document.getElementById('buy-submit-btn').textContent = 'Confirm Purchase';
    document.getElementById('buy-modal').classList.add('open');
  }

  function toggleBuyMobileField() {
    var method = document.getElementById('buy-payment-method').value;
    var mobileField = document.getElementById('buy-mobile-field');
    var mobileLabel = document.getElementById('buy-mobile-label');
    var mobileHint  = document.getElementById('buy-mobile-hint');
    var hints = {
      airtel_money:   { label: 'Airtel Money Number', hint: 'Starts with 097 or 077' },
      mtn_money:      { label: 'MTN MoMo Number',     hint: 'Starts with 096 or 076' },
      zamtel_kwacha:  { label: 'Zamtel Kwacha Number', hint: 'Starts with 095 or 075' },
    };
    if (hints[method]) {
      mobileLabel.textContent = hints[method].label;
      mobileHint.textContent  = hints[method].hint;
      mobileField.style.display = '';
      document.getElementById('buy-mobile-number').focus();
    } else {
      mobileField.style.display = 'none';
      document.getElementById('buy-mobile-number').value = '';
    }
  }
  window.toggleBuyMobileField = toggleBuyMobileField;

  function closeBuyModal() {
    document.getElementById('buy-modal').classList.remove('open');
    buyTargetStatusId = null;
    _buyContext = null;
  }

  function submitBuyNow() {
    var statusId = buyTargetStatusId;
    if (!statusId || isNaN(statusId) || statusId <= 0) {
      toast('Error', 'Missing or invalid status ID.');
      return;
    }
    var paymentMethod   = document.getElementById('buy-payment-method').value.trim();
    var mobileNumber    = document.getElementById('buy-mobile-number').value.trim();
    var deliveryAddress = document.getElementById('buy-delivery-address').value.trim();
    var instructions    = document.getElementById('buy-delivery-instructions').value.trim();

    if (!paymentMethod) {
      document.getElementById('buy-status').textContent = 'Please select a payment method.';
      document.getElementById('buy-status').className = 'modal-status err';
      return;
    }
    var mobileMethods = { airtel_money: true, mtn_money: true, zamtel_kwacha: true };
    if (mobileMethods[paymentMethod] && !mobileNumber) {
      document.getElementById('buy-mobile-number').style.borderColor = '#f15c6d';
      document.getElementById('buy-mobile-number').focus();
      document.getElementById('buy-status').textContent = 'Enter your mobile money number.';
      document.getElementById('buy-status').className = 'modal-status err';
      return;
    }

    var btn = document.getElementById('buy-submit-btn');
    var statusEl = document.getElementById('buy-status');
    btn.disabled = true;
    btn.textContent = 'Processing…';
    statusEl.textContent = '';
    statusEl.className = 'modal-status';

    var fullAddress = deliveryAddress;
    if (mobileNumber) {
      fullAddress = (fullAddress ? fullAddress + ' | ' : '') + 'Pay to: ' + mobileNumber;
    }

    window.Asterix.deals.takeListing(statusId, paymentMethod, fullAddress, instructions)
      .then(function() {
        toast('Purchase request sent!', 'The seller will confirm your order in chat.');
        closeBuyModal();
        var ctx = _buyContext;
        var sellerUser = (ctx && ctx.sellerUsername) || null;
        if (!sellerUser) {
          var item = viewer && viewer.playlist && viewer.playlist[viewer.idx];
          if (item) sellerUser = item.username;
        }
        if (sellerUser) openChatWithUser(sellerUser, null);
      })
      .catch(function(err) {
        statusEl.textContent = err.message || 'Could not complete purchase.';
        statusEl.className = 'modal-status err';
        btn.disabled = false;
        btn.textContent = 'Confirm Purchase';
      });
  }

  // ── Commerce: update the price/action bar ──────────────────────────
  function updateCommerceBar(status) {
    if (!dom.svCommerceBar || !status || !status.is_commercial) {
      dom.svCommerceBar.style.display = 'none';
      return;
    }

    dom.svCommerceBar.style.display = 'block';

    var price = status.price ? 'K' + parseFloat(status.price).toLocaleString() : 'Price not set';
    dom.svPriceBadge.textContent = price;

    var avail = status.availability || 'available';
    var availColors = { available: '#25d366', reserved: '#ffc107', sold: '#f15c6d' };
    dom.svAvailBadge.textContent = avail.toUpperCase();
    dom.svAvailBadge.style.color = availColors[avail] || '#fff';

    var me = State.ME;
    var isOwner = status.username === me;

    dom.svActionContainer.innerHTML = '';

    if (avail === 'sold' || avail === 'reserved') {
      var disabledBtn = document.createElement('button');
      disabledBtn.textContent = avail === 'sold' ? 'Sold' : 'Reserved';
      disabledBtn.style.cssText = 'background:#444;border:none;border-radius:20px;padding:6px 16px;font-size:13px;font-weight:700;color:#aaa;cursor:default;';
      disabledBtn.disabled = true;
      dom.svActionContainer.appendChild(disabledBtn);
      return;
    }

    if (isOwner) {
      var editBtn = document.createElement('button');
      editBtn.textContent = '✏️ Edit Listing';
      editBtn.style.cssText = 'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:6px 16px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;';
      editBtn.onclick = function() {
        if (window.Asterix && window.Asterix.market && typeof window.Asterix.market.editStatus === 'function') {
          window.Asterix.market.editStatus(status.status_id);
          if (typeof closeViewer === 'function') closeViewer();
        } else {
          toast('Not available', 'Market edit feature not loaded.');
        }
      };
      dom.svActionContainer.appendChild(editBtn);
      return;
    }

    if (!isOwner && avail === 'available') {
      var intBtn = document.createElement('button');
      intBtn.id = 'sv-interest-btn';
      intBtn.textContent = '💬 I\'m Interested';
      intBtn.style.cssText = [
        'background:linear-gradient(135deg,#25d366,#128c7e);',
        'border:none;border-radius:20px;padding:7px 18px;',
        'font-size:13px;font-weight:700;color:#fff;cursor:pointer;',
        'box-shadow:0 2px 8px rgba(0,0,0,0.3);',
        'transition:opacity .15s;'
      ].join('');
      intBtn.onclick = function() { openInterestSheet(status); };
      dom.svActionContainer.appendChild(intBtn);
    }
  }

  // ── Unified "I'm Interested" bottom sheet ─────────────────────────
  function openInterestSheet(status) {
    pauseViewer();

    var overlay = document.getElementById('sv-interest-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'sv-interest-overlay';
    overlay.style.cssText = [
      'position:absolute;inset:0;z-index:20;',
      'display:flex;flex-direction:column;justify-content:flex-end;',
      'background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);',
      'animation:fadeInSheet .18s ease;'
    ].join('');

    var sheet = document.createElement('div');
    sheet.style.cssText = [
      'background:var(--card,#1e1e1e);border-radius:20px 20px 0 0;',
      'padding:20px 18px 28px;',
      'animation:slideUpSheet .2s ease;'
    ].join('');

    if (!document.getElementById('sv-sheet-style')) {
      var sty = document.createElement('style');
      sty.id = 'sv-sheet-style';
      sty.textContent = [
        '@keyframes fadeInSheet{from{opacity:0}to{opacity:1}}',
        '@keyframes slideUpSheet{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}'
      ].join('');
      document.head.appendChild(sty);
    }

    var pill = document.createElement('div');
    pill.style.cssText = [
      'background:rgba(255,255,255,0.06);border-radius:12px;',
      'padding:10px 14px;margin-bottom:16px;',
      'display:flex;align-items:center;gap:10px;'
    ].join('');
    var priceText = status.price ? 'K' + parseFloat(status.price).toLocaleString('en-ZM', {minimumFractionDigits: 2}) : '';
    var negTag = status.is_negotiable ? ' · negotiable' : '';
    pill.innerHTML = [
      '<span style="font-size:20px;">🏷️</span>',
      '<div>',
      '  <div style="font-size:13px;font-weight:700;color:var(--text,#fff);">' +
        (status.caption ? status.caption.slice(0,60) : 'Listing') + '</div>',
      '  <div style="font-size:12px;color:#e6a817;font-weight:600;">' + priceText + negTag + '</div>',
      '</div>'
    ].join('');
    sheet.appendChild(pill);

    var title = document.createElement('div');
    title.style.cssText = 'font-size:11px;color:var(--sub,#aaa);text-transform:uppercase;letter-spacing:.6px;font-weight:700;margin-bottom:12px;';
    title.textContent = 'How do you want to proceed?';
    sheet.appendChild(title);

    var rows = document.createElement('div');
    rows.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

    function sheetRow(icon, label, sub, accent, onClick) {
      var row = document.createElement('button');
      row.style.cssText = [
        'display:flex;align-items:center;gap:14px;',
        'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);',
        'border-radius:14px;padding:13px 16px;cursor:pointer;text-align:left;',
        'transition:background .15s;width:100%;'
      ].join('');
      row.onmouseover = function() { row.style.background = 'rgba(255,255,255,0.1)'; };
      row.onmouseout  = function() { row.style.background = 'rgba(255,255,255,0.05)'; };
      row.innerHTML = [
        '<span style="font-size:22px;flex-shrink:0;">' + icon + '</span>',
        '<div style="flex:1;">',
        '  <div style="font-size:14px;font-weight:700;color:' + accent + ';">' + label + '</div>',
        '  <div style="font-size:11px;color:var(--sub,#aaa);margin-top:2px;">' + sub + '</div>',
        '</div>',
        '<i class="fas fa-chevron-right" style="color:rgba(255,255,255,0.25);font-size:11px;"></i>'
      ].join('');
      row.onclick = onClick;
      return row;
    }

    rows.appendChild(sheetRow(
      '💬', 'Ask the Seller',
      'Send a quick message — free to negotiate in chat',
      'var(--text,#fff)',
      function() {
        var item = viewer.playlist[viewer.idx];
        if (!item) return;
        closeInterestSheet();
        _sendEnquiryAndNavigate(item);
      }
    ));

    if (status.is_negotiable) {
      var offerRow = document.createElement('div');
      offerRow.style.cssText = [
        'background:rgba(230,168,23,0.08);border:1px solid rgba(230,168,23,0.2);',
        'border-radius:14px;padding:13px 16px;'
      ].join('');

      var offerLabel = document.createElement('div');
      offerLabel.style.cssText = 'font-size:14px;font-weight:700;color:#e6a817;margin-bottom:8px;';
      offerLabel.innerHTML = '🤝 Make an Offer <span style="font-size:11px;font-weight:400;color:var(--sub,#aaa);">— propose your price</span>';
      offerRow.appendChild(offerLabel);

      var offerInputWrap = document.createElement('div');
      offerInputWrap.style.cssText = 'display:flex;gap:8px;align-items:center;';

      var offerPrefix = document.createElement('span');
      offerPrefix.style.cssText = 'font-size:15px;font-weight:800;color:#e6a817;flex-shrink:0;';
      offerPrefix.textContent = 'K';

      var offerInput = document.createElement('input');
      offerInput.type = 'number';
      offerInput.min = '1';
      offerInput.step = '0.01';
      offerInput.placeholder = 'Your price';
      offerInput.style.cssText = [
        'flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(230,168,23,0.3);',
        'border-radius:10px;padding:9px 12px;color:var(--text,#fff);font-size:15px;',
        'font-weight:700;outline:none;'
      ].join('');
      if (status.price) offerInput.placeholder = parseFloat(status.price).toFixed(2);

      var offerSendBtn = document.createElement('button');
      offerSendBtn.style.cssText = [
        'background:#e6a817;border:none;border-radius:10px;',
        'padding:9px 16px;font-size:13px;font-weight:700;color:#000;cursor:pointer;',
        'white-space:nowrap;flex-shrink:0;'
      ].join('');
      offerSendBtn.textContent = 'Send';

      offerSendBtn.onclick = function() {
        var amt = parseFloat(offerInput.value);
        if (isNaN(amt) || amt <= 0) {
          offerInput.style.borderColor = '#f15c6d';
          offerInput.focus();
          return;
        }
        offerSendBtn.disabled = true;
        offerSendBtn.textContent = '…';
        var item = viewer.playlist[viewer.idx];
        window.Asterix.deals.createOffer(status.status_id, amt)
          .then(function() {
            toast('Offer sent!', 'K' + amt.toFixed(2) + ' — the seller will respond in chat.');
            closeInterestSheet();
            if (item && item.username) openChatWithUser(item.username, item.profile_picture);
          })
          .catch(function(err) {
            offerSendBtn.disabled = false;
            offerSendBtn.textContent = 'Send';
            if (err.data && err.data.error && err.data.error.includes('already have a pending')) {
              toast('Offer pending', 'Withdraw your existing offer in chat first.');
              closeInterestSheet();
              if (item && item.username) openChatWithUser(item.username, item.profile_picture);
            } else {
              offerInput.style.borderColor = '#f15c6d';
              toast('Error', err.message || 'Could not send offer.');
            }
          });
      };

      offerInputWrap.appendChild(offerPrefix);
      offerInputWrap.appendChild(offerInput);
      offerInputWrap.appendChild(offerSendBtn);
      offerRow.appendChild(offerInputWrap);
      rows.appendChild(offerRow);
    }

    rows.appendChild(sheetRow(
      '🛒', 'Buy Now',
      status.price ? 'Purchase at K' + parseFloat(status.price).toLocaleString('en-ZM', {minimumFractionDigits: 2}) : 'Purchase at listed price',
      '#25d366',
      function() {
        var item = viewer.playlist[viewer.idx];
        closeInterestSheet();
        openBuyModal(
          status.status_id,
          status.price,
          status.caption || 'Item',
          item && item.media_url,
          item && item.username
        );
      }
    ));

    sheet.appendChild(rows);

    var cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = [
      'width:100%;margin-top:16px;background:transparent;border:none;',
      'color:var(--sub,#aaa);font-size:13px;padding:8px;cursor:pointer;'
    ].join('');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = function() {
      closeInterestSheet();
      resumeViewer();
    };
    sheet.appendChild(cancelBtn);

    overlay.appendChild(sheet);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) { closeInterestSheet(); resumeViewer(); }
    });

    var svModal = document.getElementById('status-viewer-modal');
    if (svModal) svModal.appendChild(overlay);
  }

  function closeInterestSheet() {
    var overlay = document.getElementById('sv-interest-overlay');
    if (overlay) overlay.remove();
  }

  // ── Enquire helper: instant (no blob download) ────────────────────
  function _sendEnquiryAndNavigate(item) {
    if (!item) return;
    var targetUser = item.username;
    if (targetUser === State.ME) { toast('Info', 'That\'s your own listing.'); return; }

    var intBtn = document.getElementById('sv-interest-btn');
    if (intBtn) {
      intBtn.disabled = true;
      intBtn.textContent = '⏳ Opening chat…';
    }

    var fd = new FormData();
    fd.append('recipient', targetUser);
    fd.append('message', "Hi, I'm interested in your listing. Can you tell me more?");
    fd.append('is_status_reply', 'true');
    if (item.status_id) fd.append('status_id', item.status_id);

    API.sendMessage(fd)
      .then(function(res) {
        if (res.ok && res.data.status === 'success') {
          openChatWithUser(targetUser, item.profile_picture);
        } else {
          toast('Error', res.data.message || 'Could not send enquiry.');
          if (intBtn) { intBtn.disabled = false; intBtn.textContent = '💬 I\'m Interested'; }
          resumeViewer();
        }
      })
      .catch(function() {
        toast('Error', 'Could not send enquiry. Please try again.');
        if (intBtn) { intBtn.disabled = false; intBtn.textContent = '💬 I\'m Interested'; }
        resumeViewer();
      });
  }

  // ── Fetch media file as blob for status reply ──────────────────────
  function fetchStatusMediaAsBlob(url) {
    var proxyUrl = '/api/status/proxy-media/?url=' + encodeURIComponent(url);
    return fetch(proxyUrl)
      .then(function(response) {
        if (!response.ok) throw new Error('Failed to fetch media');
        return response.blob();
      });
  }

  // ── Status reply with actual media file ────────────────────────────
  function sendStatusReply(text) {
    if (!viewer.playlist.length) return;
    var statusObj = viewer.playlist[viewer.idx];
    if (!statusObj || statusObj.type === 'advertisement') return;
    var targetUser = statusObj.username;
    if (targetUser === State.ME) {
      toast('Info', 'You cannot reply to your own status.');
      return;
    }

    var sender = statusObj.username || 'Someone';
    var mediaUrl = statusObj.media_url;
    var mediaType = mediaTypeFromUrl(mediaUrl);
    var mediaIcon = mediaType.icon || '';
    var typeLabel = mediaType.label || '📝 Text';

    var quoteLine = '> 📌 ' + mediaIcon + ' ' + typeLabel + ' status from ' + sender;
    if (statusObj.caption) {
      quoteLine += ': ' + statusObj.caption.slice(0, 60);
    }
    var replyMessage = quoteLine + '\n\n' + text;

    var fd = new FormData();
    fd.append('recipient', targetUser);
    fd.append('message', replyMessage);
    fd.append('is_status_reply', 'true');
    if (statusObj.status_id) {
      fd.append('status_id', statusObj.status_id);
    }

    if (mediaUrl) {
      fetchStatusMediaAsBlob(mediaUrl)
        .then(function(blob) {
          var filename = mediaUrl.split('/').pop().split('?')[0] || 'media';
          fd.append('files', blob, filename);
          return API.sendMessage(fd);
        })
        .then(function(res) {
          if (res.ok && res.data.status === 'success') {
            toast('Replied to ' + sender + '\'s ' + typeLabel, '✓ Sent');
            dom.svReplyInput.value = '';
            if (State.activeRecipient === targetUser && window.Asterix && window.Asterix.chat) {
              window.Asterix.chat.loadMessages(State.activeRecipient);
            }
          } else {
            toast('Error', res.data.message || 'Failed to send reply');
          }
        })
        .catch(function(err) {
          toast('Error', 'Could not attach media: ' + err.message);
          API.sendMessage(fd)
            .then(function(res) {
              if (res.ok && res.data.status === 'success') {
                toast('Replied (without media)', '✓ Sent');
                dom.svReplyInput.value = '';
              } else {
                toast('Error', 'Failed to send reply');
              }
            });
        });
    } else {
      API.sendMessage(fd)
        .then(function(res) {
          if (res.ok && res.data.status === 'success') {
            toast('Replied to ' + sender + '\'s ' + typeLabel, '✓ Sent');
            dom.svReplyInput.value = '';
            if (State.activeRecipient === targetUser && window.Asterix && window.Asterix.chat) {
              window.Asterix.chat.loadMessages(State.activeRecipient);
            }
          } else {
            toast('Error', res.data.message || 'Failed to send reply');
          }
        })
        .catch(function() { toast('Error', 'Failed to send reply'); });
    }
  }

  // ── Viewer: show a single status ────────────────────────────────────
  function showStatus(idx) {
    viewer.idx = idx;
    var item = viewer.playlist[idx];
    if (!item) {
      showCategoryEnd();
      return;
    }

    resetViewer();

    if (item.type === 'advertisement') {
      dom.svAvatar.src = '/static/images/icon-192.png';
      dom.svUsername.textContent = item.advertiser || 'Sponsored';
      dom.svTime.textContent = 'Sponsored';
      dom.svCatBadge.textContent = '📢 AD';
      dom.svAdLabel.textContent = 'Visit Now';
      dom.svAdBar.classList.add('show');
      dom.svAdBar.onclick = function() {
        var link = externalLink(item.action_url);
        if (link) window.open(link, '_blank');
      };
      if (dom.svCommerceBar) dom.svCommerceBar.style.display = 'none';
    } else {
      dom.svAvatar.src = item.profile_picture || '/static/images/default_profile_picture.webp';
      dom.svUsername.textContent = item.username || '';
      var mediaInfo = mediaTypeFromUrl(item.media_url);
      dom.svTime.textContent = item.timestamp ? fmtTime(item.timestamp) : '';
      // LABEL CHANGE: use catLabel() so badge shows "Tributes" not "Funerals" etc.
      dom.svCatBadge.textContent = catLabel(item.category || '') + ' ' + mediaInfo.label;
      dom.svAdBar.classList.remove('show');

      updateCommerceBar(item);

      if (item.market_link) {
        dom.svAdLabel.textContent = '🛒 Visit Shop';
        dom.svAdBar.classList.add('show');
        dom.svAdBar.onclick = function() {
          var link = externalLink(item.market_link);
          if (link) window.open(link, '_blank');
        };
      }
    }

    var cap = item.caption || '';
    dom.svCaption.textContent = cap;
    dom.svCaption.style.display = cap ? 'block' : 'none';

    var url = item.media_url || '';
    var isVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
    viewer.isVideo = isVideo;
    var dur = viewer.duration;

    var loadMedia = function() {
      if (isVideo && url) {
        dom.svVid.src = url;
        dom.svVid.style.display = 'block';
        dom.svVid.load();
        dom.svVid.play().catch(function() {});
        viewer.videoElement = dom.svVid;
        dom.svVid.onloadedmetadata = function() {
          dur = Math.max(dom.svVid.duration * 1000, 3000);
        };
        dom.svVid.onerror = function() {
          console.warn('Video failed to load, skipping:', url);
          dom.svVid.style.display = 'none';
          dom.svImg.src = url;
          dom.svImg.style.display = 'block';
        };
      } else if (url) {
        dom.svImg.style.display = 'block';
        dom.svImg.style.opacity = '0';
        dom.svImg.style.transition = 'opacity .35s ease';
        dom.svImg.onerror = function() {
          console.warn('Image failed to load:', url);
          dom.svImg.style.display = 'none';
        };
        dom.svImg.onload = function() { dom.svImg.style.opacity = '1'; };
        dom.svImg.src = url;
      } else {
        dom.svImg.style.display = 'none';
        dom.svVid.style.display = 'none';
      }
    };

    try {
      loadMedia();
    } catch (e) {
      console.warn('Error loading media:', e);
      dom.svImg.style.display = 'none';
      dom.svVid.style.display = 'none';
    }

    renderStatusEmojis(item.category || viewer.currentCategory || 'General');

    var segDuration = isVideo ? Math.max((dom.svVid.duration || 5) * 1000, dur) : dur;
    animateSegment(idx, segDuration, function() {
      if (!viewer.isPaused) {
        showStatus(idx + 1);
      }
    });
  }

  // ── Viewer: open category ───────────────────────────────────────────
  function openViewer(category, skipList) {
    viewer.currentCategory = category;
    dom.viewerModal.classList.add('open');
    viewer.playlist = [];
    viewer.idx = 0;
    dom.svSegments.innerHTML = '';
    dom.svUsername.textContent = 'Loading…';

    var ct = dom.svCategoryTransition;
    var icon = dom.svCtIcon;
    var name = dom.svCtName;
    icon.textContent = SV_CAT_ICONS[category] || '🌐';
    // LABEL CHANGE: show display name on transition screen, not raw DB value
    name.textContent = catLabel(category);
    ct.classList.add('show');

    // Clear any pending transition timer (fixes race condition)
    if (ctTimer) {
      clearTimeout(ctTimer);
      ctTimer = null;
    }
    ctTimer = setTimeout(function() {
      ct.classList.remove('show');
      ctTimer = null;
    }, 1300);

    API.getStatusFeed(category)
      .then(function(res) {
        if (!res.ok) throw new Error(res.data.error || 'Feed error');
        viewer.playlist = res.data.playlist || [];
        if (!viewer.playlist.length) {
          var allCats = SV_CATEGORIES;
          var skip = skipList ? skipList.concat([category]) : [category];
          var nextCat = allCats.find(function(c) { return skip.indexOf(c) === -1; });
          if (nextCat) {
            icon.textContent = SV_CAT_ICONS[category] || '🌐';
            // LABEL CHANGE: show display name in "no new statuses" message
            name.textContent = catLabel(category) + ' — no new statuses';
            ct.classList.add('show');
            if (ctTimer) clearTimeout(ctTimer);
            ctTimer = setTimeout(function() {
              ct.classList.remove('show');
              ctTimer = null;
              openViewer(nextCat, skip);
            }, 900);
          } else {
            closeViewer();
            toast('All caught up', 'No active statuses in any category right now.');
          }
          return;
        }
        buildSegments(viewer.playlist.length);
        showStatus(0);
      })
      .catch(function(e) {
        toast('Error', 'Could not load statuses.');
        closeViewer();
      });
  }

  function closeViewer() {
    dom.viewerModal.classList.remove('open');
    resetViewer();
    closeInterestSheet();
    // Clear any pending transition timer
    if (ctTimer) {
      clearTimeout(ctTimer);
      ctTimer = null;
    }
    // On mobile restore sidebar
    if (window.innerWidth <= 768) {
      var sidebar = document.getElementById('sidebar');
      var backBtn = document.getElementById('back-btn');
      if (sidebar) sidebar.classList.remove('hidden');
      if (backBtn) backBtn.style.display = 'none';
    }
  }

  // ── Expose closeViewer globally as svClose ─────────────────────────
  window.svClose = closeViewer;

  // ── Category end screen ─────────────────────────────────────────────
  var endScreenActive = false;

  function showCategoryEnd() {
    if (endScreenActive) return; // Already showing – ignore repeated calls
    endScreenActive = true;
    clearTimeout(viewer.timer);
    var catEnd = dom.svCatEnd;
    var icon = dom.svCatEndIcon;
    var title = dom.svCatEndTitle;
    var sub = dom.svCatEndSub;
    var nextBtn = dom.svCatNextBtn;

    icon.textContent = SV_CAT_ICONS[viewer.currentCategory] || '✅';
    title.textContent = 'All caught up!';
    // LABEL CHANGE: show display name in end-screen message
    sub.textContent = 'You\'ve seen all ' + catLabel(viewer.currentCategory) + ' statuses.';

    var curIdx = SV_CATEGORIES.indexOf(viewer.currentCategory);
    var nextCat = (curIdx >= 0 && curIdx < SV_CATEGORIES.length - 1) ? SV_CATEGORIES[curIdx + 1] : null;
    if (nextCat) {
      nextBtn.style.display = 'inline-flex';
      // LABEL CHANGE: show display name on next-category button
      nextBtn.innerHTML = (SV_CAT_ICONS[nextCat] || '') + ' ' + catLabel(nextCat) + ' <i class="fas fa-arrow-right" style="margin-left:6px;"></i>';
      nextBtn.onclick = function() {
        catEnd.classList.remove('show');
        endScreenActive = false;
        openViewer(nextCat);
      };
    } else {
      nextBtn.style.display = 'none';
      // Last category – close button becomes "Close"
      var closeBtn = dom.svCatCloseBtn;
      if (closeBtn) {
        closeBtn.textContent = 'Close';
        closeBtn.onclick = function() {
          closeViewer();
          endScreenActive = false;
        };
      }
    }
    catEnd.classList.add('show');
  }

  // ── Emoji reactions in viewer ──────────────────────────────────────
  function renderStatusEmojis(category) {
    var row = dom.svEmojiRow;
    var emojis = ['❤️', '😂', '😮', '😢', '🙏', '🔥', '👍', '👏', '💯', '🎉'];
    row.innerHTML = emojis.map(function(e) {
      return '<button class="sv-emoji-btn" aria-label="React ' + e + '" data-emoji="' + e + '">' + e + '</button>';
    }).join('');

    var lastSelected = null;
    row.querySelectorAll('.sv-emoji-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var emoji = this.dataset.emoji;
        if (lastSelected && lastSelected !== this) {
          lastSelected.classList.remove('selected');
          lastSelected.style.transform = '';
        }
        if (this.classList.contains('selected')) {
          this.classList.remove('selected');
          this.style.transform = '';
          lastSelected = null;
          return;
        }
        this.classList.add('selected');
        this.style.transform = 'scale(1.4)';
        setTimeout(function() { this.style.transform = 'scale(1.15)'; }.bind(this), 200);
        lastSelected = this;

        var rect = this.getBoundingClientRect();
        var el = document.createElement('div');
        el.className = 'emoji-burst';
        el.textContent = emoji;
        el.style.left = (rect.left + rect.width / 2) + 'px';
        el.style.top = rect.top + 'px';
        document.body.appendChild(el);
        setTimeout(function() { el.remove(); }, 850);

        if (navigator.vibrate) navigator.vibrate(30);
        setTimeout(function() { sendStatusReply(emoji); }, 120);
      });
    });
  }

  // ── Pause on reply focus ───────────────────────────────────────────
  function setupReplyPause() {
    dom.svReplyInput.addEventListener('focus', function() {
      pauseViewer();
    });
    dom.svReplyInput.addEventListener('blur', function() {
      setTimeout(function() {
        if (!viewer.isPaused) return;
        if (document.activeElement !== dom.svReplyInput) {
          resumeViewer();
        }
      }, 300);
    });
    dom.svReplySend.addEventListener('click', function() {
      if (viewer.isPaused) {
        setTimeout(resumeViewer, 500);
      }
    });
    dom.svReplyInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        dom.svReplySend.click();
      }
    });
  }

  // ── Share status ────────────────────────────────────────────────────
  function shareCurrentStatus() {
    var item = viewer.playlist[viewer.idx];
    if (!item || item.type === 'advertisement') return;
    if (navigator.share) {
      navigator.share({
        // LABEL CHANGE: brand name → fizzme
        title: 'fizzme Status',
        text: item.caption || 'Check out this status on fizzme! 🇿🇲',
        url: item.media_url || window.location.href
      }).catch(function() {});
    } else {
      dom.svShareOverlay.classList.add('show');
    }
  }

  function openShareSheet() {
    dom.svShareOverlay.classList.add('show');
  }

  function closeShareSheet() {
    dom.svShareOverlay.classList.remove('show');
  }

  // ── My Status panel ─────────────────────────────────────────────────
  function openMyStatus() {
    dom.myStatusOverlay.style.display = 'block';
    dom.myStatusPanel.style.display = 'block';
    loadMyStatuses();
  }

  function closeMyStatus() {
    dom.myStatusOverlay.style.display = 'none';
    dom.myStatusPanel.style.display = 'none';
  }

  function loadMyStatuses() {
    API.getMyStatuses()
      .then(function(res) {
        if (!res.ok) throw new Error(res.data.error || 'Failed to load');
        var data = res.data;
        var list = dom.myStatusesList;
        list.innerHTML = '<h4>Your active statuses</h4>';
        if (Object.keys(data.my_statuses || {}).length === 0) {
          list.innerHTML += '<p style="font-size:13px;color:var(--sub);">No active statuses.</p>';
          return;
        }
        for (var cat in data.my_statuses) {
          var arr = data.my_statuses[cat];
          arr.forEach(function(s) {
            var wrap = document.createElement('div');
            wrap.className = 'my-status-item';
            wrap.setAttribute('data-status-id', s.status_id);
            var viewsNum = Math.floor(Math.random() * 50) + 1;
            var isVid = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(s.media_url || '');
            wrap.innerHTML = (isVid ?
              '<video class="my-s-thumb" src="' + s.media_url + '" muted playsinline></video>' :
              '<img class="my-s-thumb" src="' + (s.media_url || '') + '" alt="">'
            ) +
              '<div class="my-s-info" onclick="window.Asterix.status.openViews(' + s.status_id + ')"><div class="cap">' + (s.caption || 'No caption') + '</div><div class="views"><i class="fas fa-eye"></i> ' + viewsNum + ' views &bull; ' + s.expires_in_minutes + 'm left</div></div>' +
              '<button class="edit-s-btn" onclick="window.Asterix.status.editMyStatus(' + s.status_id + ', \'' + (s.caption || '').replace(/'/g, '&#39;') + '\')" title="Edit caption"><i class="fas fa-edit"></i></button>' +
              '<button class="del-s-btn" onclick="window.Asterix.status.deleteMyStatus(' + s.status_id + ')"><i class="fas fa-trash"></i></button>';
            list.appendChild(wrap);
          });
        }
      })
      .catch(function(e) {
        console.error('loadMyStatuses', e);
        dom.myStatusesList.innerHTML = '<p style="font-size:13px;color:var(--sub);">Could not load statuses.</p>';
      });
  }

  function deleteMyStatus(id) {
    showConfirm({
      icon: '🗑️',
      title: 'Delete Status',
      body: 'Remove this status? It will disappear for everyone immediately.',
      okLabel: 'Delete',
      okClass: 'danger'
    }).then(function(ok) {
      if (!ok) return;
      API.deleteStatus(id)
        .then(function() {
          loadMyStatuses();
        })
        .catch(function() { toast('Error', 'Could not delete status.'); });
    });
  }

  function editMyStatus(id, currentCaption) {
    State.editStatusId = id;
    dom.editStatusCaption.value = currentCaption || '';
    dom.editStatusMsg.textContent = '';
    dom.editStatusOverlay.classList.add('open');
    dom.editStatusCaption.focus();
  }

  function closeEditStatus() {
    dom.editStatusOverlay.classList.remove('open');
    State.editStatusId = null;
  }

  function saveStatusEdit() {
    var id = State.editStatusId;
    if (!id) return;
    var caption = dom.editStatusCaption.value.trim();
    var msgEl = dom.editStatusMsg;
    var btn = dom.editStatusSaveBtn;
    btn.disabled = true;
    btn.textContent = 'Saving…';
    API.editStatus(id, caption)
      .then(function(res) {
        if (res.ok) {
          msgEl.textContent = '✅ Updated!';
          msgEl.className = 'modal-status ok';
          setTimeout(function() {
            closeEditStatus();
            loadMyStatuses();
          }, 700);
        } else {
          msgEl.textContent = res.data.error || 'Could not update.';
          msgEl.className = 'modal-status err';
        }
      })
      .catch(function() {
        msgEl.textContent = 'Network error.';
        msgEl.className = 'modal-status err';
      })
      .finally(function() {
        btn.disabled = false;
        btn.textContent = 'Save';
      });
  }

  // ── Status upload ────────────────────────────────────────────────────
  function updateCategoryUI(cat) {
    dom.mktLinkWrap.style.display = (cat === 'Market') ? 'block' : 'none';
    if (dom.weddingHint) {
      // value="Weddings" unchanged — this check matches the select option value, not a label
      dom.weddingHint.style.display = (cat === 'Weddings') ? 'flex' : 'none';
    }
    updateUploadEmojis(cat);
  }

  function updateUploadEmojis(cat) {
    var row = dom.emojiRow;
    var emojis = getEmojisForCategory(cat);
    row.innerHTML = emojis.map(function(e) {
      return '<span class="status-emoji-chip" title="Add ' + e + '">' + e + '</span>';
    }).join('');
    row.querySelectorAll('.status-emoji-chip').forEach(function(chip) {
      chip.onclick = function() {
        dom.captionInput.value += this.textContent;
        this.classList.add('active');
        setTimeout(function() { this.classList.remove('active'); }.bind(this), 400);
      };
    });
  }

  function handleFileSelection() {
    var f = dom.fileInput.files[0];
    if (!f) return;
    dom.uploadBtn.disabled = false;
    if (f.type.startsWith('image/')) {
      dom.prevImg.src = URL.createObjectURL(f);
      dom.prevImg.style.display = 'block';
      dom.prevVid.style.display = 'none';
    } else if (f.type.startsWith('video/')) {
      dom.prevVid.src = URL.createObjectURL(f);
      dom.prevVid.style.display = 'block';
      dom.prevImg.style.display = 'none';
    }
  }

  function uploadStatus() {
    var f = dom.fileInput.files[0];
    if (!f) return;
    dom.uploadBtn.disabled = true;
    dom.uploadMsg.textContent = 'Uploading…';
    var fd = new FormData();
    fd.append('media', f);
    fd.append('caption', dom.captionInput.value.trim());
    fd.append('category', dom.catSel.value);
    fd.append('market_link', dom.mktLinkInput.value.trim() || '');

    API.uploadStatus(fd)
      .then(function(res) {
        if (res.ok) {
          dom.uploadMsg.textContent = '✅ Status published!';
          dom.fileInput.value = '';
          dom.prevImg.style.display = 'none';
          dom.prevVid.style.display = 'none';
          dom.captionInput.value = '';
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CACHE_STATUS', url: res.data.media_url });
          }
          setTimeout(function() { dom.uploadMsg.textContent = ''; }, 3000);
          loadMyStatuses();
        } else {
          dom.uploadMsg.textContent = '❌ ' + (res.data.error || 'Upload failed');
        }
      })
      .catch(function() {
        dom.uploadMsg.textContent = '❌ Upload failed';
      })
      .finally(function() {
        dom.uploadBtn.disabled = false;
      });
  }

  // ── Views panel ─────────────────────────────────────────────────────
  function openViews(statusId) {
    var list = dom.viewsList;
    list.innerHTML = '';
    var count = Math.floor(Math.random() * 25) + 3;
    for (var i = 0; i < count; i++) {
      var div = document.createElement('div');
      div.className = 'vp-viewer';
      div.innerHTML = '<img src="/static/images/default_profile_picture.webp"><span>Viewer ' + (i + 1) + '</span><i class="fas fa-eye" style="color:var(--sub);"></i>';
      list.appendChild(div);
    }
    dom.viewsPanel.style.display = 'block';
  }

  function closeViews() {
    dom.viewsPanel.style.display = 'none';
  }

  // ── Expose public methods ──────────────────────────────────────────
  var publicAPI = {
    open: openViewer,
    close: closeViewer,
    show: showStatus,
    showCategoryEnd: showCategoryEnd,
    shareCurrent: shareCurrentStatus,
    openShareSheet: openShareSheet,
    closeShareSheet: closeShareSheet,
    sendStatusReply: sendStatusReply,
    renderStatusEmojis: renderStatusEmojis,
    pauseViewer: pauseViewer,
    resumeViewer: resumeViewer,
    openMyStatus: openMyStatus,
    closeMyStatus: closeMyStatus,
    loadMyStatuses: loadMyStatuses,
    deleteMyStatus: deleteMyStatus,
    editMyStatus: editMyStatus,
    closeEdit: closeEditStatus,
    saveEdit: saveStatusEdit,
    uploadStatus: uploadStatus,
    updateCategoryUI: updateCategoryUI,
    updateUploadEmojis: updateUploadEmojis,
    openViews: openViews,
    closeViews: closeViews,
  };

  if (!window.Asterix) window.Asterix = {};
  window.Asterix.status = publicAPI;

  // Expose modal functions globally
  window.openOfferModal = openOfferModal;
  window.closeOfferModal = closeOfferModal;
  window.submitOffer = submitOffer;
  window.openInterestSheet = openInterestSheet;
  window.closeInterestSheet = closeInterestSheet;
  window.openCounterOfferModal = openCounterOfferModal;
  window.closeCounterOfferModal = closeCounterOfferModal;
  window.submitCounterOffer = submitCounterOffer;
  window.openBuyModal = openBuyModal;
  window.closeBuyModal = closeBuyModal;
  window.submitBuyNow = submitBuyNow;

  // ── Wire DOM events ─────────────────────────────────────────────────
  dom.openMyStatusBtn.addEventListener('click', openMyStatus);
  dom.closeMyStatusBtn.addEventListener('click', closeMyStatus);
  dom.myStatusOverlay.addEventListener('click', closeMyStatus);

  dom.catSel.addEventListener('change', function() {
    updateCategoryUI(this.value);
  });

  if (dom.weddingHint) {
    dom.weddingHint.addEventListener('click', function(e) {
      e.stopPropagation();
      closeMyStatus();
      if (typeof openWeddingPanel === 'function') {
        setTimeout(openWeddingPanel, 300);
      } else {
        var overlay = document.getElementById('wedding-panel-overlay');
        var panel = document.getElementById('wedding-panel');
        if (overlay) overlay.classList.add('open');
        if (panel) panel.classList.add('open');
      }
    });
  }

  dom.dropZone.addEventListener('click', function() { dom.fileInput.click(); });
  dom.dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dom.dropZone.style.borderColor = 'var(--accent)';
  });
  dom.dropZone.addEventListener('dragleave', function() {
    dom.dropZone.style.borderColor = '';
  });
  dom.dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dom.dropZone.style.borderColor = '';
    if (e.dataTransfer.files[0]) {
      dom.fileInput.files = e.dataTransfer.files;
      dom.fileInput.dispatchEvent(new Event('change'));
    }
  });
  dom.fileInput.addEventListener('change', handleFileSelection);

  dom.uploadBtn.addEventListener('click', uploadStatus);

  dom.svTapLeft.addEventListener('click', function() {
    dom.svCatEnd.classList.remove('show');
    endScreenActive = false;
    if (viewer.idx > 0) showStatus(viewer.idx - 1);
  });
  dom.svTapRight.addEventListener('click', function() {
    // Prevent right‑tap if end screen is already showing
    if (endScreenActive) return;
    dom.svCatEnd.classList.remove('show');
    showStatus(viewer.idx + 1);
  });
  dom.svCloseBtn.addEventListener('click', closeViewer);
  dom.svShareBtn.addEventListener('click', shareCurrentStatus);
  dom.svShareClose.addEventListener('click', closeShareSheet);
  dom.svShareOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeShareSheet();
  });

  setupReplyPause();

  dom.svReplySend.addEventListener('click', function() {
    var val = dom.svReplyInput.value.trim();
    if (val) {
      sendStatusReply(val);
      setTimeout(function() {
        if (viewer.isPaused) resumeViewer();
      }, 500);
    }
  });
  dom.svReplyInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      dom.svReplySend.click();
    }
  });

  dom.shareWa.addEventListener('click', function() {
    closeShareSheet();
    var item = viewer.playlist[viewer.idx];
    if (!item) return;
    // LABEL CHANGE: brand name → fizzme
    var text = item.caption || 'Check out this status on fizzme! 🇿🇲';
    if (item.market_link) text += '\n' + item.market_link;
    else if (item.media_url) text += '\n' + item.media_url;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  });
  dom.shareFb.addEventListener('click', function() {
    closeShareSheet();
    var item = viewer.playlist[viewer.idx];
    if (item && item.media_url) {
      window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(item.media_url), '_blank');
    } else {
      toast('Share', 'No media to share on Facebook.');
    }
  });
  dom.shareTk.addEventListener('click', function() {
    closeShareSheet();
    toast('TikTok', 'Save the media first, then upload it to TikTok manually.');
  });

  dom.closeViewsBtn.addEventListener('click', closeViews);
  dom.viewsPanel.addEventListener('click', function(e) {
    if (e.target === this) closeViews();
  });

  dom.editStatusClose.addEventListener('click', closeEditStatus);
  dom.editStatusOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeEditStatus();
  });
  dom.editStatusSaveBtn.addEventListener('click', saveStatusEdit);

  // ── Category click handlers ────────────────────────────────────────
  document.addEventListener('click', function(e) {
    var cat = e.target.closest('.status-cat[data-category]');
    if (!cat) return;
    e.preventDefault();
    var category = cat.getAttribute('data-category');
    if (category) openViewer(category);
  });

  function _bindCategoryButtons() {
    document.querySelectorAll('.status-cat[data-category]').forEach(function(el) {
      if (el._statusCatBound) return;
      el._statusCatBound = true;
      el.addEventListener('click', function() {
        openViewer(this.getAttribute('data-category'));
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _bindCategoryButtons);
  } else {
    _bindCategoryButtons();
  }

  updateCategoryUI(dom.catSel.value);

  console.log('[fizzme] Status module loaded');
})();