(function () {
  'use strict';

  var SEEN_KEY = 'fizzme_update_seen';
  var POLL_MS = 60000;
  var busy = false;
  var latest = 0;

  function clearAppCache() {
    var jobs = [];
    if ('serviceWorker' in navigator) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.update().catch(function () {}); }));
      }).catch(function () {}));
    }
    if ('caches' in window) {
      jobs.push(caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }).catch(function () {}));
    }
    return Promise.all(jobs);
  }

  function seen() { return parseInt(localStorage.getItem(SEEN_KEY) || '0', 10) || 0; }
  function markSeen(v) { try { localStorage.setItem(SEEN_KEY, String(v)); } catch (e) {} }

  function reloadApp() {
    if (busy) return;
    busy = true;
    markSeen(latest || seen());
    var item = document.getElementById('ua-reload-app');
    if (item) { item.style.opacity = '.6'; item.textContent = 'Updating...'; }
    clearAppCache().then(function () {
      var url = new URL(window.location.href);
      url.searchParams.set('_v', Date.now());
      window.location.replace(url.toString());
    });
  }

  function showBanner(message) {
    if (document.getElementById('fz-update-banner')) return;
    var b = document.createElement('div');
    b.id = 'fz-update-banner';
    b.style.cssText = 'position:fixed;left:12px;right:12px;top:calc(12px + env(safe-area-inset-top,0px));z-index:29500;' +
      'background:#1f2c33;color:#e9edef;border:1px solid rgba(37,211,102,.45);border-radius:14px;padding:12px 14px;' +
      'display:flex;gap:10px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.5);';
    var text = document.createElement('div');
    text.style.cssText = 'flex:1;min-width:0;font-size:13px;line-height:1.4;';
    text.innerHTML = '<div style="font-weight:700;margin-bottom:2px;">New Fizzme update</div>';
    var msg = document.createElement('div');
    msg.textContent = message || 'Reload to get the latest version.';
    text.appendChild(msg);
    var btn = document.createElement('button');
    btn.textContent = 'Reload';
    btn.style.cssText = 'border:0;border-radius:20px;padding:9px 14px;background:#25d366;color:#000;font-weight:700;font-size:13px;cursor:pointer;';
    btn.onclick = reloadApp;
    b.appendChild(text);
    b.appendChild(btn);
    document.body.appendChild(b);
  }

  function check() {
    fetch('/api/app-version/', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.version) return;
        latest = d.version;
        if (!seen()) { markSeen(d.version); return; }
        if (d.version > seen()) showBanner(d.message);
      })
      .catch(function () {});
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#ua-reload-app') : null;
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    reloadApp();
  }, true);

  function start() {
    check();
    setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.Asterix = window.Asterix || {};
  window.Asterix.appUpdate = { reload: reloadApp, check: check };
})();
