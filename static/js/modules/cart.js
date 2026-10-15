// ============================================================
// cart.js — Multi-item basket for chat
//
// Fixes vs previous version:
//   1. toggle() actually removes an item on uncheck (previous
//      version only ever called add(), so unchecking a listing
//      never took it out of the basket).
//   2. The basket button is created by this module itself — no
//      dependency on a pre-existing #cart-btn in the template,
//      which is why the basket had no way to open before.
//   3. Floating button is appended to document.body (fixed
//      position) so it survives conversation switches, since
//      chat-header's innerHTML gets wiped on every loadMessages().
//   4. [NEW] selectedMedia is preserved from status viewer through
//      to cart storage and shown as the thumbnail in the cart modal.
//      Priority: selectedMedia.url → _latest_reply_media → media_url.
// ============================================================

(function() {
  'use strict';

  var CART_STORAGE_KEY = 'asterix_cart';
  var cartItems = [];

  // ── Persistence ──────────────────────────────────────────────
  function loadCart() {
    try {
      var raw = localStorage.getItem(CART_STORAGE_KEY);
      cartItems = raw ? JSON.parse(raw) : [];
    } catch (e) {
      cartItems = [];
    }
    cartItems = cartItems.filter(function(item) {
      return item.status_id && item.username && item.price !== undefined;
    });
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (e) { /* ignore quota errors */ }
    updateFab();
    renderCartModal(); // no-op if modal not open/doesn't exist yet
  }

  // ── Core operations ──────────────────────────────────────────
  function isInCart(statusId) {
    return cartItems.some(function(item) { return item.status_id === statusId; });
  }

  function addItem(status) {
    if (!status || !status.status_id || !status.username || status.price === undefined) {
      console.warn('[Cart] Invalid item:', status);
      return false;
    }
    if (isInCart(status.status_id)) return true; // already there — no-op, not an error

    // ── FIX 4: resolve the best thumbnail URL at add-time and store it.
    // Priority: the photo the buyer explicitly selected in the status viewer
    // → the most-recently seen reply_media URL from chat messages
    // → the listing's default media_url.
    var resolvedThumbUrl = (status.selectedMedia && status.selectedMedia.url)
      || status._latest_reply_media
      || status.media_url
      || '';

    cartItems.push({
      status_id:            status.status_id,
      username:             status.username,
      caption:              status.caption             || 'Listing',
      price:                parseFloat(status.price)  || 0,
      media_url:            status.media_url           || '',
      // Store the selected photo object so we can surface photo-N-of-M labels
      selectedMedia:        status.selectedMedia       || null,
      // Cache the best thumb so renderCartModal never has to re-derive it
      _resolved_thumb:      resolvedThumbUrl,
      _latest_reply_media:  status._latest_reply_media || '',
    });
    saveCart();
    toast('🧺 Added to basket', status.caption || 'Item');
    return true;
  }

  function removeItem(statusId) {
    var idx = cartItems.findIndex(function(item) { return item.status_id === statusId; });
    if (idx === -1) return false;
    cartItems.splice(idx, 1);
    saveCart();
    return true;
  }

  // The one function the UI should actually call from a checkbox/tap —
  // adds if absent, removes if present, and reports which happened so
  // the caller can sync a checkbox's checked state.
  function toggleItem(status) {
    if (!status || !status.status_id) return null;
    if (isInCart(status.status_id)) {
      removeItem(status.status_id);
      return 'removed';
    }
    addItem(status);
    return 'added';
  }

  function clearCart() {
    cartItems = [];
    saveCart();
    toast('Basket cleared', 'All items removed.');
  }

  function getItems()  { return cartItems.slice(); }
  function getTotal()  { return cartItems.reduce(function(s, i) { return s + (i.price || 0); }, 0); }
  function getCount()  { return cartItems.length; }
  function getSellers() {
    var seen = {};
    cartItems.forEach(function(i) { seen[i.username] = true; });
    return Object.keys(seen);
  }

  // ── Floating basket button (self-injected — no template dependency) ──
  var fabEl = null;

  function ensureFab() {
    if (fabEl) return fabEl;
    fabEl = document.createElement('button');
    fabEl.id = 'fz-cart-fab';
    fabEl.type = 'button';
    fabEl.setAttribute('aria-label', 'Open basket');
    fabEl.style.cssText = [
      'position:fixed;right:18px;bottom:84px;z-index:24000;',
      'width:52px;height:52px;border-radius:50%;',
      'background:linear-gradient(135deg,#e6a817,#c98a00);',
      'border:2px solid rgba(255,255,255,.2);',
      'box-shadow:0 4px 16px rgba(0,0,0,.4);',
      'display:none;align-items:center;justify-content:center;',
      'cursor:pointer;-webkit-tap-highlight-color:transparent;',
    ].join('');
    fabEl.innerHTML =
      '<span style="font-size:20px;">🧺</span>' +
      '<span id="fz-cart-fab-badge" style="' +
        'position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;' +
        'border-radius:10px;background:#25d366;color:#000;font-size:11px;' +
        'font-weight:800;display:flex;align-items:center;justify-content:center;' +
        'padding:0 5px;box-shadow:0 0 0 2px #141616;">0</span>';
    fabEl.style.position = 'fixed';
    fabEl.onclick = openCartModal;
    document.body.appendChild(fabEl);
    return fabEl;
  }

  function updateFab() {
    var fab = ensureFab();
    var count = getCount();
    var badge = fab.querySelector('#fz-cart-fab-badge');
    if (badge) badge.textContent = count;
    fab.style.display = count > 0 ? 'flex' : 'none';
  }

  // ── Cart Modal ─────────────────────────────────────────────────
  function openCartModal() {
    if (!document.getElementById('cart-modal-overlay')) createCartModal();
    document.getElementById('cart-modal-overlay').classList.add('open');
    renderCartModal();
  }

  function closeCartModal() {
    var overlay = document.getElementById('cart-modal-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function renderCartModal() {
    var container = document.getElementById('cart-items-container');
    if (!container) return; // modal not built/open yet — fine, saveCart() calls this defensively

    var items = getItems();
    if (!items.length) {
      container.innerHTML = '<div style="text-align:center;color:var(--sub);padding:20px 0;">Your basket is empty.</div>';
      document.getElementById('cart-total').textContent = 'K 0.00';
      document.getElementById('cart-checkout-btn').disabled = true;
      document.getElementById('cart-count-badge').textContent = '0';
      return;
    }

    var html = items.map(function(item) {
      var price = 'K' + parseFloat(item.price).toLocaleString('en-ZM', { minimumFractionDigits: 2 });

      // ── FIX 4: use the pre-resolved thumbnail stored at add-time.
      // This means the photo the buyer chose in the status viewer shows
      // here instead of always the listing's default first photo.
      var thumbUrl    = item._resolved_thumb || item.media_url || '';
      var fallbackUrl = item.media_url || '';

      var safeUrl      = String(thumbUrl    || '').replace(/'/g, '%27').replace(/"/g, '%22');
      var safeFallback = String(fallbackUrl || '').replace(/'/g, '%27').replace(/"/g, '%22');

      if (thumbUrl) {
        console.log('[Cart] thumb for', item.caption, '=', thumbUrl);
      } else {
        console.warn('[Cart] no thumb URL for', item.caption);
      }

      // Show a photo-N-of-M label when a specific photo was selected
      var photoLabel = '';
      if (item.selectedMedia && item.selectedMedia.url && item.selectedMedia.index !== undefined) {
        photoLabel = '<div style="font-size:10px;color:#e6a817;font-weight:700;margin-top:2px;">📸 Photo ' +
          (item.selectedMedia.index + 1) +
          (item.selectedMedia.total ? ' of ' + item.selectedMedia.total : '') +
          ' selected</div>';
      }

      var thumbHtml = thumbUrl
        ? '<img class="cart-thumb" src="' + safeUrl + '" '
          + 'data-fallback="' + safeFallback + '" '
          + 'style="width:44px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0;">'
        : '<div style="width:44px;height:44px;background:var(--mid);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px;">🏷️</div>';

      return [
        '<div class="cart-item-row" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">',
        thumbHtml,
        '<div style="flex:1;min-width:0;">',
        '  <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + item.caption + '</div>',
        '  <div style="font-size:11px;color:var(--sub);">' + item.username + ' · ' + price + '</div>',
        photoLabel,
        '</div>',
        '<button class="cart-remove-btn" data-status-id="' + item.status_id + '" style="background:none;border:none;color:#f15c6d;font-size:16px;cursor:pointer;padding:4px 8px;">✕</button>',
        '</div>',
      ].join('');
    }).join('');

    container.innerHTML = html;

    // Wire thumb fallback: primary → fallback → icon
    container.querySelectorAll('img.cart-thumb').forEach(function(img) {
      function _fail() {
        var fb = img.getAttribute('data-fallback');
        if (fb && img.getAttribute('data-used-fb') !== '1') {
          console.warn('[Cart] primary thumb failed, retrying fallback:', fb);
          img.setAttribute('data-used-fb', '1');
          img.src = fb;
          return;
        }
        console.warn('[Cart] all thumb URLs failed:', img.src);
        var ph = document.createElement('div');
        ph.style.cssText = 'width:44px;height:44px;background:var(--mid);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;';
        ph.textContent = '🏷️';
        img.replaceWith(ph);
      }
      img.addEventListener('error', _fail);
      if (img.complete && img.naturalWidth === 0) _fail();
    });

    container.querySelectorAll('.cart-remove-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = parseInt(this.dataset.statusId, 10);
        if (id) {
          removeItem(id);
          // let chat.js know a checkbox needs to flip back off
          document.dispatchEvent(new CustomEvent('fz-cart-changed', { detail: { statusId: id, action: 'removed' } }));
        }
      });
    });

    document.getElementById('cart-total').textContent = 'K ' + getTotal().toLocaleString('en-ZM', { minimumFractionDigits: 2 });
    document.getElementById('cart-checkout-btn').disabled = false;
    document.getElementById('cart-count-badge').textContent = String(getCount());
  }

  function createCartModal() {
    var overlay = document.createElement('div');
    overlay.id = 'cart-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.onclick = function(e) { if (e.target === this) closeCartModal(); };

    var modal = document.createElement('div');
    modal.className = 'modal-card';
    modal.style.width = '400px';
    modal.style.maxWidth = '96vw';
    modal.style.maxHeight = '80vh';
    modal.innerHTML = [
      '<div class="modal-header" style="background:linear-gradient(135deg,#e6a817,#c98a00);">',
      '  <i class="fas fa-shopping-basket" style="color:#000;"></i>',
      '  <h3 style="color:#000;">Your Basket (<span id="cart-count-badge">0</span>)</h3>',
      '  <button class="modal-close" id="cart-modal-close">&times;</button>',
      '</div>',
      '<div class="modal-body" style="overflow-y:auto;flex:1;">',
      '  <div id="cart-items-container" style="min-height:60px;"></div>',
      '  <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid rgba(255,255,255,0.08);margin-top:8px;">',
      '    <span style="font-size:14px;font-weight:700;">Total</span>',
      '    <span id="cart-total" style="font-size:18px;font-weight:900;color:#e6a817;">K 0.00</span>',
      '  </div>',
      '  <div class="modal-actions" style="gap:8px;">',
      '    <button class="modal-btn secondary" id="cart-clear-btn" style="flex:1;">Clear Basket</button>',
      '    <button class="modal-btn primary" id="cart-checkout-btn" style="flex:2;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;" disabled>Checkout</button>',
      '  </div>',
      '</div>',
    ].join('');

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('cart-modal-close').onclick = closeCartModal;

    document.getElementById('cart-clear-btn').addEventListener('click', function() {
      if (!getCount()) return;
      if (confirm('Remove all items from your basket?')) {
        clearCart();
        document.dispatchEvent(new CustomEvent('fz-cart-changed', { detail: { action: 'cleared' } }));
      }
    });

    document.getElementById('cart-checkout-btn').addEventListener('click', function() {
      var items = getItems();
      if (!items.length) return;
      var sellers = getSellers();
      if (sellers.length > 1) {
        toast('One seller at a time', 'Deals are per-seller — clear items from other sellers first.');
        return;
      }
      closeCartModal();
      if (window.Asterix && window.Asterix.checkout) {
        var statuses = items.map(function(item) {
          return {
            status_id:    item.status_id,
            username:     item.username,
            caption:      item.caption,
            price:        item.price,
            media_url:    item.media_url,
            // ── FIX 4: pass the selected photo through to checkout
            selectedMedia: item.selectedMedia || null,
          };
        });
        window.Asterix.checkout.openMulti(statuses, function(step) {
          if (step === 'completed') {
            clearCart();
            document.dispatchEvent(new CustomEvent('fz-cart-changed', { detail: { action: 'cleared' } }));
          }
        });
      } else {
        toast('Error', 'Checkout module not available — make sure checkout.js is loaded before cart.js and chat.js.');
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    loadCart();
    ensureFab();
    updateFab();
  }

  window.Asterix = window.Asterix || {};
  window.Asterix.cart = {
    add:        addItem,
    remove:     removeItem,
    toggle:     toggleItem,
    isInCart:   isInCart,
    clear:      clearCart,
    getItems:   getItems,
    getTotal:   getTotal,
    getCount:   getCount,
    getSellers: getSellers,
    open:       openCartModal,
    close:      closeCartModal,
    render:     renderCartModal,
    init:       init,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Fizzme] Cart module loaded — self-contained basket FAB + toggle fix + selectedMedia thumbnail');
})();