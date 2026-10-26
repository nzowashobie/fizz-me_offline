// ============================================================
// online.js — Online status ping + sidebar green dots
// ============================================================

(function() {
  'use strict';
  if (window.__fzOnlineLoaded) return;
  window.__fzOnlineLoaded = true;

  var PING_INTERVAL = 25000;
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
    }).catch(function() {});
  }

  function startPing() {
    if (pingTimer) clearInterval(pingTimer);
    sendPing();
    pingTimer = setInterval(sendPing, PING_INTERVAL);
  }

  function stopPing() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  }

  function fetchOnlineUsers() {
    if (document.hidden) return;
    fetch('/api/users/online/', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        // Sidebar dots are disabled. Online status will only show in the chat header.
        document.querySelectorAll('.online-dot').forEach(function(el) { el.style.display = 'none'; });
      }).catch(function() {});
  }

  function startDots() {
    if (dotsTimer) clearInterval(dotsTimer);
    fetchOnlineUsers();
    dotsTimer = setInterval(fetchOnlineUsers, DOTS_INTERVAL);
  }

  function boot() { startPing(); startDots(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      startPing();
      fetchOnlineUsers();
    }
  });

  document.addEventListener('settingsChanged', function(e) {
    if (e.detail && e.detail.setting === 'hide_online') {
      stopPing();
      startPing();
    }
  });

  window.Asterix = window.Asterix || {};
  window.Asterix.online = { startPing: startPing, stopPing: stopPing, sendPing: sendPing, refreshDots: fetchOnlineUsers };
})();
