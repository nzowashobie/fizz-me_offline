#!/usr/bin/env python
"""
patch_reload_menu.py

Puts "Reload app" in the three-dot chat menu, where every user can see it.
It clears the app's cached files, asks the service worker for an update,
and reloads. Login, chats and settings are kept.

Rewrites staticfiles/js/modules/app_update.js
Edits templates/index.html (menu item + script tag)

Run from the project folder (the one with manage.py):
    python patch_reload_menu.py --dry-run
    python patch_reload_menu.py
"""
import datetime
import re
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
BACKUP = ROOT / "_patch_backup" / f"reload-menu-{datetime.datetime.now():%Y%m%d-%H%M%S}"
INDEX = "templates/index.html"
JS = "staticfiles/js/modules/app_update.js"
TAG = "<script src=\"{% static 'js/modules/app_update.js' %}\" defer></script>"
MENU_ITEM = '<div id="ua-reload-app" class="ua-item"><i class="fas fa-sync-alt"></i> Reload app</div>\n  '
LOGOUT_FORM = re.compile(r'<form[^>]*id="logout-form"[^>]*>')

JS_SOURCE = r'''(function () {
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

    if 'id="ua-reload-app"' in index_new:
        say(f"ok      {INDEX} (menu item already present)")
    else:
        matches = LOGOUT_FORM.findall(index_new)
        if len(matches) != 1:
            raise SystemExit(f"{INDEX}: expected one logout form, found {len(matches)}. Stopping.")
        m = LOGOUT_FORM.search(index_new)
        index_new = index_new[:m.start()] + MENU_ITEM + index_new[m.start():]

    if "app_update.js" in index_new:
        say(f"ok      {INDEX} (script tag already present)")
    else:
        i = index_new.rfind("</body>")
        if i == -1:
            raise SystemExit(f"{INDEX}: no </body> found. Stopping.")
        index_new = index_new[:i] + TAG + "\n" + index_new[i:]

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

    say("done. Run collectstatic, then reload the web app.")


if __name__ == "__main__":
    main()