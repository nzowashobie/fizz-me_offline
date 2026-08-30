// ============================================================
// online.js — Online status ping
// ============================================================

(function() {
  'use strict';

  var PING_INTERVAL = 30000; // 30 seconds
  var pingTimer = null;

  function sendPing() {
    // Check if we should hide online status
    var hideOnline = localStorage.getItem('asterix_hide_online') === 'true';
    if (hideOnline) return;

    fetch('/api/update-online/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCsrf()
      }
    }).catch(function() { /* ignore errors */ });
  }

  function getCsrf() {
    var cookie = document.cookie.split('; ').find(function(r) { return r.startsWith('csrftoken='); });
    return cookie ? cookie.split('=')[1] : (window.ASTERIX && window.ASTERIX.CSRF) || '';
  }

  function startPing() {
    if (pingTimer) clearInterval(pingTimer);
    // Send immediately
    sendPing();
    pingTimer = setInterval(sendPing, PING_INTERVAL);
  }

  function stopPing() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  // ── Events ─────────────────────────────────────────────────────

  // Start pinging when page loads
  document.addEventListener('DOMContentLoaded', startPing);

  // Also send ping on visibility change (tab becomes active)
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      sendPing();
      // Restart interval to avoid long gaps
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = setInterval(sendPing, PING_INTERVAL);
      }
    }
  });

  // Also send ping on user activity (click, keypress) – optional
  document.addEventListener('click', function() {
    // Debounce: don't flood
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = setInterval(sendPing, PING_INTERVAL);
    }
    sendPing();
  });

  // ── Listen for setting changes ────────────────────────────────
  // When the "Hide Online Status" toggle changes, restart pinging
  document.addEventListener('settingsChanged', function(e) {
    if (e.detail && e.detail.setting === 'hide_online') {
      // Stop and restart so the new setting takes effect
      stopPing();
      startPing();
    }
  });

  // Expose for manual restart if needed
  window.Asterix = window.Asterix || {};
  window.Asterix.online = {
    startPing: startPing,
    stopPing: stopPing,
    sendPing: sendPing
  };

  console.log('[Asterix] Online status pinger loaded');
})();