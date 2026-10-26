// ============================================================
// status.js — Status upload, viewer, and My Status panel
// ============================================================

(function () {
  'use strict';

  var dom = {
    statusHub:             document.getElementById('status-hub'),
    myStatusOverlay:       document.getElementById('my-status-overlay'),
    myStatusPanel:         document.getElementById('my-status-panel'),
    closeMyStatusBtn:      document.getElementById('close-my-status'),
    openMyStatusBtn:       document.getElementById('open-my-status-btn'),
    catSel:                document.getElementById('status-cat-sel'),
    mktLinkWrap:           document.getElementById('market-link-wrap'),
    mktLinkInput:          document.getElementById('status-mkt-link'),
    captionInput:          document.getElementById('status-caption-input'),
    emojiRow:              document.getElementById('status-upload-emojis'),
    dropZone:              document.getElementById('status-drop-zone'),
    fileInput:             document.getElementById('status-file-input'),
    prevImg:               document.getElementById('status-prev-img'),
    prevVid:               document.getElementById('status-prev-vid'),
    uploadBtn:             document.getElementById('upload-status-btn'),
    uploadMsg:             document.getElementById('upload-msg'),
    myStatusesList:        document.getElementById('my-statuses-list'),
    weddingHint:           document.getElementById('wedding-event-hint'),
    viewerModal:           document.getElementById('status-viewer-modal'),
    svSegments:            document.getElementById('sv-segments'),
    svAvatar:              document.getElementById('sv-avatar'),
    svUsername:            document.getElementById('sv-username'),
    svTime:                document.getElementById('sv-time'),
    svCatBadge:            document.getElementById('sv-cat'),
    svImg:                 document.getElementById('sv-img'),
    svVid:                 document.getElementById('sv-vid'),
    svCaption:             document.getElementById('sv-caption'),
    svAdBar:               document.getElementById('sv-ad-bar'),
    svAdLabel:             document.getElementById('sv-ad-label'),
    svAdBadge:             document.getElementById('sv-ad-badge'),
    svTapLeft:             document.getElementById('sv-tap-left'),
    svTapRight:            document.getElementById('sv-tap-right'),
    svCloseBtn:            document.getElementById('sv-close'),
    svShareBtn:            document.getElementById('sv-share-btn'),
    svReplyInput:          document.getElementById('sv-reply-input'),
    svReplySend:           document.getElementById('sv-reply-send'),
    svEmojiRow:            document.getElementById('sv-emoji-row'),
    svCatEnd:              document.getElementById('sv-cat-end'),
    svCatEndIcon:          document.getElementById('sv-cat-end-icon'),
    svCatEndTitle:         document.getElementById('sv-cat-end-title'),
    svCatEndSub:           document.getElementById('sv-cat-end-sub'),
    svCatNextBtn:          document.getElementById('sv-cat-next-btn'),
    svCatCloseBtn:         document.getElementById('sv-cat-close-btn'),
    svCatReplayBtn:        document.getElementById('sv-cat-replay-btn'),
    svCategoryTransition:  document.getElementById('sv-category-transition'),
    svCtIcon:              document.getElementById('sv-ct-icon'),
    svCtName:              document.getElementById('sv-ct-name'),
    svShareOverlay:        document.getElementById('sv-share-overlay'),
    svShareClose:          document.getElementById('sv-share-close'),
    shareWa:               document.getElementById('share-wa'),
    shareFb:               document.getElementById('share-fb'),
    shareTk:               document.getElementById('share-tk'),
    viewsPanel:            document.getElementById('status-views-panel'),
    viewsList:             document.getElementById('vp-list-container'),
    closeViewsBtn:         document.getElementById('close-views-panel'),
    editStatusOverlay:     document.getElementById('edit-status-overlay'),
    editStatusCaption:     document.getElementById('edit-status-caption'),
    editStatusSaveBtn:     document.getElementById('edit-status-save-btn'),
    editStatusMsg:         document.getElementById('edit-status-msg'),
    editStatusClose:       document.querySelector('#edit-status-overlay .modal-close'),
    svCommerceBar:         document.getElementById('sv-commerce-bar'),
    svPriceBadge:          document.getElementById('sv-price-badge'),
    svAvailBadge:          document.getElementById('sv-avail-badge'),
    svActionContainer:     document.getElementById('sv-action-container'),
  };

  var SV_CATEGORIES = window.SV_CATEGORIES || ['General', 'Funerals', 'Weddings', 'Market', 'Church'];
  var SV_CAT_ICONS = window.SV_CAT_ICONS || { General: '🌐', Funerals: '🕊️', Weddings: '💍', Market: '🛒', Church: '⛪' };
  var CAT_DISPLAY_NAMES = { 'Funerals': 'Tributes', 'Weddings': 'Celebrations', 'Church': 'Spiritual' };

  function catLabel(cat) { return CAT_DISPLAY_NAMES[cat] || cat; }

  var viewer = {
    playlist: [], idx: 0, timer: null, duration: 5000, currentCategory: null, segFill: null, isPaused: false, pausedAt: null, isVideo: false, videoElement: null,
  };

  var offerTargetStatusId   = null;
  var buyTargetStatusId     = null;
  var counterTargetOfferId  = null;
  var ctTimer               = null;
  var _buyContext           = null;
  var endScreenActive       = false;
  var MAX_STATUS_MEDIA  = 10;
  var uploadSelectedFiles = [];
  var _pauseBtn = null;

  // ── OFFLINE VIEW QUEUE (SAFE) ───────────────────────────────────────
  function recordStatusViewWithOfflineSupport(statusId) {
    if (!statusId) return;
    try {
      if (navigator.onLine && window.API && typeof window.API.recordStatusView === 'function') {
        window.API.recordStatusView(statusId).catch(function() {
          queueOfflineView(statusId);
        });
      } else {
        queueOfflineView(statusId);
      }
    } catch(e) {
      console.warn('Could not record view (safely skipped):', e);
      queueOfflineView(statusId);
    }
  }

  function queueOfflineView(statusId) {
    try {
      var queue = JSON.parse(localStorage.getItem('asterix_pending_status_views') || '[]');
      if (queue.indexOf(statusId) === -1) {
        queue.push(statusId);
        localStorage.setItem('asterix_pending_status_views', JSON.stringify(queue));
      }
    } catch(e) {}
  }

  function flushOfflineViews() {
    if (!navigator.onLine) return;
    try {
      var queue = JSON.parse(localStorage.getItem('asterix_pending_status_views') || '[]');
      if (!queue.length) return;

      localStorage.removeItem('asterix_pending_status_views');

      queue.forEach(function(statusId) {
        if (window.API && typeof window.API.recordStatusView === 'function') {
          window.API.recordStatusView(statusId).catch(function(err) {
            console.warn('Failed to flush view', statusId, err);
          });
        }
      });
    } catch(e) {}
  }

  window.addEventListener('online', flushOfflineViews);

  (function _injectGridStyles() {
    if (document.getElementById('sv-grid-sel-style')) return;
    var s = document.createElement('style');
    s.id  = 'sv-grid-sel-style';
    s.textContent = [
      '.sv-market-grid-cell.sv-grid-selected{ outline:3px solid #e6a817; outline-offset:-3px; z-index:2; position:relative;}',
      '.sv-grid-sel-badge{ position:absolute; top:6px; right:6px; width:22px; height:22px; border-radius:50%; background:#e6a817; color:#000; font-size:13px; font-weight:900; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.5); z-index:3; pointer-events:none;}',
      '.sv-grid-tap-hint{ position:absolute; bottom:8px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.65); color:#fff; font-size:11px; font-weight:600; padding:4px 12px; border-radius:20px; pointer-events:none; white-space:nowrap; z-index:4; letter-spacing:.3px;}',
      '#sv-pause-btn{ position:absolute; bottom:70px; left:16px; z-index:15; background:rgba(0,0,0,0.5); border:none; border-radius:50%; width:40px; height:40px; color:#fff; font-size:20px; cursor:pointer; display:none; backdrop-filter:blur(4px); transition:background .2s; display:flex; align-items:center; justify-content:center;}',
      '#sv-pause-btn:hover{ background:rgba(0,0,0,0.75);}',
      '#sv-cat-replay-btn{ display:inline-flex; align-items:center; gap:6px; background:rgba(230,168,23,0.15); border:1px solid rgba(230,168,23,0.4); border-radius:24px; padding:10px 20px; font-size:14px; font-weight:700; color:#e6a817; cursor:pointer; transition:background .15s, transform .1s;}',
      '#sv-cat-replay-btn:hover{ background:rgba(230,168,23,0.28); transform:scale(1.03);}',
    ].join('');
    document.head.appendChild(s);
  })();

  function updateStatusBadges() {
    fetch('/api/status/unread-counts/')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var counts = data.counts || {};
        var categories = ['General', 'Funerals', 'Weddings', 'Market', 'Church'];

        categories.forEach(function(cat) {
          var badge = document.getElementById('badge-' + cat);
          var ring = document.getElementById('ring-' + cat);

          if (!badge || !ring) return;

          var count = counts[cat] || 0;

          if (count > 0) {
            badge.textContent = count;
            badge.classList.add('show');
            ring.classList.add('unread');
          } else {
            badge.textContent = '';
            badge.classList.remove('show');
            ring.classList.remove('unread');
          }
        });
      })
      .catch(function(e) { console.warn('Could not fetch status badges:', e); });
  }

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
    var fill = document.getElementById('sv-seg-' + idx);
    fill = fill ? fill.querySelector('.sv-seg-fill') : null;
    if (!fill) { onDone(); return; }

    for (var i = 0; i < idx; i++) {
      var s = document.getElementById('sv-seg-' + i);
      if (s) s.classList.add('done');
    }
    var seg = document.getElementById('sv-seg-' + idx);
    if (seg) seg.classList.add('active');

    fill.style.transition = 'none';
    fill.style.width = '0%';
    requestAnimationFrame(function () {
      fill.style.transition = 'width ' + duration + 'ms linear';
      fill.style.width = '100%';
    });
    viewer.timer = setTimeout(onDone, duration);
  }

  function pauseViewer() {
    if (viewer.isPaused) return;
    viewer.isPaused = true;
    clearTimeout(viewer.timer);
    if (viewer.isVideo && dom.svVid && !dom.svVid.paused) dom.svVid.pause();
    var indicator = document.getElementById('sv-pause-indicator');
    if (indicator) indicator.classList.add('show');
    _syncPauseBtn();
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
          animateSegment(viewer.idx, remaining, function () {
            if (!viewer.isPaused) showStatus(viewer.idx + 1);
          });
        } else {
          if (!viewer.isPaused) showStatus(viewer.idx + 1);
        }
      }
    }
    if (viewer.isVideo && dom.svVid) dom.svVid.play().catch(function () {});
    _syncPauseBtn();
  }

  function togglePause() {
    if (viewer.isPaused) resumeViewer(); else pauseViewer();
  }

  function _syncPauseBtn() {
    if (!_pauseBtn) return;
    _pauseBtn.innerHTML = viewer.isPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
    _pauseBtn.title = viewer.isPaused ? 'Resume' : 'Pause';
  }

  function createPauseButton() {
    if (_pauseBtn) { _pauseBtn.style.display = 'flex'; _syncPauseBtn(); return; }

    var btn = document.createElement('button');
    btn.id = 'sv-pause-btn';
    btn.innerHTML = '<i class="fas fa-pause"></i>';
    btn.title = 'Pause';
    btn.setAttribute('aria-label', 'Pause / Resume');
    btn.addEventListener('click', function (e) { e.stopPropagation(); togglePause(); });

    var mediaWrap = dom.viewerModal.querySelector('.sv-media-wrap') || dom.viewerModal;
    mediaWrap.appendChild(btn);
    _pauseBtn = btn;
    _syncPauseBtn();
  }

  function resetViewer() {
    clearTimeout(viewer.timer);
    dom.svVid.pause();
    dom.svVid.src = '';
    dom.svImg.src = '';
    dom.svImg.style.display = 'none';
    dom.svVid.style.display  = 'none';
    dom.svCaption.style.display = 'none';
    dom.svAdBar.classList.remove('show');
    dom.svCatEnd.classList.remove('show');
    if (dom.svCommerceBar) dom.svCommerceBar.style.display = 'none';
    viewer.isPaused      = false;
    viewer.isVideo       = false;
    viewer.videoElement  = null;

    var mediaWrap = dom.svImg.parentNode;
    if (mediaWrap) {
      var carousel = mediaWrap.querySelector('.sv-carousel');
      if (carousel) carousel.remove();
      var grid = mediaWrap.querySelector('.sv-market-grid');
      if (grid) grid.remove();
      var hint = mediaWrap.querySelector('.sv-grid-tap-hint');
      if (hint) hint.remove();
    }
    var fsOverlay = document.getElementById('sv-market-fullscreen');
    if (fsOverlay) fsOverlay.remove();

    if (_pauseBtn) {
      _pauseBtn.style.display = 'none';
      _pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
  }

  function replayCurrentCategory() {
    var category = viewer.currentCategory;
    if (!category) return;

    dom.svCatEnd.classList.remove('show');
    endScreenActive = false;

    var ct   = dom.svCategoryTransition;
    var icon = dom.svCtIcon;
    var name = dom.svCtName;
    icon.textContent = SV_CAT_ICONS[category] || '🌐';
    name.textContent = catLabel(category);
    ct.classList.add('show');
    if (ctTimer) { clearTimeout(ctTimer); ctTimer = null; }
    ctTimer = setTimeout(function () { ct.classList.remove('show'); ctTimer = null; }, 1300);

    dom.svUsername.textContent = 'Loading…';

    API.getStatusFeed(category)
      .then(function (res) {
        if (!res.ok) throw new Error(res.data.error || 'Feed error');
        viewer.playlist = res.data.playlist || [];
        if (!viewer.playlist.length) {
          toast('No statuses', 'No active ' + catLabel(category) + ' statuses right now.');
          closeViewer();
          return;
        }
        viewer.idx = 0;
        buildSegments(viewer.playlist.length);
        showStatus(0);
      })
      .catch(function () {
        toast('Error', 'Could not reload statuses.');
        closeViewer();
      });
  }

  function openChatWithUser(username, profilePicture) {
    closeViewer();
    if (window.Asterix && window.Asterix.chat) {
      var contact = { username: username, profile_picture: profilePicture || '' };
      window.Asterix.chat.addConversationItem(contact);
      window.Asterix.chat.openConversation(username);
      setTimeout(function () { window.Asterix.chat.loadMessages(username, true); }, 300);
    } else {
      toast('Error', 'Chat module not available.');
    }
  }

  function openOfferModal(statusId) {
    var id = parseInt(statusId, 10);
    if (isNaN(id) || id <= 0) { toast('Error', 'Invalid status ID.'); return; }
    offerTargetStatusId = id;
    var amountEl = document.getElementById('offer-amount');
    var statusEl = document.getElementById('offer-status');
    var btn      = document.getElementById('offer-submit-btn');
    amountEl.value = '';
    statusEl.textContent = '';
    statusEl.className = 'modal-status';
    btn.disabled = false;
    btn.textContent = 'Send Offer';
    document.getElementById('offer-modal').classList.add('open');
    setTimeout(function () { amountEl.focus(); }, 200);
  }

  function closeOfferModal() {
    document.getElementById('offer-modal').classList.remove('open');
    offerTargetStatusId = null;
  }

  function submitOffer() {
    var amount   = document.getElementById('offer-amount').value.trim();
    var statusEl = document.getElementById('offer-status');
    var btn      = document.getElementById('offer-submit-btn');
    if (!amount) { statusEl.textContent = 'Please enter an amount.'; statusEl.className = 'modal-status err'; return; }
    var num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { statusEl.textContent = 'Please enter a positive number.'; statusEl.className = 'modal-status err'; return; }
    if (!offerTargetStatusId) { statusEl.textContent = 'Error: missing status ID.'; statusEl.className = 'modal-status err'; return; }
    btn.disabled = true; btn.textContent = 'Sending…'; statusEl.textContent = ''; statusEl.className = 'modal-status';

    if (window.Asterix && window.Asterix.deals) {
      window.Asterix.deals.createOffer(offerTargetStatusId, num)
        .then(function () {
          toast('Offer sent', 'Your offer has been sent to the seller.');
          closeOfferModal();
          var item = viewer.playlist[viewer.idx];
          if (item && item.username) openChatWithUser(item.username, item.profile_picture);
        })
        .catch(function (err) {
          if (err.data && err.data.error && err.data.error.includes('already have a pending offer')) {
            toast('Offer pending', 'You already have a pending offer. Withdraw it first.');
            closeOfferModal();
          } else {
            statusEl.textContent = err.message || 'Could not send offer.';
            statusEl.className = 'modal-status err';
            btn.disabled = false; btn.textContent = 'Send Offer';
          }
        });
    } else {
      statusEl.textContent = 'Deals module not loaded.'; statusEl.className = 'modal-status err';
      btn.disabled = false; btn.textContent = 'Send Offer';
    }
  }

  function openCounterOfferModal(offerId, currentAmount) {
    var id = parseInt(offerId, 10);
    if (isNaN(id) || id <= 0) { toast('Error', 'Invalid offer ID.'); return; }
    counterTargetOfferId = id;
    var amountEl = document.getElementById('counter-amount');
    var statusEl = document.getElementById('counter-status');
    var btn      = document.getElementById('counter-submit-btn');
    amountEl.value = currentAmount || '';
    statusEl.textContent = ''; statusEl.className = 'modal-status';
    btn.disabled = false; btn.textContent = 'Send Counter';
    document.getElementById('counter-offer-modal').classList.add('open');
    setTimeout(function () { amountEl.focus(); }, 200);
  }

  function closeCounterOfferModal() {
    document.getElementById('counter-offer-modal').classList.remove('open');
    counterTargetOfferId = null;
  }

  function submitCounterOffer() {
    var amount   = document.getElementById('counter-amount').value.trim();
    var statusEl = document.getElementById('counter-status');
    var btn      = document.getElementById('counter-submit-btn');
    if (!amount) { statusEl.textContent = 'Please enter an amount.'; statusEl.className = 'modal-status err'; return; }
    var num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { statusEl.textContent = 'Please enter a positive number.'; statusEl.className = 'modal-status err'; return; }
    if (!counterTargetOfferId) { statusEl.textContent = 'Error: missing offer ID.'; statusEl.className = 'modal-status err'; return; }
    btn.disabled = true; btn.textContent = 'Sending…'; statusEl.textContent = ''; statusEl.className = 'modal-status';

    if (window.Asterix && window.Asterix.deals) {
      window.Asterix.deals.respondToOffer(counterTargetOfferId, 'counter', num)
        .then(function () {
          toast('Counter sent', 'Your counter-offer has been sent.');
          closeCounterOfferModal();
          if (typeof refreshThread === 'function') refreshThread();
        })
        .catch(function (err) {
          statusEl.textContent = err.message || 'Could not send counter.';
          statusEl.className = 'modal-status err';
          btn.disabled = false; btn.textContent = 'Send Counter';
        });
    } else {
      statusEl.textContent = 'Deals module not loaded.'; statusEl.className = 'modal-status err';
      btn.disabled = false; btn.textContent = 'Send Counter';
    }
  }

  function openBuyModal(statusId, price, title, mediaUrl, sellerUsername) {
    var id = parseInt(statusId, 10);
    if (isNaN(id) || id <= 0) { toast('Error', 'Invalid listing.'); return; }
    buyTargetStatusId = id;
    _buyContext = { statusId: id, price: price, title: title, mediaUrl: mediaUrl, sellerUsername: sellerUsername };

    var thumb     = document.getElementById('buy-product-thumb');
    var thumbIcon = document.getElementById('buy-thumb-icon');
    if (mediaUrl) {
      thumb.src = mediaUrl; thumb.style.display = 'block'; thumbIcon.style.display = 'none';
      thumb.onerror = function () { thumb.style.display = 'none'; thumbIcon.style.display = ''; };
    } else {
      thumb.style.display = 'none'; thumbIcon.style.display = '';
    }
    document.getElementById('buy-item-title').textContent  = title || 'Item';
    document.getElementById('buy-item-price').textContent  = price ? 'K' + parseFloat(price).toLocaleString('en-ZM', { minimumFractionDigits: 2 }) : '';
    document.getElementById('buy-item-note').textContent   = sellerUsername ? 'Seller: @' + sellerUsername : '';
    document.getElementById('buy-payment-method').value    = '';
    document.getElementById('buy-mobile-field').style.display = 'none';
    document.getElementById('buy-mobile-number').value     = '';
    document.getElementById('buy-delivery-address').value  = '';
    document.getElementById('buy-delivery-instructions').value = '';
    document.getElementById('buy-status').textContent      = '';
    document.getElementById('buy-status').className        = 'modal-status';
    document.getElementById('buy-submit-btn').disabled     = false;
    document.getElementById('buy-submit-btn').textContent  = 'Confirm Purchase';
    document.getElementById('buy-modal').classList.add('open');
  }

  function toggleBuyMobileField() {
    var method      = document.getElementById('buy-payment-method').value;
    var mobileField = document.getElementById('buy-mobile-field');
    var mobileLabel = document.getElementById('buy-mobile-label');
    var mobileHint  = document.getElementById('buy-mobile-hint');
    var hints = {
      airtel_money:  { label: 'Airtel Money Number',  hint: 'Starts with 097 or 077' },
      mtn_money:     { label: 'MTN MoMo Number',      hint: 'Starts with 096 or 076' },
      zamtel_kwacha: { label: 'Zamtel Kwacha Number', hint: 'Starts with 095 or 075' },
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
    buyTargetStatusId = null; _buyContext = null;
  }

  function submitBuyNow() {
    var statusId = buyTargetStatusId;
    if (!statusId) { toast('Error', 'Missing status ID.'); return; }
    var paymentMethod   = document.getElementById('buy-payment-method').value.trim();
    var mobileNumber    = document.getElementById('buy-mobile-number').value.trim();
    var deliveryAddress = document.getElementById('buy-delivery-address').value.trim();
    var instructions    = document.getElementById('buy-delivery-instructions').value.trim();
    if (!paymentMethod) {
      document.getElementById('buy-status').textContent = 'Please select a payment method.';
      document.getElementById('buy-status').className  = 'modal-status err'; return;
    }
    var mobileMethods = { airtel_money: true, mtn_money: true, zamtel_kwacha: true };
    if (mobileMethods[paymentMethod] && !mobileNumber) {
      document.getElementById('buy-mobile-number').style.borderColor = '#f15c6d';
      document.getElementById('buy-mobile-number').focus();
      document.getElementById('buy-status').textContent = 'Enter your mobile money number.';
      document.getElementById('buy-status').className  = 'modal-status err'; return;
    }
    var btn      = document.getElementById('buy-submit-btn');
    var statusEl = document.getElementById('buy-status');
    btn.disabled = true; btn.textContent = 'Processing…';
    statusEl.textContent = ''; statusEl.className = 'modal-status';

    var fullAddress = deliveryAddress;
    if (mobileNumber) fullAddress = (fullAddress ? fullAddress + ' | ' : '') + 'Pay to: ' + mobileNumber;

    window.Asterix.deals.takeListing(statusId, paymentMethod, fullAddress, instructions)
      .then(function () {
        toast('Purchase request sent!', 'The seller will confirm your order in chat.');
        closeBuyModal();
        var ctx        = _buyContext;
        var sellerUser = (ctx && ctx.sellerUsername) || null;
        if (!sellerUser) { var item = viewer && viewer.playlist && viewer.playlist[viewer.idx]; if (item) sellerUser = item.username; }
        if (sellerUser) openChatWithUser(sellerUser, null);
      })
      .catch(function (err) {
        statusEl.textContent = err.message || 'Could not complete purchase.';
        statusEl.className = 'modal-status err';
        btn.disabled = false; btn.textContent = 'Confirm Purchase';
      });
  }

  function updateCommerceBar(status) {
    if (!dom.svCommerceBar || !status || !status.is_commercial) {
      if (dom.svCommerceBar) dom.svCommerceBar.style.display = 'none';
      return;
    }
    dom.svCommerceBar.style.display = 'block';
    dom.svPriceBadge.textContent    = status.price ? 'K' + parseFloat(status.price).toLocaleString() : 'Price not set';
    var qty = (status.quantity !== undefined) ? status.quantity : 1;
    var avail = (qty > 0 && status.availability === 'sold') ? 'available' : (status.availability || 'available');
    var availColors  = { available: '#25d366', reserved: '#ffc107', sold: '#f15c6d' };
    dom.svAvailBadge.textContent    = avail.toUpperCase();
    dom.svAvailBadge.style.color    = availColors[avail] || '#fff';

    var isOwner = status.username === State.ME;
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
      editBtn.onclick = function () {
        if (window.Asterix && window.Asterix.market && typeof window.Asterix.market.editStatus === 'function') {
          window.Asterix.market.editStatus(status.status_id); closeViewer();
        } else { toast('Not available', 'Market edit feature not loaded.'); }
      };
      dom.svActionContainer.appendChild(editBtn);
      return;
    }
    if (!isOwner && avail === 'available') {
      var intBtn = document.createElement('button');
      intBtn.id = 'sv-interest-btn';
      intBtn.textContent = '💬 I\'m Interested';
      intBtn.style.cssText = 'background:linear-gradient(135deg,#25d366,#128c7e);border:none;border-radius:20px;padding:7px 18px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:opacity .15s;';
      intBtn.onclick = function () { openInterestSheet(status, null); };
      dom.svActionContainer.appendChild(intBtn);
    }
  }

  function openInterestSheet(status, selectedMedia) {
    pauseViewer();

    var overlay = document.getElementById('sv-interest-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'sv-interest-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);animation:fadeInSheet .18s ease;';

    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--card,#1e1e1e);border-radius:20px 20px 0 0;padding:20px 18px 28px;animation:slideUpSheet .2s ease;';

    if (!document.getElementById('sv-sheet-style')) {
      var sty = document.createElement('style');
      sty.id = 'sv-sheet-style';
      sty.textContent = '@keyframes fadeInSheet{from{opacity:0}to{opacity:1}}@keyframes slideUpSheet{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}';
      document.head.appendChild(sty);
    }

    var hasSelected = !!(selectedMedia && selectedMedia.url);

    var pill = document.createElement('div');
    pill.style.cssText = 'border-radius:12px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,0.08);' + (hasSelected ? 'background:rgba(230,168,23,0.08);border-color:rgba(230,168,23,0.2);' : 'background:rgba(255,255,255,0.05);');

    if (hasSelected) {
      var selThumb = document.createElement('div');
      selThumb.style.cssText = 'width:56px;height:56px;border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--mid,#2a2f2f);border:2px solid #e6a817;';
      var selImg = document.createElement('img');
      selImg.src = selectedMedia.url;
      selImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      selImg.onerror = function () { selThumb.innerHTML = '<span style="font-size:22px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">🏷️</span>'; };
      selThumb.appendChild(selImg);
      pill.appendChild(selThumb);

      var selInfo = document.createElement('div');
      selInfo.style.cssText = 'flex:1;min-width:0;';
      var photoLabel = document.createElement('div');
      photoLabel.style.cssText = 'font-size:10px;color:#e6a817;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;';
      photoLabel.textContent   = 'Photo ' + (selectedMedia.index + 1) + ' of ' + selectedMedia.total + ' selected';
      var selCaption = document.createElement('div');
      selCaption.style.cssText = 'font-size:13px;font-weight:700;color:var(--text,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      selCaption.textContent   = (selectedMedia.caption || status.caption || 'Listing').slice(0, 55);
      selInfo.appendChild(photoLabel); selInfo.appendChild(selCaption);
      var priceText = status.price ? 'K' + parseFloat(status.price).toLocaleString('en-ZM', { minimumFractionDigits: 2 }) : '';
      if (priceText) {
        var selPrice = document.createElement('div');
        selPrice.style.cssText = 'font-size:12px;color:#e6a817;font-weight:600;margin-top:2px;';
        selPrice.textContent   = priceText + (status.is_negotiable ? ' · negotiable' : '');
        selInfo.appendChild(selPrice);
      }
      pill.appendChild(selInfo);
    } else {
      var iconSpan = document.createElement('span');
      iconSpan.style.cssText = 'font-size:20px;flex-shrink:0;'; iconSpan.textContent = '🏷️';
      var pillInfo = document.createElement('div');
      var pt = status.price ? 'K' + parseFloat(status.price).toLocaleString('en-ZM', { minimumFractionDigits: 2 }) : '';
      pillInfo.innerHTML = '<div style="font-size:13px;font-weight:700;color:var(--text,#fff);">' + (status.caption ? status.caption.slice(0, 60) : 'Listing') + '</div>' + (pt ? '<div style="font-size:12px;color:#e6a817;font-weight:600;">' + pt + (status.is_negotiable ? ' · negotiable' : '') + '</div>' : '');
      pill.appendChild(iconSpan); pill.appendChild(pillInfo);
    }
    sheet.appendChild(pill);

    var title = document.createElement('div');
    title.style.cssText = 'font-size:11px;color:var(--sub,#aaa);text-transform:uppercase;letter-spacing:.6px;font-weight:700;margin-bottom:12px;';
    title.textContent   = hasSelected ? 'Interested in this item?' : 'How do you want to proceed?';
    sheet.appendChild(title);

    var rows = document.createElement('div');
    rows.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

    function sheetRow(icon, label, sub, accent, onClick) {
      var row = document.createElement('button');
      row.style.cssText = 'display:flex;align-items:center;gap:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:13px 16px;cursor:pointer;text-align:left;transition:background .15s;width:100%;';
      row.innerHTML = '<span style="font-size:22px;flex-shrink:0;">' + icon + '</span><div style="flex:1;"><div style="font-size:14px;font-weight:700;color:' + accent + ';">' + label + '</div><div style="font-size:11px;color:var(--sub,#aaa);margin-top:2px;">' + sub + '</div></div><i class="fas fa-chevron-right" style="color:rgba(255,255,255,0.25);font-size:11px;"></i>';
      row.onclick = onClick;
      return row;
    }

    rows.appendChild(sheetRow('💬', 'Ask the Seller', 'Send a quick message — free to negotiate in chat', 'var(--text,#fff)', function () {
      var item = viewer.playlist[viewer.idx];
      if (!item) return;
      _closeInterestSheetAndClearGrid();
      _sendEnquiryAndNavigate(item, selectedMedia);
    }));

    if (status.is_negotiable) {
      rows.appendChild(sheetRow('🤝', 'Make an Offer', 'Propose your price — the seller can accept or counter', '#e6a817', function () {
        var item = viewer.playlist[viewer.idx];
        _closeInterestSheetAndClearGrid();
        if (window.Asterix && window.Asterix.negotiate) {
          window.Asterix.negotiate.openBargainSheet(item, null, selectedMedia, 'offer', null);
        } else {
          openOfferModal(status.status_id);
        }
      }));
    }

    rows.appendChild(sheetRow('🛒', 'Buy Now', status.price ? 'Purchase at K' + parseFloat(status.price).toLocaleString('en-ZM', { minimumFractionDigits: 2 }) : 'Purchase at listed price', '#25d366', function () {
      var item = viewer.playlist[viewer.idx];
      _closeInterestSheetAndClearGrid();
      window.Asterix.checkout.open(_statusToListing(status), selectedMedia, function () {});
    }));

    sheet.appendChild(rows);
    var cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'width:100%;margin-top:16px;background:transparent;border:none;color:var(--sub,#aaa);font-size:13px;padding:8px;cursor:pointer;';
    cancelBtn.textContent   = 'Cancel';
    cancelBtn.onclick = function () { _closeInterestSheetAndClearGrid(); resumeViewer(); };
    sheet.appendChild(cancelBtn);

    overlay.appendChild(sheet);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { _closeInterestSheetAndClearGrid(); resumeViewer(); } });

    var svModal = document.getElementById('status-viewer-modal');
    if (svModal) svModal.appendChild(overlay);
  }

  function _closeInterestSheetAndClearGrid() {
    var overlay = document.getElementById('sv-interest-overlay');
    if (overlay) overlay.remove();
    var grid = document.querySelector('.sv-market-grid');
    if (grid && typeof grid._clearSelection === 'function') grid._clearSelection();
  }

  function closeInterestSheet() { _closeInterestSheetAndClearGrid(); }

  function _sendEnquiryAndNavigate(item, selectedMedia) {
    if (!item) return;
    var targetUser = item.username;
    if (targetUser === State.ME) { toast('Info', 'That\'s your own listing.'); return; }

    var intBtn = document.getElementById('sv-interest-btn');
    if (intBtn) { intBtn.disabled = true; intBtn.textContent = '⏳ Opening chat…'; }

    var priceText = item.price ? 'K' + parseFloat(item.price).toLocaleString('en-ZM', { minimumFractionDigits: 2 }) : '';
    var quoteLine = '>️ Listing' + (item.caption ? ': ' + item.caption.slice(0, 60) : '') + (priceText ? ' — ' + priceText : '');
    var photoNote = (selectedMedia && selectedMedia.index !== undefined) ? '\n> ' + (selectedMedia.index + 1) + ' of ' + selectedMedia.total : '';
    var messageText = quoteLine + photoNote + '\n\n' + "Hi, I'm interested in your listing. Can you tell me more?";

    var fd = new FormData();
    fd.append('recipient', targetUser);
    fd.append('message', messageText);
    fd.append('is_status_reply', 'true');
    if (item.status_id) fd.append('status_id', item.status_id);

    var mediaUrl = (selectedMedia && selectedMedia.url) ? selectedMedia.url : item.media_url;

    function finishSend() {
      API.sendMessage(fd).then(function (res) {
        if (res.ok && res.data.status === 'success') {
          openChatWithUser(targetUser, item.profile_picture);
        } else {
          toast('Error', res.data.message || 'Could not send enquiry.');
          if (intBtn) { intBtn.disabled = false; intBtn.textContent = '💬 I\'m Interested'; }
          resumeViewer();
        }
      }).catch(function () {
        toast('Error', 'Could not send enquiry. Please try again.');
        if (intBtn) { intBtn.disabled = false; intBtn.textContent = '💬 I\'m Interested'; }
        resumeViewer();
      });
    }

    if (mediaUrl) {
      fetchStatusMediaAsBlob(mediaUrl).then(function (blob) {
        var filename = mediaUrl.split('/').pop().split('?')[0] || 'listing.jpg';
        fd.append('files', blob, filename);
        finishSend();
      }).catch(finishSend);
    } else {
      finishSend();
    }
  }

  function sendStatusReply(text) {
    if (!viewer.playlist.length) return;
    var statusObj = viewer.playlist[viewer.idx];
    if (!statusObj || statusObj.type === 'advertisement') return;
    var targetUser = statusObj.username;
    if (targetUser === State.ME) { toast('Info', 'You cannot reply to your own status.'); return; }

    var mediaUrl  = statusObj.media_url;
    var mediaType = mediaTypeFromUrl(mediaUrl);
    var sender    = statusObj.username || 'Someone';
    var quoteLine = '> 📌 ' + (mediaType.icon || '') + ' ' + (mediaType.label || '📝 Text') + ' status from ' + sender;
    if (statusObj.caption) quoteLine += ': ' + statusObj.caption.slice(0, 60);
    var replyMessage = quoteLine + '\n\n' + text;

    var fd = new FormData();
    fd.append('recipient', targetUser);
    fd.append('message', replyMessage);
    fd.append('is_status_reply', 'true');
    if (statusObj.status_id) fd.append('status_id', statusObj.status_id);

    if (mediaUrl) {
      fetchStatusMediaAsBlob(mediaUrl).then(function (blob) {
        var filename = mediaUrl.split('/').pop().split('?')[0] || 'media';
        fd.append('files', blob, filename);
        return API.sendMessage(fd);
      }).then(function (res) {
        if (res.ok && res.data.status === 'success') {
          toast('Replied to ' + sender + '\'s status', '✓ Sent');
          dom.svReplyInput.value = '';
          if (State.activeRecipient === targetUser && window.Asterix && window.Asterix.chat) {
            window.Asterix.chat.loadMessages(State.activeRecipient);
          }
        } else { toast('Error', res.data.message || 'Failed to send reply'); }
      }).catch(function () {
        API.sendMessage(fd).then(function (res) {
          if (res.ok && res.data.status === 'success') {
            toast('Replied (without media)', '✓ Sent'); dom.svReplyInput.value = '';
          } else { toast('Error', 'Failed to send reply'); }
        });
      });
    } else {
      API.sendMessage(fd).then(function (res) {
        if (res.ok && res.data.status === 'success') {
          toast('Replied to ' + sender + '\'s status', '✓ Sent'); dom.svReplyInput.value = '';
          if (State.activeRecipient === targetUser && window.Asterix && window.Asterix.chat) {
            window.Asterix.chat.loadMessages(State.activeRecipient);
          }
        } else { toast('Error', res.data.message || 'Failed to send reply'); }
      }).catch(function () { toast('Error', 'Failed to send reply'); });
    }
  }

  function fetchStatusMediaAsBlob(url) {
    return fetch('/api/status/proxy-media/?url=' + encodeURIComponent(url)).then(function (r) {
      if (!r.ok) throw new Error('Failed to fetch media');
      return r.blob();
    });
  }

  function _createSwipeCarousel(mediaList, startIndex) {
    var wrapper  = document.createElement('div');
    wrapper.className = 'sv-carousel';
    var track    = document.createElement('div');
    track.className = 'sv-carousel-track';
    var dotsContainer = document.createElement('div');
    dotsContainer.className = 'sv-carousel-dots';

    var currentIndex = startIndex || 0;
    var total        = mediaList.length;

    mediaList.forEach(function (media, index) {
      var slide = document.createElement('div');
      slide.className = 'sv-carousel-slide';
      var isVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(media.url);
      if (isVideo) {
        var vid = document.createElement('video');
        vid.src = media.url; vid.controls = true; vid.playsInline = true;
        slide.appendChild(vid);
      } else {
        var img = document.createElement('img');
        img.src = media.url; img.alt = media.caption || ''; img.loading = 'lazy';
        slide.appendChild(img);
      }
      track.appendChild(slide);

      var dot = document.createElement('span');
      dot.className = 'sv-carousel-dot' + (index === currentIndex ? ' active' : '');
      dot.dataset.index = index;
      dot.addEventListener('click', function (e) { e.stopPropagation(); goToSlide(parseInt(this.dataset.index, 10)); });
      dotsContainer.appendChild(dot);
    });

    function goToSlide(index) {
      if (index < 0) index = total - 1;
      if (index >= total) index = 0;
      currentIndex = index;
      track.style.transform = 'translateX(-' + (currentIndex * 100) + '%)';
      dotsContainer.querySelectorAll('.sv-carousel-dot').forEach(function (d, i) { d.classList.toggle('active', i === currentIndex); });
    }
    goToSlide(currentIndex);

    var prevBtn = document.createElement('button');
    prevBtn.className = 'sv-carousel-btn prev'; prevBtn.innerHTML = '&#8249;';
    prevBtn.addEventListener('click', function (e) { e.stopPropagation(); goToSlide(currentIndex - 1); });

    var nextBtn = document.createElement('button');
    nextBtn.className = 'sv-carousel-btn next'; nextBtn.innerHTML = '&#8250;';
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); goToSlide(currentIndex + 1); });

    var startX = 0;
    track.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend',   function (e) {
      var diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) goToSlide(currentIndex + (diff > 0 ? 1 : -1));
    }, { passive: true });

    wrapper.appendChild(track); wrapper.appendChild(prevBtn); wrapper.appendChild(nextBtn); wrapper.appendChild(dotsContainer);
    return { element: wrapper, goToSlide: goToSlide };
  }

  function _ensureMarketGridStyles() {
    if (document.getElementById('sv-market-grid-style')) return;
    var sty = document.createElement('style');
    sty.id  = 'sv-market-grid-style';
    sty.textContent = [
      '.sv-market-grid{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:2px;background:#000;z-index:6;}',
      '.sv-market-grid[data-count="1"]{grid-template-columns:1fr;grid-template-rows:1fr;}',
      '.sv-market-grid[data-count="2"]{grid-template-rows:1fr;}',
      '.sv-market-grid[data-count="3"] .sv-market-grid-cell:first-child{grid-row:1/3;}',
      '.sv-market-grid-cell{position:relative;background-size:cover;background-position:center;cursor:pointer;transition:outline .12s;}',
      '.sv-grid-play-icon{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;text-shadow:0 2px 8px rgba(0,0,0,.6);pointer-events:none;}',
      '.sv-grid-more-badge{position:absolute;inset:0;background:rgba(0,0,0,.55);color:#fff;font-size:22px;font-weight:800;display:flex;align-items:center;justify-content:center;}',
      '.sv-grid-tap-dot{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,.8);background:rgba(0,0,0,.3);box-shadow:0 1px 5px rgba(0,0,0,.5);pointer-events:none;z-index:2;animation:svTapPulse 1.8s ease-in-out infinite;}',
      '@keyframes svTapPulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.15);opacity:1}}',
      '.sv-market-fullscreen{position:absolute;inset:0;z-index:40;background:#000;}',
      '.sv-market-fs-close{position:absolute;top:14px;left:14px;z-index:41;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.6);border:none;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
    ].join('');
    document.head.appendChild(sty);
  }

  function buildMarketGrid(mediaWrap, item) {
    _ensureMarketGridStyles();
    var mediaList = item.media_list || [];
    var count     = mediaList.length;

    var grid = document.createElement('div');
    grid.className = 'sv-market-grid';
    grid.setAttribute('data-count', String(Math.min(count, 4)));

    var tapHint = document.createElement('div');
    tapHint.className = 'sv-grid-tap-hint';
    tapHint.textContent = '👆 Tap a photo to select it';

    var selectedIndex = null;
    var cells         = [];

    function _applySelection() {
      cells.forEach(function (cell, i) {
        var badge = cell.querySelector('.sv-grid-sel-badge');
        var dot   = cell.querySelector('.sv-grid-tap-dot');
        if (i === selectedIndex) {
          cell.classList.add('sv-grid-selected');
          if (dot) dot.style.display = 'none';
          if (!badge) {
            badge = document.createElement('div');
            badge.className = 'sv-grid-sel-badge';
            badge.textContent = '✓';
            cell.appendChild(badge);
          }
        } else {
          cell.classList.remove('sv-grid-selected');
          if (badge) badge.remove();
          if (dot) dot.style.display = '';
        }
      });
      if (selectedIndex !== null) {
        tapHint.style.display = 'none';
      } else {
        tapHint.style.display = '';
      }
    }

    mediaList.slice(0, 4).forEach(function (media, i) {
      var cell = document.createElement('div');
      cell.className = 'sv-market-grid-cell';

      var isVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(media.url);
      if (isVideo) {
        cell.style.backgroundColor = '#000';
        var playIcon = document.createElement('i');
        playIcon.className = 'fas fa-play-circle sv-grid-play-icon';
        cell.appendChild(playIcon);
      } else {
        cell.innerHTML = '<img src="' + media.url.replace(/'/g, '%27') + '" style="width:100%;height:100%;object-fit:contain;background:#000;">';
      }

      var tapDot = document.createElement('div');
      tapDot.className = 'sv-grid-tap-dot';
      cell.appendChild(tapDot);

      if (i === 3 && count > 4) {
        var more = document.createElement('span');
        more.className = 'sv-grid-more-badge';
        more.textContent = '+' + (count - 4);
        cell.appendChild(more);
      }

      cell.addEventListener('click', function (e) {
        e.stopPropagation();

        if (selectedIndex === i) {
          selectedIndex = null;
          _applySelection();
          _closeInterestSheetAndClearGrid();
          resumeViewer();
          return;
        }

        selectedIndex = i;
        _applySelection();
        pauseViewer();

        openInterestSheet(item, {
          url:     media.url,
          caption: media.caption || item.caption || '',
          index:   i,
          total:   count,
        });
      });

      cells.push(cell);
      grid.appendChild(cell);
    });

    grid._clearSelection = function () {
      selectedIndex = null;
      _applySelection();
    };

    mediaWrap.style.position = 'relative';
    mediaWrap.appendChild(grid);
    mediaWrap.appendChild(tapHint);
    return grid;
  }

  function openMarketFullscreenCarousel(mediaList, startIndex) {
    pauseViewer();
    var existing = document.getElementById('sv-market-fullscreen');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id  = 'sv-market-fullscreen';
    overlay.className = 'sv-market-fullscreen';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'sv-market-fs-close';
    closeBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    closeBtn.setAttribute('aria-label', 'Back');
    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); overlay.remove(); resumeViewer(); });

    var carousel = _createSwipeCarousel(mediaList, startIndex);
    overlay.appendChild(closeBtn);
    overlay.appendChild(carousel.element);

    var svModal = document.getElementById('status-viewer-modal');
    if (svModal) svModal.appendChild(overlay);
  }

  function showStatus(idx) {
    viewer.idx = idx;
    var item = viewer.playlist[idx];
    if (!item) { showCategoryEnd(); return; }

    if (item.type !== 'advertisement' && item.username !== State.ME) {
      recordStatusViewWithOfflineSupport(item.status_id);
    }

    resetViewer();
    createPauseButton();

    if (item.type === 'advertisement') {
      dom.svAvatar.src    = '/static/images/icon-192.png';
      dom.svUsername.textContent = item.advertiser || 'Sponsored';
      dom.svTime.textContent     = 'Sponsored';
      dom.svCatBadge.textContent = '📢 AD';
      dom.svAdLabel.textContent  = 'Visit Now';
      dom.svAdBar.classList.add('show');
      dom.svAdBar.onclick = function () {
        var link = externalLink(item.action_url);
        if (link) window.open(link, '_blank');
      };
      if (dom.svCommerceBar) dom.svCommerceBar.style.display = 'none';
    } else {
      dom.svAvatar.src    = item.profile_picture || '/static/images/default_profile_picture.webp';
      dom.svUsername.textContent = item.username || '';
      var mediaInfo = mediaTypeFromUrl(item.media_url);
      dom.svTime.textContent     = item.timestamp ? fmtTime(item.timestamp) : '';
      dom.svCatBadge.textContent = catLabel(item.category || '') + ' ' + mediaInfo.label;
      dom.svAdBar.classList.remove('show');

      updateCommerceBar(item);

      if (item.category === 'Market' && item.market_link) {
        dom.svAdLabel.textContent = '🛒 Visit Shop';
        dom.svAdBar.classList.add('show');
        dom.svAdBar.onclick = function () {
          var link = externalLink(item.market_link);
          if (link) window.open(link, '_blank');
        };
      }
      else if ((item.category === 'Weddings' || item.category === 'Celebrations') && item.market_link) {
        dom.svAdLabel.textContent = '💌 View Invitation & RSVP';
        dom.svAdBar.classList.add('show');
        dom.svAdBar.onclick = function () {
          var link = externalLink(item.market_link);
          if (link) window.open(link, '_blank');
        };
      }
      else {
        dom.svAdBar.classList.remove('show');
      }

      var mediaList    = item.media_list || [];
      var hasMultiple  = mediaList.length > 1;
      var isMarketGrid = hasMultiple && item.category === 'Market';
      var mediaWrap    = dom.svImg.closest('.sv-media-wrap') || dom.svImg.parentNode;

      var oldCarousel   = mediaWrap.querySelector('.sv-carousel');
      var oldGrid       = mediaWrap.querySelector('.sv-market-grid');
      var oldHint       = mediaWrap.querySelector('.sv-grid-tap-hint');
      var oldFullscreen = document.getElementById('sv-market-fullscreen');
      if (oldCarousel)   oldCarousel.remove();
      if (oldGrid)       oldGrid.remove();
      if (oldHint)       oldHint.remove();
      if (oldFullscreen) oldFullscreen.remove();

      if (isMarketGrid) {
        dom.svImg.style.display = 'none';
        dom.svVid.style.display = 'none';
        buildMarketGrid(mediaWrap, item);
        animateSegment(idx, viewer.duration, function () {
          if (!viewer.isPaused) showStatus(idx + 1);
        });

      } else if (hasMultiple) {
        dom.svImg.style.display = 'none';
        dom.svVid.style.display = 'none';
        var carousel = _createSwipeCarousel(mediaList, 0);
        mediaWrap.appendChild(carousel.element);
        viewer._carouselGoTo = carousel.goToSlide;

        var carouselAdvanced = false;
        var carouselFallback = null;
        var startCarouselAdvance = function () {
          if (carouselAdvanced) return;
          carouselAdvanced = true;
          clearTimeout(carouselFallback);
          if (viewer.isPaused) return;
          animateSegment(idx, viewer.duration, function () {
            if (!viewer.isPaused) showStatus(idx + 1);
          });
        };
        carouselFallback = setTimeout(startCarouselAdvance, 10000);

        var firstImg = carousel.element.querySelector('.sv-carousel-slide img');
        if (firstImg) {
          if (firstImg.complete) {
            startCarouselAdvance();
          } else {
            firstImg.addEventListener('load', startCarouselAdvance);
            firstImg.addEventListener('error', startCarouselAdvance);
          }
        } else {
          startCarouselAdvance();
        }

      } else {
        var url     = item.media_url || '';
        var isVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
        viewer.isVideo = isVideo;

        var advanced = false;
        var readyFallback = null;
        var startAdvance = function (segDur) {
          if (advanced) return;
          advanced = true;
          clearTimeout(readyFallback);
          if (viewer.isPaused) return;
          animateSegment(idx, segDur, function () {
            if (!viewer.isPaused) showStatus(idx + 1);
          });
        };
        readyFallback = setTimeout(function () { startAdvance(viewer.duration); }, 10000);

        if (isVideo && url) {
          dom.svVid.src = url;
          dom.svVid.style.display = 'block';
          dom.svVid.load();
          viewer.videoElement = dom.svVid;
          dom.svVid.onloadeddata = function () {
            dom.svVid.play().catch(function () {});
            var dur = Math.max((dom.svVid.duration || 5) * 1000, 3000);
            startAdvance(dur);
          };
          dom.svVid.onerror = function () {
            dom.svVid.style.display = 'none';
            dom.svImg.src = url;
            dom.svImg.style.display = 'block';
            startAdvance(viewer.duration);
          };
        } else if (url) {
          dom.svImg.style.display  = 'block';
          dom.svImg.style.opacity  = '0';
          dom.svImg.style.transition = 'opacity .35s ease';
          dom.svImg.onload = function () {
            dom.svImg.style.opacity = '1';
            startAdvance(viewer.duration);
          };
          dom.svImg.onerror = function () {
            dom.svImg.style.display = 'none';
            startAdvance(viewer.duration);
          };
          dom.svImg.src = url;
        } else {
          startAdvance(viewer.duration);
        }
      }
    }

    var cap = item.caption || '';
    dom.svCaption.textContent    = cap;
    dom.svCaption.style.display  = cap ? 'block' : 'none';

    renderStatusEmojis(item.category || viewer.currentCategory || 'General');
  }

  function openViewer(category, skipList, anchorIdx) {
    viewer.currentCategory = category;
    dom.viewerModal.classList.add('open');
    viewer.playlist = []; viewer.idx = 0;

    var cacheKey = 'asterix_status_cache_' + category;
    var cachedData = localStorage.getItem(cacheKey);
    var loadedFromCache = false;

    if (cachedData) {
      try {
        var parsed = JSON.parse(cachedData);
        if (Date.now() - parsed.timestamp < 86400000) {
          viewer.playlist = parsed.playlist || [];
          loadedFromCache = viewer.playlist.length > 0;
        }
      } catch(e) {}
    }

    dom.svSegments.innerHTML = '';
    dom.svUsername.textContent = loadedFromCache ? 'Refreshing…' : 'Loading…';

    var startIdx = (typeof anchorIdx === 'number') ? anchorIdx : SV_CATEGORIES.indexOf(category);

    var ct   = dom.svCategoryTransition;
    var icon = dom.svCtIcon;
    var name = dom.svCtName;
    icon.textContent = SV_CAT_ICONS[category] || '🌐';
    name.textContent = catLabel(category);
    ct.classList.add('show');
    if (ctTimer) { clearTimeout(ctTimer); ctTimer = null; }
    ctTimer = setTimeout(function () { ct.classList.remove('show'); ctTimer = null; }, 1300);

    API.getStatusFeed(category)
      .then(function (res) {
        if (!res.ok) throw new Error(res.data.error || 'Feed error');
        viewer.playlist = res.data.playlist || [];

        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            playlist: viewer.playlist
          }));
        } catch(e) {}

        if (!viewer.playlist.length) {
          var skip    = skipList ? skipList.concat([category]) : [category];
          var nextCat = null;
          for (var i = startIdx + 1; i < SV_CATEGORIES.length; i++) {
            if (skip.indexOf(SV_CATEGORIES[i]) === -1) { nextCat = SV_CATEGORIES[i]; break; }
          }
          if (nextCat) {
            icon.textContent = SV_CAT_ICONS[category] || '🌐';
            name.textContent = catLabel(category) + ' — no new statuses';
            ct.classList.add('show');
            if (ctTimer) clearTimeout(ctTimer);
            ctTimer = setTimeout(function () {
              ct.classList.remove('show'); ctTimer = null;
              openViewer(nextCat, skip, startIdx);
            }, 900);

            setTimeout(function () {
              var existing = ct.querySelector('.sv-ct-replay-skip');
              if (existing) existing.remove();
              var replaySkip = document.createElement('button');
              replaySkip.className = 'sv-ct-replay-skip';
              replaySkip.style.cssText = [
                'display:block;margin:10px auto 0;',
                'background:rgba(230,168,23,0.18);',
                'border:1px solid rgba(230,168,23,0.4);',
                'border-radius:20px;padding:6px 18px;',
                'font-size:12px;font-weight:700;color:#e6a817;cursor:pointer;'
              ].join('');
              replaySkip.textContent = '↺ Retry ' + catLabel(category);
              replaySkip.addEventListener('click', function (e) {
                e.stopPropagation();
                if (ctTimer) { clearTimeout(ctTimer); ctTimer = null; }
                ct.classList.remove('show');
                openViewer(category, skipList, anchorIdx);
              });
              ct.appendChild(replaySkip);
            }, 0);

          } else {
            showCategoryEnd();
          }
          return;
        }
        buildSegments(viewer.playlist.length);
        showStatus(0);
      })
      .catch(function () {
        if (loadedFromCache) {
          buildSegments(viewer.playlist.length);
          showStatus(0);
        } else {
          toast('Error', 'Could not load statuses.');
          closeViewer();
        }
      });
  }

  function closeViewer() {
    dom.viewerModal.classList.remove('open');
    resetViewer();
    _closeInterestSheetAndClearGrid();
    if (ctTimer) { clearTimeout(ctTimer); ctTimer = null; }
    endScreenActive = false;
    if (window.innerWidth <= 768) {
      var sidebar = document.getElementById('sidebar');
      var backBtn = document.getElementById('back-btn');
      if (sidebar) sidebar.classList.remove('hidden');
      if (backBtn) backBtn.style.display = 'none';
    }
    updateStatusBadges();
  }

  window.svClose = closeViewer;

  function showCategoryEnd() {
    if (endScreenActive) return;
    endScreenActive = true;
    clearTimeout(viewer.timer);

    dom.svCatEndIcon.textContent  = SV_CAT_ICONS[viewer.currentCategory] || '✅';
    dom.svCatEndTitle.textContent = 'All caught up!';
    dom.svCatEndSub.textContent   = 'You\'ve seen all ' + catLabel(viewer.currentCategory) + ' statuses.';

    var curIdx  = SV_CATEGORIES.indexOf(viewer.currentCategory);
    var nextCat = (curIdx >= 0 && curIdx < SV_CATEGORIES.length - 1) ? SV_CATEGORIES[curIdx + 1] : null;

    if (nextCat) {
      dom.svCatNextBtn.style.display = 'inline-flex';
      dom.svCatNextBtn.innerHTML     = (SV_CAT_ICONS[nextCat] || '') + ' ' + catLabel(nextCat) + ' <i class="fas fa-arrow-right" style="margin-left:6px;"></i>';
      dom.svCatNextBtn.onclick = function () {
        dom.svCatEnd.classList.remove('show');
        endScreenActive = false;
        openViewer(nextCat);
      };
    } else {
      dom.svCatNextBtn.style.display = 'none';
    }

    if (dom.svCatReplayBtn) {
      dom.svCatReplayBtn.style.display = 'inline-flex';
      dom.svCatReplayBtn.innerHTML =
        '<i class="fas fa-redo" style="margin-right:6px;"></i> Replay ' + catLabel(viewer.currentCategory);
      dom.svCatReplayBtn.onclick = function () {
        replayCurrentCategory();
      };
    }

    if (dom.svCatCloseBtn) {
      dom.svCatCloseBtn.textContent = 'Close';
      dom.svCatCloseBtn.onclick     = function () { closeViewer(); endScreenActive = false; };
    }

    dom.svCatEnd.classList.add('show');
  }

  function renderStatusEmojis(category) {
    var row    = dom.svEmojiRow;
    var emojis = ['❤️', '😂', '😮', '😢', '👍', '💯']
    row.innerHTML = emojis.map(function (e) {
      return '<button class="sv-emoji-btn" aria-label="React ' + e + '" data-emoji="' + e + '">' + e + '</button>';
    }).join('');

    var lastSelected = null;
    row.querySelectorAll('.sv-emoji-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var emoji = this.dataset.emoji;
        if (lastSelected && lastSelected !== this) { lastSelected.classList.remove('selected'); lastSelected.style.transform = ''; }
        if (this.classList.contains('selected')) { this.classList.remove('selected'); this.style.transform = ''; lastSelected = null; return; }
        this.classList.add('selected'); this.style.transform = 'scale(1.4)';
        setTimeout(function () { this.style.transform = 'scale(1.15)'; }.bind(this), 200);
        lastSelected = this;

        var rect = this.getBoundingClientRect();
        var el   = document.createElement('div');
        el.className   = 'emoji-burst';
        el.textContent = emoji;
        el.style.left  = (rect.left + rect.width / 2) + 'px';
        el.style.top   = rect.top + 'px';
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 850);
        if (navigator.vibrate) navigator.vibrate(30);
        setTimeout(function () { sendStatusReply(emoji); }, 120);
      });
    });
  }

  function setupReplyPause() {
    dom.svReplyInput.addEventListener('focus', pauseViewer);
    dom.svReplyInput.addEventListener('blur', function () {
      setTimeout(function () {
        if (!viewer.isPaused) return;
        if (document.activeElement !== dom.svReplyInput) resumeViewer();
      }, 300);
    });
    dom.svReplySend.addEventListener('click', function () {
      if (viewer.isPaused) setTimeout(resumeViewer, 500);
    });
    dom.svReplyInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dom.svReplySend.click(); }
    });
  }

  function shareCurrentStatus() {
    var item = viewer.playlist[viewer.idx];
    if (!item || item.type === 'advertisement') return;
    var shareUrl = window.location.origin + '/share/listing/' + item.status_id + '/';
    if (navigator.share) {
      navigator.share({
        title: 'Fizzme Listing',
        text: item.caption || 'Check out this listing on Fizzme! 🇿🇲',
        url: shareUrl
      }).catch(function () {});
    } else {
      dom.svShareOverlay.classList.add('show');
    }
  }

  function openShareSheet()  { dom.svShareOverlay.classList.add('show'); }
  function closeShareSheet() { dom.svShareOverlay.classList.remove('show'); }

  function openMyStatus() {
    dom.myStatusOverlay.style.display = 'block';
    dom.myStatusPanel.style.display   = 'block';
    loadMyStatuses();
  }

  function closeMyStatus() {
    dom.myStatusOverlay.style.display = 'none';
    dom.myStatusPanel.style.display   = 'none';
  }

  function buildStatusGridHtml(urls) {
    var count     = urls.length;
    var countAttr = count >= 4 ? (count > 4 ? 'more' : '4') : String(count);
    var cellsHtml = urls.slice(0, 4).map(function (url, i) {
      var safeUrl  = (url || '').replace(/'/g, '%27');
      var moreHtml = (i === 3 && count > 4) ? '<span class="mp-grid-more">+' + (count - 4) + '</span>' : '';
      return '<div class="mp-grid-cell"><img src="' + safeUrl + '" style="width:100%;height:100%;object-fit:contain;background:#000;">' + moreHtml + '</div>';
    }).join('');
    return '<div style="position:relative;width:46px;height:46px;border-radius:8px;overflow:hidden;flex-shrink:0;background:var(--mid);">' +
           '<div class="mp-multi-grid" data-count="' + countAttr + '">' + cellsHtml + '</div>' +
           '</div>';
  }

  function loadMyStatuses() {
    API.getMyStatuses()
      .then(function (res) {
        if (!res.ok) throw new Error(res.data.error || 'Failed to load');
        var data = res.data;
        var list = dom.myStatusesList;
        list.innerHTML = '<h4>Your active statuses</h4>';
        if (Object.keys(data.my_statuses || {}).length === 0) {
          list.innerHTML += '<p style="font-size:13px;color:var(--sub);">No active statuses.</p>';
          return;
        }
        for (var cat in data.my_statuses) {
          data.my_statuses[cat].forEach(function (s) {
            var wrap = document.createElement('div');
            wrap.className = 'my-status-item';
            wrap.setAttribute('data-status-id', s.status_id);

            var viewsNum = s.views_count || 0;

            var mediaUrls = (s.media_urls && s.media_urls.length) ? s.media_urls : (s.media_url ? [s.media_url] : []);
            var isVid     = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(mediaUrls[0] || '');

            if (mediaUrls.length > 1) {
              wrap.innerHTML = buildStatusGridHtml(mediaUrls);
            } else if (isVid) {
              wrap.innerHTML = '<video class="my-s-thumb" src="' + (mediaUrls[0] || '') + '" muted playsinline></video>';
            } else {
              wrap.innerHTML = '<img class="my-s-thumb" src="' + (mediaUrls[0] || '') + '" alt="">';
            }

            var infoDiv = document.createElement('div');
            infoDiv.className = 'my-s-info';
            infoDiv.onclick = function() { window.Asterix.status.openViews(s.status_id); };
            infoDiv.innerHTML = '<div class="cap">' + (s.caption || 'No caption') + '</div>' +
                                '<div class="views"><i class="fas fa-eye"></i> ' + viewsNum + ' views &bull; ' + s.expires_in_minutes + 'm left</div>';
            wrap.appendChild(infoDiv);

            var editBtn = document.createElement('button');
            editBtn.className = 'edit-s-btn';
            editBtn.title = s.event_id ? 'Manage Guests' : 'Edit caption';
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.onclick = function(e) {
              e.stopPropagation();
              if (s.event_id) {
                if (window.Asterix && window.Asterix.wedding && window.Asterix.wedding.openGuests) {
                  window.Asterix.wedding.openGuests(s.event_id);
                } else {
                  alert('Event management module not loaded.');
                }
              } else {
                window.Asterix.status.editMyStatus(s.status_id, s.caption || '');
              }
            };
            wrap.appendChild(editBtn);

            var delBtn = document.createElement('button');
            delBtn.className = 'del-s-btn';
            delBtn.innerHTML = '<i class="fas fa-trash"></i>';
            delBtn.onclick = function(e) {
              e.stopPropagation();
              window.Asterix.status.deleteMyStatus(s.status_id);
            };
            wrap.appendChild(delBtn);

            list.appendChild(wrap);
          });
        }
      })
      .catch(function () {
        dom.myStatusesList.innerHTML = '<p style="font-size:13px;color:var(--sub);">Could not load statuses.</p>';
      });
  }

  function deleteMyStatus(id) {
    showConfirm({ icon: '🗑️', title: 'Delete Status', body: 'Remove this status? It will disappear for everyone immediately.', okLabel: 'Delete', okClass: 'danger' })
      .then(function (ok) {
        if (!ok) return;
        API.deleteStatus(id).then(function () { loadMyStatuses(); }).catch(function () { toast('Error', 'Could not delete status.'); });
      });
  }

  function editMyStatus(id, currentCaption) {
    State.editStatusId = id;
    dom.editStatusCaption.value  = currentCaption || '';
    dom.editStatusMsg.textContent = '';
    dom.editStatusOverlay.classList.add('open');
    dom.editStatusCaption.focus();
  }

  function closeEditStatus() { dom.editStatusOverlay.classList.remove('open'); State.editStatusId = null; }

  function saveStatusEdit() {
    var id      = State.editStatusId;
    if (!id) return;
    var caption = dom.editStatusCaption.value.trim();
    var msgEl   = dom.editStatusMsg;
    var btn     = dom.editStatusSaveBtn;
    btn.disabled = true; btn.textContent = 'Saving…';
    API.editStatus(id, caption)
      .then(function (res) {
        if (res.ok) {
          msgEl.textContent = '✅ Updated!'; msgEl.className = 'modal-status ok';
          setTimeout(function () { closeEditStatus(); loadMyStatuses(); }, 700);
        } else {
          msgEl.textContent = res.data.error || 'Could not update.'; msgEl.className = 'modal-status err';
        }
      })
      .catch(function () { msgEl.textContent = 'Network error.'; msgEl.className = 'modal-status err'; })
      .finally(function () { btn.disabled = false; btn.textContent = 'Save'; });
  }

  function updateCategoryUI(cat) {
    dom.mktLinkWrap.style.display = (cat === 'Market') ? 'block' : 'none';
    if (dom.weddingHint) dom.weddingHint.style.display = (cat === 'Weddings') ? 'flex' : 'none';
    ensureCommerceSection();
    dom.commerceSection.style.display = (cat === 'Market') ? 'block' : 'none';
    updateUploadEmojis(cat);
  }

  function updateUploadEmojis(cat) {
    var row    = dom.emojiRow;
    var emojis = getEmojisForCategory(cat);
    row.innerHTML = emojis.map(function (e) {
      return '<span class="status-emoji-chip" title="Add ' + e + '">' + e + '</span>';
    }).join('');
    row.querySelectorAll('.status-emoji-chip').forEach(function (chip) {
      chip.onclick = function () {
        dom.captionInput.value += this.textContent;
        this.classList.add('active');
        setTimeout(function () { this.classList.remove('active'); }.bind(this), 400);
      };
    });
  }

  function ensureCommerceSection() {
    if (dom.commerceSection) return;
    var section = document.createElement('div');
    section.id = 'status-commerce-section';
    section.style.cssText = 'display:none;margin-bottom:10px;';
    section.innerHTML = [
      '<div style="font-size:11px;font-weight:700;color:var(--sub,#aaa);text-transform:uppercase;',
      'letter-spacing:.6px;margin-bottom:10px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.07);">',
      '  🛒 Listing details</div>',
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">',
      '  <span style="font-size:14px;font-weight:800;color:#e6a817;flex-shrink:0;">K</span>',
      '  <input id="sc-price" type="number" min="0" step="0.01" placeholder="Price (e.g. 250)"',
      '    style="flex:1;background:var(--input,rgba(255,255,255,0.06));border:1px solid rgba(255,255,255,0.12);',
      '    border-radius:8px;padding:8px 10px;color:var(--text,#fff);font-size:14px;outline:none;" />',
      '  <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--sub,#aaa);white-space:nowrap;cursor:pointer;">',
      '    <input id="sc-negotiable" type="checkbox" style="accent-color:#e6a817;" /> Negotiable',
      '  </label>',
      '</div>',
      '<select id="sc-product-cat"',
      '  style="width:100%;background:var(--input,rgba(255,255,255,0.06));border:1px solid rgba(255,255,255,0.12);',
      '  border-radius:8px;padding:8px 10px;color:var(--text,#fff);font-size:13px;margin-bottom:8px;outline:none;">',
      '  <option value="">Product category (optional)</option>',
      '  <option value="clothing">👗 Clothing</option>',
      '  <option value="shoes">👟 Shoes</option>',
      '  <option value="cosmetics">💄 Cosmetics</option>',
      '  <option value="bags">👜 Bags</option>',
      '  <option value="household">🏠 Household</option>',
      '  <option value="other">📦 Other</option>',
      '</select>',
      '<input id="sc-collection" type="text" placeholder="Collection point (e.g. Shoprite Kitwe)"',
      '  style="width:100%;box-sizing:border-box;background:var(--input,rgba(255,255,255,0.06));',
      '  border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px 10px;',
      '  color:var(--text,#fff);font-size:13px;margin-bottom:8px;outline:none;" />',
    ].join('');
    dom.uploadBtn.parentNode.insertBefore(section, dom.uploadBtn);
    dom.commerceSection = section;
  }

  function handleFileSelection() {
    var files = Array.prototype.slice.call(dom.fileInput.files || []);
    if (!files.length) return;
    if (files.length > MAX_STATUS_MEDIA) {
      toast('Too many files', 'Only the first ' + MAX_STATUS_MEDIA + ' will be used.');
      files = files.slice(0, MAX_STATUS_MEDIA);
    }
    uploadSelectedFiles = files;
    dom.uploadBtn.disabled = false;
    renderUploadPreview();
  }

  function renderUploadPreview() {
    ensureUploadMediaUI();
    var files = uploadSelectedFiles;
    if (!files.length) {
      dom.prevImg.style.display = 'none'; dom.prevVid.style.display = 'none';
      dom.uploadMultiGrid.style.display = 'none'; dom.uploadInfoRow.style.display = 'none';
      return;
    }
    if (files.length === 1) {
      dom.uploadMultiGrid.style.display = 'none';
      var f   = files[0];
      var url = URL.createObjectURL(f);
      if (f.type && f.type.indexOf('video/') === 0) {
        dom.prevVid.src = url; dom.prevVid.style.display = 'block'; dom.prevImg.style.display = 'none';
      } else {
        dom.prevImg.src = url; dom.prevImg.style.display = 'block'; dom.prevVid.style.display = 'none';
      }
    } else {
      dom.prevImg.style.display = 'none'; dom.prevVid.style.display = 'none';
      buildStatusUploadGrid(dom.uploadMultiGrid, files);
      dom.uploadMultiGrid.style.display = 'grid';
    }
    dom.uploadInfoRow.style.display = 'flex';
    var vids  = files.filter(function (f) { return f.type && f.type.indexOf('video/') === 0; }).length;
    var label = files.length + (files.length === 1 ? ' file' : ' files') + ' selected';
    if (vids) label += ' (' + vids + ' video' + (vids > 1 ? 's' : '') + ')';
    dom.uploadCountText.textContent = label;
  }

  function buildStatusUploadGrid(gridEl, files) {
    gridEl.innerHTML = '';
    gridEl.style.display              = 'grid';
    gridEl.style.gridTemplateColumns  = '1fr 1fr';
    var count = files.length;
    gridEl.style.gridTemplateRows = (count <= 2) ? '1fr' : '1fr 1fr';
    files.slice(0, 4).forEach(function (f, i) {
      var cell = document.createElement('div');
      cell.style.cssText = 'position:relative;background-size:cover;background-position:center;background-color:#000;';
      var isVideo = f.type && f.type.indexOf('video/') === 0;
      if (isVideo) {
        cell.innerHTML = '<i class="fas fa-play-circle" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;"></i>';
      } else {
        cell.style.backgroundImage = 'url(' + URL.createObjectURL(f) + ')';
      }
      if (count === 3 && i === 0) cell.style.gridRow = '1 / 3';
      if (i === 3 && count > 4) {
        var more = document.createElement('span');
        more.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.55);color:#fff;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center;';
        more.textContent = '+' + (count - 4);
        cell.appendChild(more);
      }
      gridEl.appendChild(cell);
    });
  }

  function ensureUploadMediaUI() {
    if (dom.uploadMultiGrid) return;
    var grid = document.createElement('div');
    grid.id = 'status-upload-multi-grid';
    grid.style.cssText = 'display:none;width:100%;height:160px;border-radius:8px;overflow:hidden;margin-bottom:8px;grid-gap:2px;background:#000;';
    dom.prevVid.insertAdjacentElement('afterend', grid);
    dom.uploadMultiGrid = grid;

    var infoRow = document.createElement('div');
    infoRow.id = 'status-upload-info-row';
    infoRow.style.cssText = 'display:none;align-items:center;justify-content:space-between;gap:10px;margin:-4px 0 10px;';
    var countText = document.createElement('span');
    countText.style.cssText = 'font-size:11px;color:var(--sub);';
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button'; clearBtn.textContent = 'Clear selection';
    clearBtn.style.cssText = 'background:none;border:none;color:#f15c6d;font-size:11px;cursor:pointer;text-decoration:underline;padding:0;';
    clearBtn.addEventListener('click', function (e) { e.stopPropagation(); clearUploadMedia(); dom.uploadBtn.disabled = true; });
    infoRow.appendChild(countText); infoRow.appendChild(clearBtn);
    grid.insertAdjacentElement('afterend', infoRow);
    dom.uploadInfoRow  = infoRow;
    dom.uploadCountText = countText;
  }

  function clearUploadMedia() {
    uploadSelectedFiles = []; dom.fileInput.value = '';
    dom.prevImg.src = ''; dom.prevVid.src = '';
    dom.prevImg.style.display = 'none'; dom.prevVid.style.display = 'none';
    if (dom.uploadMultiGrid) { dom.uploadMultiGrid.style.display = 'none'; dom.uploadMultiGrid.innerHTML = ''; }
    if (dom.uploadInfoRow)   dom.uploadInfoRow.style.display = 'none';
  }

  function _appendCommerceFields(fd) {
    if (dom.catSel.value !== 'Market') return;
    ensureCommerceSection();
    fd.append('is_commercial', 'true');
    var priceEl = document.getElementById('sc-price');
    var price   = priceEl ? priceEl.value.trim() : '';
    if (price && !isNaN(parseFloat(price))) fd.append('price', parseFloat(price).toFixed(2));
    var negEl = document.getElementById('sc-negotiable');
    fd.append('is_negotiable', negEl && negEl.checked ? 'true' : 'false');
    var pcEl = document.getElementById('sc-product-cat');
    if (pcEl && pcEl.value) fd.append('product_category', pcEl.value);
    var colEl = document.getElementById('sc-collection');
    if (colEl && colEl.value.trim()) fd.append('collection_point', colEl.value.trim());
    fd.append('availability', 'available');
  }

  function uploadStatus() {
    var files = uploadSelectedFiles.length ? uploadSelectedFiles : Array.prototype.slice.call(dom.fileInput.files || []);
    if (!files.length) return;
    dom.uploadBtn.disabled = true;
    dom.uploadMsg.textContent = 'Uploading ' + files.length + (files.length === 1 ? ' file…' : ' files…');
    var fd = new FormData();
    files.forEach(function (f) { fd.append('media', f); });
    fd.append('caption',     dom.captionInput.value.trim());
    fd.append('category',    dom.catSel.value);
    fd.append('market_link', dom.mktLinkInput.value.trim() || '');
    _appendCommerceFields(fd);
    API.uploadStatus(fd)
      .then(function (res) {
        if (res.ok) {
          var count = (res.data && res.data.media_count) || files.length;
          dom.uploadMsg.textContent = '✅ Status published! (' + count + (count === 1 ? ' file' : ' files') + ')';
          clearUploadMedia(); dom.captionInput.value = '';
          ['sc-price', 'sc-negotiable', 'sc-product-cat', 'sc-collection'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.type === 'checkbox' ? (el.checked = false) : (el.value = '');
          });
          setTimeout(function () { dom.uploadMsg.textContent = ''; }, 3000);
          loadMyStatuses();
        } else {
          dom.uploadMsg.textContent = '❌ ' + (res.data.error || 'Upload failed');
        }
      })
      .catch(function () { dom.uploadMsg.textContent = '❌ Upload failed'; })
      .finally(function () { dom.uploadBtn.disabled = uploadSelectedFiles.length === 0; });
  }

  function openViews(statusId) {
    var list  = dom.viewsList;
    var cacheKey = 'asterix_status_views_' + statusId;
    var cached = localStorage.getItem(cacheKey);

    dom.viewsPanel.style.display = 'block';

    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        renderViewsList(parsed);
      } catch(e) {}
    } else {
      list.innerHTML = '<p style="padding:20px;text-align:center;color:var(--sub);">Loading views...</p>';
    }

    fetch('/api/status/' + statusId + '/views/')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.error) {
          if (!cached) list.innerHTML = '<p style="padding:20px;text-align:center;color:var(--sub);">' + data.error + '</p>';
          return;
        }
        var views = data.views || [];
        localStorage.setItem(cacheKey, JSON.stringify(views));
        renderViewsList(views);
      }).catch(function() {
        if (!cached) list.innerHTML = '<p style="padding:20px;text-align:center;color:var(--sub);">Network error.</p>';
      });
  }

  function renderViewsList(views) {
    var list = dom.viewsList;
    if (!views.length) {
      list.innerHTML = '<p style="padding:20px;text-align:center;color:var(--sub);">No views yet.</p>';
      return;
    }

    list.innerHTML = views.map(function(v) {
      return '<div class="vp-viewer">' +
             '<img src="' + (v.profile_picture || '/static/images/default_profile_picture.webp') + '">' +
             '<div style="flex:1;padding-left:12px;">' +
             '<div style="font-size:14px;font-weight:600;color:var(--text);">' + v.username + '</div>' +
             '<div style="font-size:11px;color:var(--sub);margin-top:2px;">' + v.time_ago + '</div>' +
             '</div>' +
             '<i class="fas fa-eye" style="color:var(--sub);"></i>' +
             '</div>';
    }).join('');
  }

  function closeViews() { dom.viewsPanel.style.display = 'none'; }

  var publicAPI = {
    open:               openViewer,
    close:              closeViewer,
    show:               showStatus,
    showCategoryEnd:    showCategoryEnd,
    replayCategory:     replayCurrentCategory,
    shareCurrent:       shareCurrentStatus,
    openShareSheet:     openShareSheet,
    closeShareSheet:    closeShareSheet,
    sendStatusReply:    sendStatusReply,
    renderStatusEmojis: renderStatusEmojis,
    pauseViewer:        pauseViewer,
    resumeViewer:       resumeViewer,
    openMyStatus:       openMyStatus,
    closeMyStatus:      closeMyStatus,
    loadMyStatuses:     loadMyStatuses,
    deleteMyStatus:     deleteMyStatus,
    editMyStatus:       editMyStatus,
    closeEdit:          closeEditStatus,
    saveEdit:           saveStatusEdit,
    uploadStatus:       uploadStatus,
    updateCategoryUI:   updateCategoryUI,
    updateUploadEmojis: updateUploadEmojis,
    openViews:          openViews,
    closeViews:         closeViews,
    updateStatusBadges: updateStatusBadges,
  };

  if (!window.Asterix) window.Asterix = {};
  window.Asterix.status = publicAPI;

  window.openOfferModal         = openOfferModal;
  window.closeOfferModal        = closeOfferModal;
  window.submitOffer            = submitOffer;
  window.closeInterestSheet     = closeInterestSheet;
  window.openCounterOfferModal  = openCounterOfferModal;
  window.closeCounterOfferModal = closeCounterOfferModal;
  window.submitCounterOffer     = submitCounterOffer;
  window.openBuyModal           = openBuyModal;
  window.closeBuyModal          = closeBuyModal;
  window.submitBuyNow           = submitBuyNow;

  dom.openMyStatusBtn.addEventListener('click', openMyStatus);
  dom.closeMyStatusBtn.addEventListener('click', closeMyStatus);
  dom.myStatusOverlay.addEventListener('click', closeMyStatus);
  dom.catSel.addEventListener('change', function () { updateCategoryUI(this.value); });

  if (dom.weddingHint) {
    dom.weddingHint.addEventListener('click', function (e) {
      e.stopPropagation(); closeMyStatus();
      if (typeof openWeddingPanel === 'function') { setTimeout(openWeddingPanel, 300); }
      else {
        var overlay = document.getElementById('wedding-panel-overlay');
        var panel   = document.getElementById('wedding-panel');
        if (overlay) overlay.classList.add('open');
        if (panel)   panel.classList.add('open');
      }
    });
  }

  if (dom.fileInput) dom.fileInput.multiple = true;
  ensureUploadMediaUI();
  ensureCommerceSection();

  dom.dropZone.addEventListener('click', function (e) {
    if (dom.uploadInfoRow && dom.uploadInfoRow.contains(e.target)) return;
    dom.fileInput.click();
  });
  dom.dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dom.dropZone.style.borderColor = 'var(--accent)'; });
  dom.dropZone.addEventListener('dragleave', function () { dom.dropZone.style.borderColor = ''; });
  dom.dropZone.addEventListener('drop', function (e) {
    e.preventDefault(); dom.dropZone.style.borderColor = '';
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      dom.fileInput.files = e.dataTransfer.files;
      dom.fileInput.dispatchEvent(new Event('change'));
    }
  });
  dom.fileInput.addEventListener('change', handleFileSelection);
  dom.uploadBtn.addEventListener('click', uploadStatus);

  dom.svTapLeft.addEventListener('click', function () {
    dom.svCatEnd.classList.remove('show'); endScreenActive = false;
    if (viewer.idx > 0) showStatus(viewer.idx - 1);
  });
  dom.svTapRight.addEventListener('click', function () {
    if (endScreenActive) return;
    dom.svCatEnd.classList.remove('show');
    showStatus(viewer.idx + 1);
  });
  dom.svCloseBtn.addEventListener('click', closeViewer);
  dom.svShareBtn.addEventListener('click', shareCurrentStatus);
  dom.svShareClose.addEventListener('click', closeShareSheet);
  dom.svShareOverlay.addEventListener('click', function (e) { if (e.target === this) closeShareSheet(); });

  if (dom.svCatReplayBtn) {
    dom.svCatReplayBtn.addEventListener('click', function () { replayCurrentCategory(); });
  }

  setupReplyPause();

  dom.svReplySend.addEventListener('click', function () {
    var val = dom.svReplyInput.value.trim();
    if (val) { sendStatusReply(val); setTimeout(function () { if (viewer.isPaused) resumeViewer(); }, 500); }
  });
  dom.svReplyInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dom.svReplySend.click(); }
  });

  dom.shareWa.addEventListener('click', function () {
    closeShareSheet();
    var item = viewer.playlist[viewer.idx];
    if (!item) return;
    var shareUrl = window.location.origin + '/share/listing/' + item.status_id + '/';
    var text = (item.caption || 'Check out this listing on Fizzme! 🇿🇲') + '\n\n' + shareUrl;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  });

  dom.shareFb.addEventListener('click', function () {
    closeShareSheet();
    var item = viewer.playlist[viewer.idx];
    if (!item) return;
    var shareUrl = window.location.origin + '/share/listing/' + item.status_id + '/';
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl), '_blank');
  });

  dom.shareTk.addEventListener('click', function () {
    closeShareSheet();
    toast('TikTok', 'Save the media first, then upload it to TikTok manually.');
  });

  dom.closeViewsBtn.addEventListener('click', closeViews);
  dom.viewsPanel.addEventListener('click', function (e) { if (e.target === this) closeViews(); });
  dom.editStatusClose.addEventListener('click', closeEditStatus);
  dom.editStatusOverlay.addEventListener('click', function (e) { if (e.target === this) closeEditStatus(); });
  dom.editStatusSaveBtn.addEventListener('click', saveStatusEdit);

  document.addEventListener('click', function (e) {
    var cat = e.target.closest('.status-cat[data-category]');
    if (!cat) return;
    e.preventDefault();
    var category = cat.getAttribute('data-category');
    if (category) openViewer(category);
  });

  updateCategoryUI(dom.catSel.value);

  setTimeout(updateStatusBadges, 2000);
  setInterval(updateStatusBadges, 60000);

  flushOfflineViews();

  console.log('[Fizzme] Status module loaded (caching + real view count + offline view queue)');
})();