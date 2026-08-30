// ============================================================
// pwa-bridge.js — PWA <-> Native bridge shim
// ============================================================

(function () {
  'use strict';

  var isNative = !!(window.AndroidBridge);

  // ── Service worker registration ────────────────────────────────────
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.register('/service-worker.js').then(function (reg) {
      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
      return reg;
    }).catch(function (err) {
      console.warn('[PWABridge] service worker registration failed:', err);
      return null;
    });
  }

  // ── Install prompt ──────────────────────────────────────────────────
  var _deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    _deferredInstallPrompt = e;
    document.dispatchEvent(new CustomEvent('pwa-install-available'));
  });

  function promptInstall() {
    if (!_deferredInstallPrompt) return Promise.resolve({ outcome: 'unavailable' });
    _deferredInstallPrompt.prompt();
    return _deferredInstallPrompt.userChoice.then(function (choice) {
      _deferredInstallPrompt = null;
      return choice;
    });
  }

  // ── Notifications ────────────────────────────────────────────────────
  function requestNotificationPermission() {
    if (!('Notification' in window)) return Promise.resolve('unsupported');
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
    return Notification.requestPermission();
  }

  function showLocalNotification(title, options) {
    if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return Promise.resolve(false);
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.showNotification(title, options || {});
    });
  }

  // ── Contacts (web fallback via Contacts Picker API) ───────────────────
  function contactsPickerSupported() {
    return !!(navigator.contacts && navigator.contacts.select && window.isSecureContext);
  }

  function pickContactsWeb() {
    if (!contactsPickerSupported()) return Promise.reject(new Error('Contacts Picker not supported in this browser.'));
    var props = ['name', 'tel'];
    var opts  = { multiple: true };

    return navigator.contacts.select(props, opts).then(function (results) {
      var out = [];
      results.forEach(function (c) {
        var name = (c.name && c.name[0]) || 'Unknown';
        var tels = (c.tel || []).map(function (t) { return t.trim(); }).filter(Boolean);
        if (!tels.length) return;

        // One row per CONTACT — first number is primary for the
        // Fizz-me membership lookup and Add/Invite actions.
        // Additional numbers are stashed on extra_phones for
        // potential future use; nothing currently reads that field.
        out.push({
          name:         name,
          phone:        tels[0],
          photo_uri:    null,
          extra_phones: tels.length > 1 ? tels.slice(1) : []
        });
      });
      return out;
    });
  }

  // ── Web Push ─────────────────────────────────────────────────────────
  function _urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw     = atob(base64);
    var out     = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function _postSubscription(path, subscriptionJson) {
    var csrf = (window.ASTERIX && window.ASTERIX.CSRF) || '';
    return fetch(path, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body:    JSON.stringify(subscriptionJson),
    }).then(function (r) { return r.json(); });
  }

  function subscribeToPush() {
    var vapidKey = window.ASTERIX && window.ASTERIX.VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.warn('[PWABridge] VAPID_PUBLIC_KEY not configured — skipping push subscribe.');
      return Promise.resolve(null);
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return Promise.resolve(null);

    return navigator.serviceWorker.ready
      .then(function (reg) {
        return reg.pushManager.getSubscription().then(function (existing) {
          if (existing) return existing;
          return reg.pushManager.subscribe({
            userVisibleOnly:      true,
            applicationServerKey: _urlBase64ToUint8Array(vapidKey),
          });
        });
      })
      .then(function (sub) {
        if (!sub) return null;
        return _postSubscription('/api/push/subscribe/', sub.toJSON()).then(function () { return sub; });
      })
      .catch(function (err) {
        console.warn('[PWABridge] push subscribe failed:', err);
        return null;
      });
  }

  function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(false);
    return navigator.serviceWorker.ready
      .then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) {
        if (!sub) return false;
        var endpoint = sub.endpoint;
        return sub.unsubscribe().then(function () {
          return _postSubscription('/api/push/unsubscribe/', { endpoint: endpoint });
        }).then(function () { return true; });
      })
      .catch(function () { return false; });
  }

  function enablePushNotifications() {
    return requestNotificationPermission().then(function (perm) {
      if (perm !== 'granted') return { granted: false };
      return subscribeToPush().then(function (sub) { return { granted: true, subscribed: !!sub }; });
    });
  }

  // ── Public API ────────────────────────────────────────────────────────
  window.PWABridge = {
    isNative:                     isNative,
    registerServiceWorker:        registerServiceWorker,
    promptInstall:                promptInstall,
    requestNotificationPermission:requestNotificationPermission,
    showLocalNotification:        showLocalNotification,
    contactsPickerSupported:      contactsPickerSupported,
    pickContactsWeb:              pickContactsWeb,
    subscribeToPush:              subscribeToPush,
    unsubscribeFromPush:          unsubscribeFromPush,
    enablePushNotifications:      enablePushNotifications,
  };

  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker);
  }

  console.log('[Fizz-me] PWA bridge loaded. Native shell detected:', isNative);
})();