#!/usr/bin/env python
"""
patch_reload_button.py

Adds a "Reload app" button inside the Settings panel. It clears the app's
cached files and asks the service worker to check for an update, then reloads.
Login, chats, and settings are kept. Cookies are not deleted (that would log
everyone out).

Creates staticfiles/js/modules/app_update.js
Edits templates/index.html (adds one script tag)

Run from the project folder (the one with manage.py):
    python patch_reload_button.py --dry-run
    python patch_reload_button.py
"""
import datetime
import shutil
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path.cwd()
DRY = "--dry-run" in sys.argv
BACKUP = ROOT / "_patch_backup" / f"reload-button-{datetime.datetime.now():%Y%m%d-%H%M%S}"
INDEX = "templates/index.html"
JS = "staticfiles/js/modules/app_update.js"
TAG = "<script src=\"{% static 'js/modules/app_update.js' %}\" defer></script>"

JS_SOURCE = r'''(function () {
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
'''


def say(msg):
    print(("[dry-run] " if DRY else "") + msg)


def main():
    if not (ROOT / "manage.py").exists():
        raise SystemExit("Run this from the folder that contains manage.py.")

    index_path = ROOT / INDEX
    if not index_path.exists():
        raise SystemExit(f"{INDEX} not found. Stopping.")
    index_orig = index_path.read_text(encoding="utf-8")
    index_new = index_orig
    if "app_update.js" in index_orig:
        say(f"ok      {INDEX} (script tag already present)")
    else:
        i = index_orig.rfind("</body>")
        if i == -1:
            raise SystemExit(f"{INDEX}: no </body> found. Stopping.")
        index_new = index_orig[:i] + TAG + "\n" + index_orig[i:]

    js_path = ROOT / JS
    js_old = js_path.read_text(encoding="utf-8") if js_path.exists() else None
    js_changed = js_old != JS_SOURCE

    changes = []
    if index_new != index_orig:
        changes.append(("edit", INDEX))
    if js_changed:
        changes.append(("write", JS))
    if not changes:
        say("nothing to change")
        return
    for action, rel in changes:
        say(f"{action:<6} {rel}")
    if DRY:
        say("dry run complete, nothing was written")
        return

    BACKUP.mkdir(parents=True, exist_ok=True)
    if index_new != index_orig:
        shutil.copy2(index_path, BACKUP / index_path.name)
        index_path.write_text(index_new, encoding="utf-8")
    if js_changed:
        if js_old is not None:
            shutil.copy2(js_path, BACKUP / js_path.name)
        js_path.parent.mkdir(parents=True, exist_ok=True)
        js_path.write_text(JS_SOURCE, encoding="utf-8")
    say(f"backups: {BACKUP}")

    r = subprocess.run([sys.executable, "manage.py", "check"], cwd=ROOT,
                       capture_output=True, text=True)
    print(r.stdout + r.stderr)
    if r.returncode:
        if index_new != index_orig:
            shutil.copy2(BACKUP / index_path.name, index_path)
        if js_changed:
            if js_old is not None:
                shutil.copy2(BACKUP / js_path.name, js_path)
            else:
                js_path.unlink(missing_ok=True)
        say(f"check failed, originals restored. Backups: {BACKUP}")
        raise SystemExit(1)

    say("done. On the server, run collectstatic, then reload the web app.")


if __name__ == "__main__":
    main()