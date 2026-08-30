// ============================================================
// settings.js — Settings modal, background themes, font size,
//               ringtone upload, toggle persistence
// ============================================================

// ── Default background pattern (village scene) ────────────────────
var DEFAULT_BG_PATTERN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cdefs%3E%3Cstyle%3E.s%7Bfill:none;stroke:%23163347;stroke-linecap:round;stroke-linejoin:round%7D.sf%7Bfill:%23163347%7D%3C/style%3E%3C/defs%3E%3C!-- hut 1 --%3E%3Cellipse cx='30' cy='72' rx='18' ry='4' fill='%23112a3a'/%3E%3Crect x='14' y='60' width='32' height='14' rx='2' class='sf'/%3E%3Cpolygon points='10,62 30,42 50,62' fill='%231a3d52'/%3E%3Cellipse cx='30' cy='62' rx='20' ry='3' fill='%231e4a62'/%3E%3Cline x1='20' y1='62' x2='20' y2='74' class='s' stroke-width='1'/%3E%3Cline x1='30' y1='62' x2='30' y2='74' class='s' stroke-width='1'/%3E%3Cline x1='40' y1='62' x2='40' y2='74' class='s' stroke-width='1'/%3E%3Crect x='25' y='67' width='10' height='8' rx='1' fill='%230d2233'/%3E%3C!-- hut 2 small --%3E%3Cellipse cx='160' cy='52' rx='12' ry='3' fill='%23112a3a'/%3E%3Crect x='150' y='44' width='20' height='10' rx='2' class='sf'/%3E%3Cpolygon points='147,46 160,30 173,46' fill='%231a3d52'/%3E%3Cellipse cx='160' cy='46' rx='13' ry='2.5' fill='%231e4a62'/%3E%3Cline x1='154' y1='46' x2='154' y2='54' class='s' stroke-width='1'/%3E%3Cline x1='160' y1='46' x2='160' y2='54' class='s' stroke-width='1'/%3E%3Cline x1='166' y1='46' x2='166' y2='54' class='s' stroke-width='1'/%3E%3C!-- drummer figure 1 --%3E%3Ccircle cx='80' cy='100' r='6' fill='%231e4a62'/%3E%3Crect x='77' y='106' width='6' height='14' rx='3' fill='%231a3d52'/%3E%3Cline x1='77' y1='110' x2='70' y2='116' class='s' stroke-width='1.5'/%3E%3Cline x1='83' y1='110' x2='90' y2='116' class='s' stroke-width='1.5'/%3E%3Cline x1='79' y1='120' x2='75' y2='132' class='s' stroke-width='1.5'/%3E%3Cline x1='83' y1='120' x2='87' y2='132' class='s' stroke-width='1.5'/%3E%3C!-- drum under drummer 1 --%3E%3Cellipse cx='90' cy='122' rx='7' ry='3' fill='%23163347'/%3E%3Crect x='83' y='118' width='14' height='10' rx='2' fill='%231a3d52'/%3E%3Cellipse cx='90' cy='118' rx='7' ry='2.5' fill='%231e4a62'/%3E%3C!-- drummer figure 2 --%3E%3Ccircle cx='130' cy='110' r='6' fill='%231e4a62'/%3E%3Crect x='127' y='116' width='6' height='14' rx='3' fill='%231a3d52'/%3E%3Cline x1='127' y1='120' x2='120' y2='126' class='s' stroke-width='1.5'/%3E%3Cline x1='133' y1='120' x2='140' y2='126' class='s' stroke-width='1.5'/%3E%3Cline x1='129' y1='130' x2='125' y2='142' class='s' stroke-width='1.5'/%3E%3Cline x1='133' y1='130' x2='137' y2='142' class='s' stroke-width='1.5'/%3E%3C!-- drum standalone --%3E%3Cellipse cx='55' cy='150' rx='9' ry='3.5' fill='%23163347'/%3E%3Crect x='46' y='144' width='18' height='12' rx='3' fill='%231a3d52'/%3E%3Cellipse cx='55' cy='144' rx='9' ry='3' fill='%231e4a62'/%3E%3C!-- acacia tree 1 --%3E%3Cline x1='170' y1='170' x2='170' y2='140' class='s' stroke-width='2'/%3E%3Cellipse cx='158' cy='135' rx='14' ry='6' fill='%23163347'/%3E%3Cellipse cx='172' cy='130' rx='16' ry='7' fill='%231a3d52'/%3E%3Cellipse cx='183' cy='136' rx='12' ry='5' fill='%23163347'/%3E%3C!-- acacia tree 2 small --%3E%3Cline x1='40' cy='170' x2='40' y2='155' class='s' stroke-width='1.5'/%3E%3Cellipse cx='32' cy='152' rx='10' ry='4' fill='%23163347'/%3E%3Cellipse cx='42' cy='149' rx='11' ry='5' fill='%231a3d52'/%3E%3Cellipse cx='50' cy='153' rx='8' ry='3.5' fill='%23163347'/%3E%3C!-- leaf scatter --%3E%3Cellipse cx='100' cy='170' rx='4' ry='2' fill='%23163347' transform='rotate(-20,100,170)'/%3E%3Cellipse cx='145' cy='80' rx='3' ry='1.5' fill='%23163347' transform='rotate(15,145,80)'/%3E%3Cellipse cx='60' cy='40' rx='3' ry='1.5' fill='%23163347' transform='rotate(-30,60,40)'/%3E%3C!-- drumstick --%3E%3Cline x1='95' y1='115' x2='103' y2='110' class='s' stroke-width='1.5'/%3E%3Ccircle cx='103' cy='109' r='2' fill='%231e4a62'/%3E%3C/svg%3E\")";

