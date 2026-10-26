(function () {
  'use strict';

  function clearAppCache() {
    var jobs = [];
    if ('serviceWorker' in navigator) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) {
          return r.update().catch(function () {});
        }));
      }));
    }
    if ('caches' in window) {
      jobs.push(caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }));
    }
    return Promise.all(jobs);
  }

  function reloadApp(btn) {
    btn.disabled = true;
    btn.textContent = 'Updating...';
    clearAppCache()
      .catch(function () {})
      .then(function () {
        var url = new URL(window.location.href);
        url.searchParams.set('_v', Date.now());
        window.location.replace(url.toString());
      });
  }

  function injectButton() {
    var overlay = document.getElementById('settings-modal-overlay');
    if (!overlay || document.getElementById('fz-reload-app-row')) return;

    var host = overlay.querySelector('.settings-body, .settings-content, .modal-body, .modal-card') || overlay;

    var row = document.createElement('div');
    row.id = 'fz-reload-app-row';
    row.style.cssText = 'margin:14px 16px 6px;padding:14px;border-radius:14px;' +
      'background:rgba(37,211,102,.06);border:1px solid rgba(37,211,102,.2);';
    row.innerHTML =
      '<div style="font-size:14px;font-weight:700;color:#e9edef;margin-bottom:4px;">App updates</div>' +
      '<div style="font-size:12px;color:#8696a0;margin-bottom:10px;line-height:1.5;">' +
      'Reload to get the latest version. Your account, chats and settings stay as they are.</div>' +
      '<button id="fz-reload-app-btn" style="width:100%;padding:11px;border:0;border-radius:22px;' +
      'background:#25d366;color:#000;font-weight:700;font-size:14px;cursor:pointer;">' +
      '<i class="fas fa-sync-alt"></i> Reload app</button>';
    host.appendChild(row);

    document.getElementById('fz-reload-app-btn').onclick = function () { reloadApp(this); };
  }

  // The Settings panel can be built or rebuilt at any time, so watch for it.
  var observer = new MutationObserver(injectButton);
  function start() {
    injectButton();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.Asterix = window.Asterix || {};
  window.Asterix.appUpdate = { reload: function () { reloadApp(document.getElementById('fz-reload-app-btn') || { disabled: false, textContent: '' }); } };
})();
