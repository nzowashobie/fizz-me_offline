(function () {
  'use strict';

  // 🛑 Don't show the install banner if we are inside the native Android App
  if (window.AndroidBridge) return;

  var DISMISS_KEY = 'fizzme_pwa_dismissed_at';
  var deferredPrompt = null;
  var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  var css = document.createElement('style');
  css.textContent = [
    '#pwa-banner{position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:29000;',
    'background:#1f2c33;color:#e9edef;border:1px solid rgba(37,211,102,.35);border-radius:14px;padding:12px;',
    'display:flex;gap:8px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.45);}',
    '#pwa-banner .pwa-text{flex:1;min-width:0;font-size:13px;line-height:1.35;}',
    '.pwa-title{font-weight:700;font-size:14px;margin-bottom:2px;}',
    '.pwa-primary,.pwa-ghost{border:0;border-radius:20px;padding:9px 13px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;}',
    '.pwa-primary{background:#25d366;color:#000;}',
    '.pwa-primary:disabled{opacity:.5;cursor:default;}',
    '.pwa-x{background:none;border:0;color:#8696a0;font-size:22px;line-height:1;cursor:pointer;padding:0 4px;}'
  ].join('');
  document.head.appendChild(css);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service-worker.js').catch(function (err) {
        console.warn('[PWA] service worker not registered:', err);
      });
    });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function recentlyDismissed() {
    var t = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    return !!t && (Date.now() - t) < 7 * 86400000;
  }

  function hideBanner() {
    var b = document.getElementById('pwa-banner');
    if (b) b.remove();
  }

  function showBanner() {
    if (isStandalone || document.getElementById('pwa-banner')) return;
    var banner = el('div');
    banner.id = 'pwa-banner';
    var text = el('div', 'pwa-text');
    text.appendChild(el('div', 'pwa-title', 'Install Fizzme PWA'));
    text.appendChild(el('div', null, 'Add to home screen for quick access.'));

    var install = el('button', 'pwa-primary', 'Install');
    install.onclick = onInstall;

    var x = el('button', 'pwa-x', '×');
    x.setAttribute('aria-label', 'Dismiss');
    x.onclick = function () {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
      hideBanner();
    };

    banner.appendChild(text);
    banner.appendChild(install);
    banner.appendChild(x);
    document.body.appendChild(banner);
  }

  function onInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        deferredPrompt = null;
        if (choice && choice.outcome === 'accepted') {
          hideBanner();
        }
      });
      return;
    }
    hideBanner(); // fallback
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!recentlyDismissed()) showBanner();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hideBanner();
  });

  function init() {
    if (isStandalone) return;
    // Show banner automatically after 3 seconds if they haven't dismissed it
    if (!recentlyDismissed()) {
      setTimeout(showBanner, 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Asterix = window.Asterix || {};
  window.Asterix.pwa = { install: onInstall };
})();