// ── Open / Close ───────────────────────────────────────────────────
document.getElementById('ua-settings').onclick = openSettings;
function openSettings() {
  document.getElementById('settings-modal-overlay').classList.add('open');
  document.getElementById('user-actions-context-menu').style.display = 'none';
  renderBgThumbs();
}
function closeSettings() {
  document.getElementById('settings-modal-overlay').classList.remove('open');
}

// ── Background Theme Panel ─────────────────────────────────────────
function toggleBgPanel() {
  var panel = document.getElementById('bg-theme-panel');
  var chevron = document.getElementById('bg-chevron');
  if (!panel) return;
  var isOpen = panel.classList.toggle('open');
  panel.style.display = isOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : '';
  if (isOpen) renderBgThumbs();
}

var BG_THEMES = [
  {
    id: 'default',
    label: 'Default',
    draw: function(ctx, w, h) {
      ctx.fillStyle = '#0a1929';
      ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'dark_green',
    label: 'Forest',
    draw: function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#0d2b0d'); g.addColorStop(1, '#0a1a0a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'navy',
    label: 'Night Sky',
    draw: function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#050a1a'); g.addColorStop(1, '#0a1535');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    draw: function(ctx, w, h) {
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'warm_dark',
    label: 'Warm Dark',
    draw: function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#1a1208'); g.addColorStop(1, '#0f0b04');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'purple_dark',
    label: 'Midnight',
    draw: function(ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#120820'); g.addColorStop(1, '#0a0510');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }
];

var _currentBgId = localStorage.getItem('asterix_bg') || 'default';

// ── applyBackground to chat area ──────────────────────────────────
function applyBackground(theme) {
  var area = document.getElementById('chat-area');
  var box  = document.getElementById('id_chat_item_container');
  if (!box) {
    console.warn('[settings] #id_chat_item_container not found');
    return;
  }

  // Clear area background to avoid conflicts
  if (area) {
    area.style.background = 'none';
    area.style.backgroundColor = '';
    area.style.backgroundImage = '';
    area.style.backgroundSize = '';
  }

  // Helper to apply background with !important
  function setBackground(el, value, size, repeat, color) {
    if (!el) return;
    el.style.setProperty('background-image', value, 'important');
    if (size) el.style.setProperty('background-size', size, 'important');
    if (repeat) el.style.setProperty('background-repeat', repeat, 'important');
    if (color) el.style.setProperty('background-color', color, 'important');
  }

  // Custom image
  if (!theme) {
    var customUrl = localStorage.getItem('asterix_bg_custom');
    if (customUrl) {
      setBackground(box, 'url(' + customUrl + ')', 'cover', 'no-repeat', '#0a1929');
      document.getElementById('current-bg-label').textContent = 'Custom image';
    }
    return;
  }

  // Default theme – use SVG pattern
  if (theme.id === 'default') {
    setBackground(box, DEFAULT_BG_PATTERN, '200px 200px', 'repeat', '#0a1929');
    document.getElementById('current-bg-label').textContent = 'Default pattern';
    _currentBgId = 'default';
    localStorage.setItem('asterix_bg', 'default');
    document.querySelectorAll('.bg-thumb').forEach(function(t) {
      t.classList.toggle('active', t.dataset.bgId === 'default');
    });
    return;
  }

  // Other themes: draw to canvas
  var cvs = document.createElement('canvas');
  cvs.width = 200;
  cvs.height = 200;
  var ctx = cvs.getContext('2d');
  theme.draw(ctx, 200, 200);
  var dataUrl = cvs.toDataURL();

  setBackground(box, 'url(' + dataUrl + ')', 'auto', 'repeat', '#0a1929');

  document.getElementById('current-bg-label').textContent = theme.label;
  _currentBgId = theme.id;
  localStorage.setItem('asterix_bg', theme.id);

  document.querySelectorAll('.bg-thumb').forEach(function(t) {
    t.classList.toggle('active', t.dataset.bgId === theme.id);
  });
}

function renderBgThumbs() {
  var grid = document.getElementById('bg-theme-grid');
  if (!grid) {
    console.warn('[settings] #bg-theme-grid not found');
    return;
  }
  if (grid.children.length > 0) {
    document.querySelectorAll('.bg-thumb').forEach(function(t) {
      t.classList.toggle('active', t.dataset.bgId === _currentBgId);
    });
    return;
  }
  console.log('[settings] Rendering background themes');
  BG_THEMES.forEach(function(theme) {
    var thumb  = document.createElement('div');
    thumb.className = 'bg-thumb' + (theme.id === _currentBgId ? ' active' : '');
    thumb.dataset.bgId = theme.id;
    var cvs = document.createElement('canvas');
    var ctx = cvs.getContext('2d');
    theme.draw(ctx, cvs.width || 160, cvs.height || 100);
    var label = document.createElement('div');
    label.className = 'bg-thumb-label';
    label.textContent = theme.label;
    thumb.appendChild(cvs);
    thumb.appendChild(label);
    thumb.onclick = function() { applyBackground(theme); };
    grid.appendChild(thumb);
  });
}

document.getElementById('bg-custom-input').addEventListener('change', function() {
  if (!this.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    localStorage.setItem('asterix_bg_custom', e.target.result);
    localStorage.setItem('asterix_bg', 'custom');
    _currentBgId = 'custom';
    applyBackground(null);
    document.querySelectorAll('.bg-thumb').forEach(function(t) { t.classList.remove('active'); });
  };
  reader.readAsDataURL(this.files[0]);
});

// ── Restore saved background on page load ────────────────────────
(function restoreBg() {
  if (_currentBgId === 'custom') {
    applyBackground(null);
  } else {
    var saved = BG_THEMES.find(function(t) { return t.id === _currentBgId; });
    if (saved) applyBackground(saved);
    else applyBackground(BG_THEMES[0]);
  }
})();

// ── Font Size ──────────────────────────────────────────────────────
var _fontSize = parseInt(localStorage.getItem('asterix_font_size')) || 14;
(function restoreFont() {
  var box = document.getElementById('id_chat_item_container');
  if (box) box.style.fontSize = _fontSize + 'px';
  document.getElementById('font-size-label').textContent = 'Current (' + _fontSize + 'px)';
})();

function changeFontSize(delta) {
  _fontSize = Math.max(11, Math.min(20, _fontSize + delta));
  var box = document.getElementById('id_chat_item_container');
  if (box) box.style.fontSize = _fontSize + 'px';
  document.getElementById('font-size-label').textContent = 'Current (' + _fontSize + 'px)';
  localStorage.setItem('asterix_font_size', _fontSize);
}

// ── Compact Messages ───────────────────────────────────────────────
var compactTog = document.getElementById('tog-compact');
if (compactTog) {
  compactTog.addEventListener('change', function() {
    var box = document.getElementById('id_chat_item_container');
    if (box) box.classList.toggle('compact', this.checked);
    localStorage.setItem('asterix_compact', this.checked ? '1' : '0');
  });
  (function restoreCompact() {
    var c = localStorage.getItem('asterix_compact') === '1';
    compactTog.checked = c;
    if (c) {
      var box = document.getElementById('id_chat_item_container');
      if (box) box.classList.add('compact');
    }
  })();
}

// ── Ringtone Upload ────────────────────────────────────────────────
document.getElementById('ringtone-input').addEventListener('change', function() {
  if (!this.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('notif-snd').src = e.target.result;
    document.getElementById('ringtone-label').textContent = 'Custom';
    localStorage.setItem('asterix_ringtone', e.target.result);
    toast('Ringtone', 'Custom notification sound saved.');
  };
  reader.readAsDataURL(this.files[0]);
});

(function restoreRingtone() {
  var saved = localStorage.getItem('asterix_ringtone');
  if (saved) {
    document.getElementById('notif-snd').src = saved;
    document.getElementById('ringtone-label').textContent = 'Custom';
  }
})();

// ── Message Notifications toggle ──────────────────────────────────
var togNotifs = document.getElementById('tog-notifs');
if (togNotifs) {
  var notifs = localStorage.getItem('asterix_notifs') !== 'false';
  togNotifs.checked = notifs;
  State.notificationsMuted = !notifs;

  togNotifs.addEventListener('change', function() {
    var enabled = this.checked;
    State.notificationsMuted = !enabled;
    localStorage.setItem('asterix_notifs', String(enabled));
    var textEl = document.getElementById('ua-sound-text');
    if (textEl) textEl.textContent = enabled ? 'Mute Notifications' : 'Unmute Notifications';
    var icon = document.querySelector('#ua-toggle-sound i');
    if (icon) icon.className = enabled ? 'fas fa-bell' : 'fas fa-bell-slash';

    // ── PWA push wiring (NEW — the only functional change in this file) ──
    // Turning the toggle on requests OS notification permission and creates
    // a push subscription (no-ops safely if PWABridge isn't loaded or VAPID
    // isn't configured). Turning it off tears the subscription down so the
    // backend stops sending — and stops retrying — pushes to this device.
    if (window.PWABridge) {
      if (enabled) {
        window.PWABridge.enablePushNotifications();
      } else {
        window.PWABridge.unsubscribeFromPush();
      }
    }

    toast('Notifications', enabled ? 'Notifications on' : 'Notifications off');
  });
}

// ── Read Receipts toggle ──────────────────────────────────────────
var togRead = document.getElementById('tog-read-receipts');
if (togRead) {
  var readReceipts = localStorage.getItem('asterix_read_receipts') !== 'false';
  togRead.checked = readReceipts;
  togRead.addEventListener('change', function() {
    localStorage.setItem('asterix_read_receipts', String(this.checked));
    toast('Read Receipts', this.checked ? 'On' : 'Off');
  });
}

// ── Hide Online Status toggle ─────────────────────────────────────
var togHide = document.getElementById('tog-hide-online');
if (togHide) {
  var hideOnline = localStorage.getItem('asterix_hide_online') === 'true';
  togHide.checked = hideOnline;
  togHide.addEventListener('change', function() {
    var hide = this.checked;
    localStorage.setItem('asterix_hide_online', String(hide));
    var event = new CustomEvent('settingsChanged', {
      detail: { setting: 'hide_online', value: hide }
    });
    document.dispatchEvent(event);
    toast('Privacy', hide ? 'Online status hidden' : 'Online status visible');
  });
}

// ── Settings modal ────────────────────────────────────────────────
var settingsOverlay = document.getElementById('settings-modal-overlay');
var settingsCloseBtn = document.querySelector('#settings-modal .settings-close');

function openSettings() {
  if (settingsOverlay) settingsOverlay.classList.add('open');
}

function closeSettings() {
  if (settingsOverlay) settingsOverlay.classList.remove('open');
}

if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener('click', closeSettings);
}
if (settingsOverlay) {
  settingsOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeSettings();
  });
}

window.Asterix = window.Asterix || {};
window.Asterix.settings = {
  open: openSettings,
  close: closeSettings,
  toggleBgPanel: toggleBgPanel,
  changeFontSize: changeFontSize,
  applyBackground: applyBackground,
  renderBgThumbs: renderBgThumbs,
};

console.log('[Asterix] Settings module loaded (background fully fixed, push wiring added)');