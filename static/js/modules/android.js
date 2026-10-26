// ============================================================
// android.js — Android WebView bridge handlers:
//              contacts sync, notifications, share, deep links,
//              ringtone sync, phone contacts display
// ============================================================

// ── Audio Unlock ───────────────────────────────────────────────────
function unlockAudio() {
  if (State.audioUnlocked) return;
  State.audioUnlocked = true;
  var s = document.getElementById('notif-snd');
  s.muted = true;
  s.play().then(function() {
    s.pause(); s.currentTime = 0; s.muted = false;
  }).catch(function() { s.muted = false; });
}
document.body.addEventListener('click', unlockAudio, { once: true });
document.body.addEventListener('click', function() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}, { once: true });

// ── Notification Sound ─────────────────────────────────────────────
function playNotifSound() {
  if (!State.audioUnlocked || State.notificationsMuted) return;
  var s = document.getElementById('notif-snd');
  s.currentTime = 0;
  s.play().catch(function() {});
  var tog = document.getElementById('tog-vibrate');
  if (navigator.vibrate && (!tog || tog.checked)) navigator.vibrate([100, 50, 100]);
}

document.getElementById('ua-toggle-sound').onclick = function() {
  State.notificationsMuted = !State.notificationsMuted;
  document.getElementById('ua-sound-text').textContent =
    State.notificationsMuted ? 'Unmute Notifications' : 'Mute Notifications';
  document.querySelector('#ua-toggle-sound i').className =
    State.notificationsMuted ? 'fas fa-bell-slash' : 'fas fa-bell';
  toast('Settings', State.notificationsMuted ? 'Notifications silenced.' : 'Notifications unmuted.');
};

// ── Android Contact Sync (background, to server only) ────────────────
window.syncAndroidContacts = async function() {
  // Syncs phone numbers to the server for Asterix membership lookup.
  // Does NOT display contacts on screen — that only happens via openContactsModal().
  try {
    if (window.AndroidBridge && window.AndroidBridge.syncPhoneContacts) {
      window.AndroidBridge.syncPhoneContacts();
      return true;
    }
    return false;
  } catch(e) { console.warn('Android contact sync failed:', e); return false; }
};

// ── Android Notification Handler ───────────────────────────────────
window.handleAndroidNotification = function(data) {
  try {
    var payload = typeof data === 'string' ? JSON.parse(data) : data;
    var sender  = payload.sender || payload.username || 'Someone';
    var message = payload.message || 'New message';
    playNotifSound();
    toast('💬 ' + sender, message);
    if (sender !== State.activeRecipient) {
      var badge = document.getElementById('unread-' + sender);
      if (badge) {
        var current = parseInt(badge.textContent) || 0;
        badge.textContent = current + 1;
        badge.classList.remove('hide');
        badge.classList.add('show', 'pop');
        setTimeout(function() { badge.classList.remove('pop'); }, 400);
      }
    }
  } catch(e) { console.warn('Notification handler error:', e); }
};

// ── Android Share Handler ──────────────────────────────────────────
window.handleAndroidShare = async function(data) {
  try {
    var payload = typeof data === 'string' ? JSON.parse(data) : data;
    var text    = payload.text  || '';
    var url     = payload.url   || '';
    var mediaUri = payload.mediaUri || payload.mediaUrl || false;
    if (!State.activeRecipient) { toast('No chat', 'Open a chat first before sharing.'); return; }
    var fd = new FormData();
    fd.append('recipient', State.activeRecipient);
    fd.append('message', text + (url ? '\n' + url : ''));
    if (mediaUri) {
      try {
        var response = await fetch(mediaUri);
        var blob = await response.blob();
        var ext  = blob.type.split('/')[1] || 'file';
        fd.append('files', blob, 'shared.' + ext);
      } catch(e) { console.warn('Could not fetch shared media:', e); }
    }
    var res = await API.sendMessage(fd);
    if (res.data.status === 'success') {
      toast('Shared', 'Content sent to chat.');
      await loadMessages(State.activeRecipient);
    } else { toast('Error', res.data.message || 'Could not send shared content.'); }
  } catch(e) { console.error('Android share handler error:', e); toast('Error', 'Could not process shared content.'); }
};

// ── Deep Link Handler ─────────────────────────────────────────────
window.handleDeepLink = function(uri) {
  try {
    var url = new URL(uri);
    if (url.protocol === 'asterix:') {
      var path = url.pathname.substring(1);
      if (path.startsWith('chat/')) {
        var username = path.substring(5);
        var item = document.querySelector('.conversation-item[data-recipient="' + CSS.escape(username) + '"]');
        if (item) { item.click(); return; }
        toast('Contact', 'Looking for ' + username + '...');
        API.getContactInfo(username).then(function(res) {
          if (res.data.username) {
            addConversationItem(res.data);
            var newItem = document.querySelector('.conversation-item[data-recipient="' + CSS.escape(username) + '"]');
            if (newItem) newItem.click();
          } else { toast('Not found', 'User ' + username + ' not found.'); }
        }).catch(function() { toast('Error', 'Could not find that user.'); });
      }
    }
  } catch(e) { console.warn('Deep link error:', e); }
};

// ── Ringtone Sync from Android ────────────────────────────────────
function syncRingtoneFromAndroid() {
  if (!window.AndroidBridge || !window.AndroidBridge.getRingtone) return;
  try {
    var ringtoneData = window.AndroidBridge.getRingtone();
    if (ringtoneData) {
      document.getElementById('notif-snd').src = ringtoneData;
      document.getElementById('ringtone-label').textContent = 'Custom (Android)';
      localStorage.setItem('asterix_ringtone', ringtoneData);
      toast('Ringtone', 'Synced from device! 🎵');
    }
  } catch(e) { console.warn('Ringtone sync failed:', e); }
}

// ── displayPhoneContacts() has been removed ────────────────────────
// Phone contacts are now only shown via the modal (openContactsModal).
// The Android bridge still provides getPhoneContactsWithDetails() etc.