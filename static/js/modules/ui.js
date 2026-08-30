// ============================================================
// ui.js — Complete UI actions, context menu, settings, modals
// ============================================================

(function() {
  'use strict';

  // ── Spinner overlay ──────────────────────────────────────────────
  function showSpinner(message) {
    var existing = document.getElementById('spinner-overlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'spinner-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;flex-direction:column;gap:16px;';
    overlay.innerHTML =
      '<div style="width:48px;height:48px;border:4px solid #25d366;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div>' +
      '<div style="color:#fff;font-size:16px;font-weight:600;">' + (message || 'Processing…') + '</div>';
    if (!document.getElementById('spinner-style')) {
      var style = document.createElement('style');
      style.id = 'spinner-style';
      style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
    document.body.appendChild(overlay);
  }

  function hideSpinner() {
    var overlay = document.getElementById('spinner-overlay');
    if (overlay) overlay.remove();
  }

  // ── CSRF helper ──────────────────────────────────────────────────────
  function getCsrf() {
    var cookie = document.cookie.split('; ').find(function(r) { return r.startsWith('csrftoken='); });
    return cookie ? cookie.split('=')[1] : (window.ASTERIX && window.ASTERIX.CSRF) || '';
  }

  // ── DOM refs ─────────────────────────────────────────────────────────
  var contextMenu = document.getElementById('user-actions-context-menu');
  var gearBtn = document.getElementById('gear-btn');
  var gearSidebarBtn = document.getElementById('gear-sidebar-btn');

  // ── Helpers ──────────────────────────────────────────────────────────
  function getActiveRecipient() {
    return State.activeRecipient || null;
  }

  // ── Context menu open/close ────────────────────────────────────────
  function openActionsMenu(anchorEl) {
    if (!contextMenu) return;
    contextMenu.style.display = 'block';
    var rect = anchorEl.getBoundingClientRect();
    contextMenu.style.top = (rect.bottom + 4) + 'px';
    contextMenu.style.right = (window.innerWidth - rect.right) + 'px';
    contextMenu.style.left = 'auto';
  }

  function closeActionsMenu() {
    if (contextMenu) contextMenu.style.display = 'none';
  }

  // Wire gear buttons
  if (gearBtn) {
    gearBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      openActionsMenu(e.currentTarget);
    });
  }
  if (gearSidebarBtn) {
    gearSidebarBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      openActionsMenu(e.currentTarget);
    });
  }

  document.addEventListener('click', function(e) {
    if (contextMenu && !contextMenu.contains(e.target)) {
      closeActionsMenu();
    }
  });

  // ── Toast ────────────────────────────────────────────────────────────
  if (typeof toast !== 'function') {
    window.toast = function(title, body) {
      var el = document.getElementById('toast');
      if (!el) return;
      document.getElementById('toast-title').textContent = title;
      document.getElementById('toast-body').textContent = body;
      el.classList.add('show');
      clearTimeout(window._toastT);
      window._toastT = setTimeout(function() { el.classList.remove('show'); }, 4000);
    };
  }

  // ── Global modal resolvers ─────────────────────────────────────────
  window._confirmResolve = function(val) {
    var modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.remove('open');
    if (window._confirmPromiseResolve) {
      window._confirmPromiseResolve(val);
      window._confirmPromiseResolve = null;
    }
  };

  window._alertResolve = function() {
    var modal = document.getElementById('alert-modal');
    if (modal) modal.classList.remove('open');
    if (window._alertPromiseResolve) {
      window._alertPromiseResolve();
      window._alertPromiseResolve = null;
    }
  };

  // ── showConfirm / showAlert ────────────────────────────────────────
  if (typeof showConfirm !== 'function') {
    window.showConfirm = function(options) {
      return new Promise(function(resolve) {
        window._confirmPromiseResolve = resolve;
        var icon = options.icon || '⚠️';
        var title = options.title || 'Are you sure?';
        var body = options.body || '';
        var okLabel = options.okLabel || 'Confirm';
        var okClass = options.okClass || 'danger';
        document.getElementById('confirm-icon').textContent = icon;
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-body').textContent = body;
        var btn = document.getElementById('confirm-ok-btn');
        btn.textContent = okLabel;
        btn.className = 'modal-btn ' + okClass;
        document.getElementById('confirm-modal').classList.add('open');
      });
    };
  }

  if (typeof showAlert !== 'function') {
    window.showAlert = function(options) {
      return new Promise(function(resolve) {
        window._alertPromiseResolve = resolve;
        var icon = options.icon || 'ℹ️';
        var title = options.title || 'Notice';
        var body = options.body || '';
        document.getElementById('alert-icon').textContent = icon;
        document.getElementById('alert-title').textContent = title;
        document.getElementById('alert-body').textContent = body;
        document.getElementById('alert-modal').classList.add('open');
      });
    };
  }

  // ── Status viewer close ────────────────────────────────────────────
  window.svClose = function() {
    if (window.Asterix && window.Asterix.status && typeof window.Asterix.status.close === 'function') {
      window.Asterix.status.close();
    } else {
      var modal = document.getElementById('status-viewer-modal');
      if (modal) modal.classList.remove('open');
      var vid = document.getElementById('sv-vid');
      if (vid) vid.pause();
      var img = document.getElementById('sv-img');
      if (img) img.src = '';
    }
  };

  // ── SAVE PROFILE USERNAME ──────────────────────────────────────────
  async function saveProfileUsername() {
    var newName = document.getElementById('pp-edit-username').value.trim();
    var statusEl = document.getElementById('pp-save-status');
    var btn = document.getElementById('pp-save-btn');
    if (!newName) {
      statusEl.textContent = 'Name cannot be empty.';
      statusEl.className = 'modal-status err';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Saving…';
    showSpinner('Saving profile…');
    try {
      var res = await API.updateUsername(newName);
      hideSpinner();
      if (res.ok && res.data.status === 'success') {
        statusEl.textContent = '✅ Saved!';
        statusEl.className = 'modal-status ok';
        document.getElementById('pp-modal-username').textContent = newName;
        setTimeout(function() {
          document.getElementById('profile-modal-overlay').classList.remove('open');
          document.getElementById('profile-modal-overlay').style.display = 'none';
        }, 900);
      } else {
        statusEl.textContent = res.data.message || 'Could not save.';
        statusEl.className = 'modal-status err';
      }
    } catch (e) {
      hideSpinner();
      statusEl.textContent = 'Network error.';
      statusEl.className = 'modal-status err';
    }
    finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  }

  // ── CLEAR CHAT (delegates to chat module) ──────────────────────────
  function clearChat() {
    console.log('[ui] clearChat called');
    if (window.Asterix && window.Asterix.chat && typeof window.Asterix.chat.clearChat === 'function') {
      window.Asterix.chat.clearChat();
    } else {
      console.warn('[ui] chat.clearChat not available, cannot clear chat.');
      toast('Error', 'Clear chat not available.');
    }
  }

  // ── BLOCK USER ──────────────────────────────────────────────────────
  async function blockUser() {
    console.log('[ui] blockUser called');
    var recipient = State.activeRecipient || getActiveRecipient();
    if (!recipient) { toast('No chat', 'Open a conversation first.'); return; }
    var ok = await showConfirm({
      icon: '🚫',
      title: 'Block ' + recipient + '?',
      body: 'They won\'t be able to message you and will be removed from your contacts.',
      okLabel: 'Block',
      okClass: 'danger'
    });
    if (!ok) {
      console.log('[ui] blockUser cancelled');
      return;
    }

    showSpinner('Blocking ' + recipient + '…');
    try {
      var res = await API.blockUser(recipient);
      hideSpinner();
      console.log('[ui] blockUser response:', res);
      if (res.ok) {
        document.querySelectorAll('.conversation-item[data-recipient="' + recipient + '"]').forEach(function(el) { el.remove(); });
        document.getElementById('id_chat_item_container').innerHTML = '';
        document.getElementById('chat-header-info').innerHTML = '<div class="no-chat-hint">Select a conversation to start chatting</div>';
        document.getElementById('chat-header-avatar').style.display = 'none';
        document.getElementById('gear-btn').style.display = 'none';
        State.activeRecipient = null;
        toast('✅', res.data.message || 'User blocked.');
      } else {
        var errMsg = res.data?.error || res.data?.message || res.text || 'Could not block user.';
        toast('Error', errMsg + ' (status ' + res.status + ')');
      }
    } catch (e) {
      hideSpinner();
      console.error('[ui] blockUser error:', e);
      toast('Error', 'Failed to block user: ' + (e.message || 'unknown error'));
    }
  }

  // ── REMOVE CONTACT ──────────────────────────────────────────────────
  async function removeContact() {
    console.log('[ui] removeContact called');
    var recipient = State.activeRecipient || getActiveRecipient();
    if (!recipient) { toast('No chat', 'Open a conversation first.'); return; }
    var ok = await showConfirm({
      icon: '👤',
      title: 'Remove Contact',
      body: 'Remove ' + recipient + ' from your contact list? Your message history is kept.',
      okLabel: 'Remove',
      okClass: 'danger'
    });
    if (!ok) {
      console.log('[ui] removeContact cancelled');
      return;
    }

    showSpinner('Removing contact…');
    try {
      var res = await API.removeContact(recipient);
      hideSpinner();
      console.log('[ui] removeContact response:', res);
      if (res.ok) {
        document.querySelectorAll('.conversation-item[data-recipient="' + recipient + '"]').forEach(function(el) { el.remove(); });
        document.getElementById('id_chat_item_container').innerHTML = '';
        document.getElementById('chat-header-info').innerHTML = '<div class="no-chat-hint">Select a conversation to start chatting</div>';
        document.getElementById('chat-header-avatar').style.display = 'none';
        document.getElementById('gear-btn').style.display = 'none';
        State.activeRecipient = null;
        toast('✅', res.data.message || 'Contact removed.');
      } else {
        var errMsg = res.data?.error || res.data?.message || res.text || 'Could not remove contact.';
        toast('Error', errMsg + ' (status ' + res.status + ')');
      }
    } catch (e) {
      hideSpinner();
      console.error('[ui] removeContact error:', e);
      toast('Error', 'Failed to remove contact: ' + (e.message || 'unknown error'));
    }
  }

  // ── TOGGLE NOTIFICATIONS ────────────────────────────────────────────
  function toggleNotifications() {
    State.notificationsMuted = !State.notificationsMuted;
    var textEl = document.getElementById('ua-sound-text');
    if (textEl) {
      textEl.textContent = State.notificationsMuted ? 'Unmute Notifications' : 'Mute Notifications';
    }
    var icon = document.querySelector('#ua-toggle-sound i');
    if (icon) {
      icon.className = State.notificationsMuted ? 'fas fa-bell-slash' : 'fas fa-bell';
    }
    toast('Settings', State.notificationsMuted ? 'Notifications silenced.' : 'Notifications unmuted.');
  }

  // ── PROFILE MODAL ──────────────────────────────────────────────────
  function openProfileModal() {
    var el = document.getElementById('profile-modal-overlay');
    if (el) {
      el.classList.add('open');
      el.style.display = 'flex';
    }
  }

  // ── PARTNERS MODAL ──────────────────────────────────────────────────
  function openPartnersModal() {
    var el = document.getElementById('partners-modal-overlay');
    if (el) {
      el.classList.add('open');
      el.style.display = 'flex';
    }
  }

  // ── SETTINGS MODAL ──────────────────────────────────────────────────
  function openSettings() {
    var overlay = document.getElementById('settings-modal-overlay');
    if (overlay) overlay.classList.add('open');
    loadSettingsUI();
  }

  function closeSettings() {
    var overlay = document.getElementById('settings-modal-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  // ── Settings UI load/save ───────────────────────────────────────────
  function loadSettingsUI() {
    try {
      var bg = localStorage.getItem('asterix_bg') || 'default';
      var fontSize = parseInt(localStorage.getItem('asterix_font_size')) || 14;
      var compact = localStorage.getItem('asterix_compact') === 'true';
      var notifs = localStorage.getItem('asterix_notifs') !== 'false';
      var vibrate = localStorage.getItem('asterix_vibrate') !== 'false';
      var readReceipts = localStorage.getItem('asterix_read_receipts') !== 'false';
      var hideOnline = localStorage.getItem('asterix_hide_online') === 'true';

      var togNotifs = document.getElementById('tog-notifs');
      if (togNotifs) togNotifs.checked = notifs;
      var togVibrate = document.getElementById('tog-vibrate');
      if (togVibrate) togVibrate.checked = vibrate;
      var togRead = document.getElementById('tog-read-receipts');
      if (togRead) togRead.checked = readReceipts;
      var togHide = document.getElementById('tog-hide-online');
      if (togHide) togHide.checked = hideOnline;
      var togCompact = document.getElementById('tog-compact');
      if (togCompact) togCompact.checked = compact;

      var label = document.getElementById('font-size-label');
      if (label) label.textContent = fontSize + 'px';
      applyFontSize(fontSize);
      applyCompact(compact);

      applyBackground(bg);
      var bgLabel = document.getElementById('current-bg-label');
      if (bgLabel) {
        var bgNames = { default: 'Default pattern', dark: 'Dark solid', light: 'Light solid', green: 'Green gradient' };
        bgLabel.textContent = bgNames[bg] || 'Custom';
      }
    } catch (e) { /* ignore */ }
  }

  function saveSettings() {
    try {
      var notifs = document.getElementById('tog-notifs')?.checked ?? true;
      var vibrate = document.getElementById('tog-vibrate')?.checked ?? true;
      var readReceipts = document.getElementById('tog-read-receipts')?.checked ?? true;
      var hideOnline = document.getElementById('tog-hide-online')?.checked ?? false;
      var compact = document.getElementById('tog-compact')?.checked ?? false;

      localStorage.setItem('asterix_notifs', String(notifs));
      localStorage.setItem('asterix_vibrate', String(vibrate));
      localStorage.setItem('asterix_read_receipts', String(readReceipts));
      localStorage.setItem('asterix_hide_online', String(hideOnline));
      localStorage.setItem('asterix_compact', String(compact));
      applyCompact(compact);
      toast('Settings', 'Preferences saved.');
    } catch (e) { /* ignore */ }
  }

  // ── Background themes ──────────────────────────────────────────────
  var BG_THEMES = {
    default: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'%3E%3Cdefs%3E%3Cstyle%3E.s%7Bfill:none;stroke:%23163347;stroke-linecap:round;stroke-linejoin:round%7D.sf%7Bfill:%23163347%7D%3C/style%3E%3C/defs%3E%3C!-- hut 1 --%3E%3Cellipse cx=\'30\' cy=\'72\' rx=\'18\' ry=\'4\' fill=\'%23112a3a\'/%3E%3Crect x=\'14\' y=\'60\' width=\'32\' height=\'14\' rx=\'2\' class=\'sf\'/%3E%3Cpolygon points=\'10,62 30,42 50,62\' fill=\'%231a3d52\'/%3E%3Cellipse cx=\'30\' cy=\'62\' rx=\'20\' ry=\'3\' fill=\'%231e4a62\'/%3E%3Cline x1=\'20\' y1=\'62\' x2=\'20\' y2=\'74\' class=\'s\' stroke-width=\'1\'/%3E%3Cline x1=\'30\' y1=\'62\' x2=\'30\' y2=\'74\' class=\'s\' stroke-width=\'1\'/%3E%3Cline x1=\'40\' y1=\'62\' x2=\'40\' y2=\'74\' class=\'s\' stroke-width=\'1\'/%3E%3Crect x=\'25\' y=\'67\' width=\'10\' height=\'8\' rx=\'1\' fill=\'%230d2233\'/%3E%3C!-- hut 2 small --%3E%3Cellipse cx=\'160\' cy=\'52\' rx=\'12\' ry=\'3\' fill=\'%23112a3a\'/%3E%3Crect x=\'150\' y=\'44\' width=\'20\' height=\'10\' rx=\'2\' class=\'sf\'/%3E%3Cpolygon points=\'147,46 160,30 173,46\' fill=\'%231a3d52\'/%3E%3Cellipse cx=\'160\' cy=\'46\' rx=\'13\' ry=\'2.5\' fill=\'%231e4a62\'/%3E%3Cline x1=\'154\' y1=\'46\' x2=\'154\' y2=\'54\' class=\'s\' stroke-width=\'1\'/%3E%3Cline x1=\'160\' y1=\'46\' x2=\'160\' y2=\'54\' class=\'s\' stroke-width=\'1\'/%3E%3Cline x1=\'166\' y1=\'46\' x2=\'166\' y2=\'54\' class=\'s\' stroke-width=\'1\'/%3E%3C!-- drummer figure 1 --%3E%3Ccircle cx=\'80\' cy=\'100\' r=\'6\' fill=\'%231e4a62\'/%3E%3Crect x=\'77\' y=\'106\' width=\'6\' height=\'14\' rx=\'3\' fill=\'%231a3d52\'/%3E%3Cline x1=\'77\' y1=\'110\' x2=\'70\' y2=\'116\' class=\'s\' stroke-width=\'1.5\'/%3E%3Cline x1=\'83\' y1=\'110\' x2=\'90\' y2=\'116\' class=\'s\' stroke-width=\'1.5\'/%3E%3Cline x1=\'79\' y1=\'120\' x2=\'75\' y2=\'132\' class=\'s\' stroke-width=\'1.5\'/%3E%3Cline x1=\'83\' y1=\'120\' x2=\'87\' y2=\'132\' class=\'s\' stroke-width=\'1.5\'/%3E%3C!-- drum under drummer 1 --%3E%3Cellipse cx=\'90\' cy=\'122\' rx=\'7\' ry=\'3\' fill=\'%23163347\'/%3E%3Crect x=\'83\' y=\'118\' width=\'14\' height=\'10\' rx=\'2\' fill=\'%231a3d52\'/%3E%3Cellipse cx=\'90\' cy=\'118\' rx=\'7\' ry=\'2.5\' fill=\'%231e4a62\'/%3E%3C!-- drummer figure 2 --%3E%3Ccircle cx=\'130\' cy=\'110\' r=\'6\' fill=\'%231e4a62\'/%3E%3Crect x=\'127\' y=\'116\' width=\'6\' height=\'14\' rx=\'3\' fill=\'%231a3d52\'/%3E%3Cline x1=\'127\' y1=\'120\' x2=\'120\' y2=\'126\' class=\'s\' stroke-width=\'1.5\'/%3E%3Cline x1=\'133\' y1=\'120\' x2=\'140\' y2=\'126\' class=\'s\' stroke-width=\'1.5\'/%3E%3Cline x1=\'129\' y1=\'130\' x2=\'125\' y2=\'142\' class=\'s\' stroke-width=\'1.5\'/%3E%3Cline x1=\'133\' y1=\'130\' x2=\'137\' y2=\'142\' class=\'s\' stroke-width=\'1.5\'/%3E%3C!-- drum standalone --%3E%3Cellipse cx=\'55\' cy=\'150\' rx=\'9\' ry=\'3.5\' fill=\'%23163347\'/%3E%3Crect x=\'46\' y=\'144\' width=\'18\' height=\'12\' rx=\'3\' fill=\'%231a3d52\'/%3E%3Cellipse cx=\'55\' cy=\'144\' rx=\'9\' ry=\'3\' fill=\'%231e4a62\'/%3E%3C!-- acacia tree 1 --%3E%3Cline x1=\'170\' y1=\'170\' x2=\'170\' y2=\'140\' class=\'s\' stroke-width=\'2\'/%3E%3Cellipse cx=\'158\' cy=\'135\' rx=\'14\' ry=\'6\' fill=\'%23163347\'/%3E%3Cellipse cx=\'172\' cy=\'130\' rx=\'16\' ry=\'7\' fill=\'%231a3d52\'/%3E%3Cellipse cx=\'183\' cy=\'136\' rx=\'12\' ry=\'5\' fill=\'%23163347\'/%3E%3C!-- acacia tree 2 small --%3E%3Cline x1=\'40\' cy=\'170\' x2=\'40\' y2=\'155\' class=\'s\' stroke-width=\'1.5\'/%3E%3Cellipse cx=\'32\' cy=\'152\' rx=\'10\' ry=\'4\' fill=\'%23163347\'/%3E%3Cellipse cx=\'42\' cy=\'149\' rx=\'11\' ry=\'5\' fill=\'%231a3d52\'/%3E%3Cellipse cx=\'50\' cy=\'153\' rx=\'8\' ry=\'3.5\' fill=\'%23163347\'/%3E%3C!-- leaf scatter --%3E%3Cellipse cx=\'100\' cy=\'170\' rx=\'4\' ry=\'2\' fill=\'%23163347\' transform=\'rotate(-20,100,170)\'/%3E%3Cellipse cx=\'145\' cy=\'80\' rx=\'3\' ry=\'1.5\' fill=\'%23163347\' transform=\'rotate(15,145,80)\'/%3E%3Cellipse cx=\'60\' cy=\'40\' rx=\'3\' ry=\'1.5\' fill=\'%23163347\' transform=\'rotate(-30,60,40)\'/%3E%3C!-- drumstick --%3E%3Cline x1=\'95\' y1=\'115\' x2=\'103\' y2=\'110\' class=\'s\' stroke-width=\'1.5\'/%3E%3Ccircle cx=\'103\' cy=\'109\' r=\'2\' fill=\'%231e4a62\'/%3E%3C/svg%3E")',
    dark: '#0a1929',
    light: '#e8edee',
    green: 'linear-gradient(135deg, #0a1929, #128c7e)',
  };

  function applyBackground(theme) {
    var area = document.getElementById('chat-area');
    if (!area) return;
    area.style.background = 'none';
    area.style.backgroundColor = '';
    area.style.backgroundImage = '';
    area.style.backgroundRepeat = '';
    area.style.backgroundSize = '';

    if (theme === 'default') {
      area.style.backgroundImage = BG_THEMES.default;
      area.style.backgroundColor = '#0a1929';
      area.style.backgroundRepeat = 'repeat';
      area.style.backgroundSize = '200px 200px';
    } else {
      area.style.backgroundColor = BG_THEMES[theme] || '#0a1929';
    }
    localStorage.setItem('asterix_bg', theme);
    var bgLabel = document.getElementById('current-bg-label');
    if (bgLabel) {
      var names = { default: 'Default pattern', dark: 'Dark solid', light: 'Light solid', green: 'Green gradient' };
      bgLabel.textContent = names[theme] || 'Custom';
    }
  }

  function renderBgThumbs() {
    var grid = document.getElementById('bg-theme-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var themes = ['default', 'dark', 'light', 'green'];
    var labels = ['Default', 'Dark', 'Light', 'Green'];
    var current = localStorage.getItem('asterix_bg') || 'default';
    themes.forEach(function(t, i) {
      var div = document.createElement('div');
      div.className = 'bg-thumb' + (t === current ? ' active' : '');
      div.setAttribute('data-theme', t);
      div.innerHTML = '<div style="width:100%;height:100%;background:' + (BG_THEMES[t] || '#0a1929') + ';border-radius:8px;"></div>' +
        '<div class="bg-thumb-label">' + labels[i] + '</div>';
      div.addEventListener('click', function() {
        applyBackground(t);
        document.querySelectorAll('.bg-thumb').forEach(function(el) { el.classList.remove('active'); });
        this.classList.add('active');
      });
      grid.appendChild(div);
    });
  }

  function toggleBgPanel() {
    var panel = document.getElementById('bg-theme-panel');
    if (panel) {
      panel.classList.toggle('open');
      var chevron = document.getElementById('bg-chevron');
      if (chevron) chevron.className = panel.classList.contains('open') ? 'fas fa-chevron-up sr-arrow' : 'fas fa-chevron-down sr-arrow';
      if (panel.classList.contains('open')) renderBgThumbs();
    }
  }

  // ── Font size ──────────────────────────────────────────────────────
  function applyFontSize(size) {
    document.documentElement.style.fontSize = size + 'px';
    localStorage.setItem('asterix_font_size', String(size));
    var label = document.getElementById('font-size-label');
    if (label) label.textContent = size + 'px';
  }

  function changeFontSize(delta) {
    var current = parseInt(localStorage.getItem('asterix_font_size')) || 14;
    var newSize = Math.min(Math.max(current + delta, 10), 24);
    applyFontSize(newSize);
    toast('Font size', newSize + 'px');
  }

  // ── Compact messages ──────────────────────────────────────────────
  function applyCompact(enabled) {
    var container = document.getElementById('id_chat_item_container');
    if (container) {
      container.style.gap = enabled ? '1px' : '3px';
    }
    var bubbles = document.querySelectorAll('.msg-bubble');
    bubbles.forEach(function(b) {
      b.style.padding = enabled ? '4px 8px 3px' : '7px 12px 5px';
    });
    localStorage.setItem('asterix_compact', String(enabled));
  }

  // ── Ringtone upload ──────────────────────────────────────────────
  function handleRingtoneUpload(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var data = e.target.result;
      var snd = document.getElementById('notif-snd');
      if (snd) {
        snd.src = data;
        var label = document.getElementById('ringtone-label');
        if (label) label.textContent = 'Custom (' + file.name + ')';
        localStorage.setItem('asterix_ringtone', data);
        toast('Ringtone', 'Updated!');
      }
    };
    reader.readAsDataURL(file);
  }

  // ── Restore ringtone from localStorage ──────────────────────────
  function restoreRingtone() {
    try {
      var data = localStorage.getItem('asterix_ringtone');
      if (data) {
        var snd = document.getElementById('notif-snd');
        if (snd) snd.src = data;
        var label = document.getElementById('ringtone-label');
        if (label) label.textContent = 'Custom';
      }
    } catch (e) { /* ignore */ }
  }

  // ── Profile picture upload ────────────────────────────────────────
  function wireProfilePictureUpload() {
    var input = document.getElementById('profile-pic-input');
    if (!input) {
      console.warn('[ui] #profile-pic-input not found');
      return;
    }
    input.addEventListener('change', function() {
      if (!this.files[0]) return;
      var fd = new FormData();
      fd.append('profile_picture', this.files[0]);
      showSpinner('Uploading picture…');
      fetch('/api/upload-profile-picture/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrf() },
        body: fd
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        hideSpinner();
        if (d.profile_picture_url) {
          document.getElementById('my-avatar').src = d.profile_picture_url;
          document.getElementById('profile-modal-img').src = d.profile_picture_url;
          toast('✅', 'Profile picture updated.');
        } else {
          toast('Error', d.error || 'Upload failed.');
        }
      })
      .catch(function() {
        hideSpinner();
        toast('Error', 'Picture upload failed.');
      });
    });
  }

  // ── Wire profile camera button ──────────────────────────────────
  function wireProfileCameraButton() {
    var overlay = document.getElementById('profile-modal-overlay');
    if (!overlay) return;
    overlay.addEventListener('click', function(e) {
      var target = e.target.closest('#btn-change-pic');
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        var input = document.getElementById('profile-pic-input');
        if (input) input.click();
        else console.warn('[ui] #profile-pic-input not found');
      }
    });
  }

  // ── Wire context menu items ──────────────────────────────────────
  function wireContextMenu() {
    var items = {
      'ua-clear': clearChat,
      'ua-block': blockUser,
      'ua-remove-contact': removeContact,
      'ua-toggle-sound': toggleNotifications,
      'ua-profile-modal-btn': openProfileModal,
      'ua-partners-modal-btn': openPartnersModal,
      'ua-settings': openSettings,
    };

    Object.keys(items).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', function(e) {
          e.stopPropagation();
          closeActionsMenu();
          items[id]();
        });
      } else {
        console.warn('[ui] Menu item #' + id + ' not found');
      }
    });

    var logoutBtn = document.getElementById('ua-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeActionsMenu();
      });
    }
  }

  // ── Wire settings modal controls ─────────────────────────────────
  function wireSettingsControls() {
    var closeBtn = document.querySelector('#settings-modal-overlay .settings-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);
    var overlay = document.getElementById('settings-modal-overlay');
    if (overlay) overlay.addEventListener('click', function(e) {
      if (e.target === this) closeSettings();
    });

    var bgRow = document.querySelector('.settings-row .sr-icon.teal')?.closest('.settings-row');
    if (bgRow) bgRow.addEventListener('click', toggleBgPanel);

    var bgCustomInput = document.getElementById('bg-custom-input');
    if (bgCustomInput) {
      bgCustomInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          var dataUrl = ev.target.result;
          var area = document.getElementById('chat-area');
          if (area) {
            area.style.backgroundImage = 'url(' + dataUrl + ')';
            area.style.backgroundColor = 'transparent';
            area.style.backgroundRepeat = 'repeat';
            area.style.backgroundSize = 'cover';
            localStorage.setItem('asterix_bg', 'custom');
            var label = document.getElementById('current-bg-label');
            if (label) label.textContent = 'Custom image';
            toast('Background', 'Updated!');
          }
        };
        reader.readAsDataURL(file);
      });
    }

    var minusBtn = document.querySelector('[onclick*="changeFontSize(-1)"]');
    var plusBtn = document.querySelector('[onclick*="changeFontSize(1)"]');
    if (minusBtn) {
      minusBtn.removeAttribute('onclick');
      minusBtn.addEventListener('click', function(e) { e.stopPropagation(); changeFontSize(-1); });
    }
    if (plusBtn) {
      plusBtn.removeAttribute('onclick');
      plusBtn.addEventListener('click', function(e) { e.stopPropagation(); changeFontSize(1); });
    }

    var ringtoneInput = document.getElementById('ringtone-input');
    if (ringtoneInput) {
      ringtoneInput.addEventListener('change', function() {
        if (this.files[0]) handleRingtoneUpload(this.files[0]);
      });
    }

    document.querySelectorAll('#settings-modal-overlay .settings-toggle input').forEach(function(input) {
      input.addEventListener('change', saveSettings);
    });

    var compactTog = document.getElementById('tog-compact');
    if (compactTog) {
      compactTog.addEventListener('change', function() {
        applyCompact(this.checked);
        saveSettings();
      });
    }

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.attributeName === 'class' && m.target.classList.contains('open')) {
          loadSettingsUI();
        }
      });
    });
    if (overlay) observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  // ── Expose public API ──────────────────────────────────────────────
  window.Asterix = window.Asterix || {};
  window.Asterix.ui = {
    openSettings: openSettings,
    closeSettings: closeSettings,
    toggleBgPanel: toggleBgPanel,
    changeFontSize: changeFontSize,
    applyBackground: applyBackground,
    applyCompact: applyCompact,
    renderBgThumbs: renderBgThumbs,
    loadSettingsUI: loadSettingsUI,
    saveSettings: saveSettings,
    clearChat: clearChat,
    blockUser: blockUser,
    removeContact: removeContact,
    toggleNotifications: toggleNotifications,
    openProfileModal: openProfileModal,
    openPartnersModal: openPartnersModal,
    openActionsMenu: openActionsMenu,
    closeActionsMenu: closeActionsMenu,
    saveProfileUsername: saveProfileUsername,
    showSpinner: showSpinner,
    hideSpinner: hideSpinner,
    _confirmResolve: window._confirmResolve,
    _alertResolve: window._alertResolve,
  };

  // ── ALIAS: settings namespace ──────────────────────────────────────
  window.Asterix.settings = {
    open: openSettings,
    close: closeSettings,
    toggleBgPanel: toggleBgPanel,
    changeFontSize: changeFontSize,
    applyBackground: applyBackground,
    applyCompact: applyCompact,
    renderBgThumbs: renderBgThumbs,
    loadSettingsUI: loadSettingsUI,
    saveSettings: saveSettings,
  };

  // ── Init ────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    wireContextMenu();
    wireSettingsControls();
    wireProfilePictureUpload();
    wireProfileCameraButton();
    restoreRingtone();

    var bg = localStorage.getItem('asterix_bg') || 'default';
    applyBackground(bg);
    var fontSize = parseInt(localStorage.getItem('asterix_font_size')) || 14;
    applyFontSize(fontSize);
    var compact = localStorage.getItem('asterix_compact') === 'true';
    applyCompact(compact);

    var ringLabel = document.getElementById('ringtone-label');
    if (ringLabel && localStorage.getItem('asterix_ringtone')) {
      ringLabel.textContent = 'Custom';
    }
  });

  console.log('[Asterix] UI module loaded (all actions + clear chat delegated)');
})();