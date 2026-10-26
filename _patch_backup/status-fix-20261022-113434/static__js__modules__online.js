// ============================================================
// online.js — Online status ping + sidebar green dots
// (fz-status-fix-v1)
// ============================================================

(function() {
  'use strict';

  var PING_INTERVAL = 25000;   // server treats a user as online for 60s after a ping
  var DOTS_INTERVAL = 10000;
  var pingTimer = null;
  var dotsTimer = null;

  function getCsrf() {
    var cookie = document.cookie.split('; ').find(function(r) { return r.startsWith('csrftoken='); });
    return cookie ? decodeURIComponent(cookie.split('=')[1]) : (window.ASTERIX && window.ASTERIX.CSRF) || '';
  }

  function sendPing() {
    if (localStorage.getItem('asterix_hide_online') === 'true') return;
    fetch('/api/update-online/', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': getCsrf() }
    }).catch(function() { /* ignore errors */ });
  }

  function startPing() {
    if (pingTimer) clearInterval(pingTimer);
    sendPing();
    pingTimer = setInterval(sendPing, PING_INTERVAL);
  }

  function stopPing() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  }

  // Sidebar dots. The header text and header dot are handled by chat.js checkOnline().
  function fetchOnlineUsers() {
    if (document.hidden) return;
    fetch('/api/users/online/', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        document.querySelectorAll('.online-dot').forEach(function(el) { el.style.display = 'none'; });
        (data.online || []).forEach(function(username) {
          var dot = document.getElementById('online-' + username);
          if (dot) dot.style.display = 'block';
        });
      })
      .catch(function() {});
  }

  function startDots() {
    if (dotsTimer) clearInterval(dotsTimer);
    fetchOnlineUsers();
    dotsTimer = setInterval(fetchOnlineUsers, DOTS_INTERVAL);
  }

  function boot() { startPing(); startDots(); }

  // Works whether the script loads before or after DOMContentLoaded.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Ping straight away when the tab becomes visible again.
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      startPing();
      fetchOnlineUsers();
    }
  });

  // When the "Hide Online Status" toggle changes, restart pinging.
  document.addEventListener('settingsChanged', function(e) {
    if (e.detail && e.detail.setting === 'hide_online') {
      stopPing();
      startPing();
    }
  });

  window.Asterix = window.Asterix || {};
  window.Asterix.online = {
    startPing: startPing,
    stopPing: stopPing,
    sendPing: sendPing,
    refreshDots: fetchOnlineUsers
  };

  console.log('[Asterix] Online status pinger loaded');
})();
