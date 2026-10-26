(function () {
  'use strict';

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

  var busy = false;

  function reloadApp() {
    if (busy) return;
    busy = true;
    var item = document.getElementById('ua-reload-app');
    if (item) { item.style.opacity = '.6'; item.textContent = 'Updating...'; }
    clearAppCache().then(function () {
      var url = new URL(window.location.href);
      url.searchParams.set('_v', Date.now());
      window.location.replace(url.toString());
    });
  }

  // Delegated click, so it works however the menu is built or rebuilt.
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#ua-reload-app') : null;
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    reloadApp();
  }, true);

  window.Asterix = window.Asterix || {};
  window.Asterix.appUpdate = { reload: reloadApp };
})();
