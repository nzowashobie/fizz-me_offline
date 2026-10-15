#!/usr/bin/env python
"""
patch_videos_ckeditor.py

Adds a CKEditor composer to the Videos page. Write a note, paste a video
link, tap Post. Each link becomes a video card with the note on top.

Changes:
  chat/models.py                               SharedVideo.note field
  chat/video_views.py                          videos_add accepts a note
  templates/videos.html                        composer block, CKEditor script, CSS
  static/chat/asterix_videos/videos_page.js    full rewrite (keeps the Facebook fallback)

Run from the folder that contains manage.py:
    python patch_videos_ckeditor.py --dry-run
    python patch_videos_ckeditor.py

Safe to re-run. Originals are backed up to _patch_backup/videos-ckeditor-<time>/
and restored if any step fails.
"""
import datetime
import glob
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
DRY = "--dry-run" in sys.argv
STAMP = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP = ROOT / "_patch_backup" / f"videos-ckeditor-{STAMP}"
CK_JS = "https://cdn.ckeditor.com/ckeditor5/41.4.2/classic/ckeditor.js"
CK_CSS = "https://cdn.ckeditor.com/ckeditor5/41.4.2/ckeditor5.css"
touched = {}
new_migrations = []


def say(msg):
    print(("[dry-run] " if DRY else "") + msg)


def write(rel, new, old):
    if new == old:
        say(f"ok      {rel} (already current)")
        return
    say(f"write   {rel}")
    if DRY:
        return
    p = ROOT / rel
    if rel not in touched:
        touched[rel] = p.exists()
        if p.exists():
            (BACKUP / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, BACKUP / rel)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(new, encoding="utf-8")


def rollback():
    for rel, existed in touched.items():
        p = ROOT / rel
        if existed:
            shutil.copy2(BACKUP / rel, p)
        else:
            p.unlink(missing_ok=True)
    for f in new_migrations:
        Path(f).unlink(missing_ok=True)


def once(text, old, new, rel):
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{rel}: expected exactly one match for an anchor, found {count}. Stopping.")
    return text.replace(old, new, 1)


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


# ── chat/models.py: SharedVideo.note ──────────────────────────────────────
def step_models():
    rel = "chat/models.py"
    s = read(rel)
    if "class SharedVideo(" not in s:
        raise SystemExit("chat/models.py: class SharedVideo not found. Run patch_videos_all.py first.")
    head, tail = s.split("class SharedVideo(", 1)
    if "note = models.TextField" not in tail:
        old = "    created_at = models.DateTimeField(auto_now_add=True)\n"
        if tail.count(old) < 1:
            raise SystemExit("chat/models.py: SharedVideo.created_at not found. Stopping.")
        tail = tail.replace(old, old + '    note = models.TextField(blank=True, default="")\n', 1)
        s_new = head + "class SharedVideo(" + tail
    else:
        s_new = s
    write(rel, s_new, s)


# ── chat/video_views.py: accept and return the note ───────────────────────
VIDEOS_ADD_FN = r'''@login_required
@require_POST
def videos_add(request):
    try:
        body = json.loads(request.body or b"{}")
    except (ValueError, AttributeError):
        return JsonResponse({"error": "Something went wrong. Paste the link again."}, status=400)
    if not isinstance(body, dict):
        body = {}

    url = (body.get("url") or "").strip()
    note = strip_tags(str(body.get("note") or "")).strip()[:500]

    if not url:
        return JsonResponse({"error": "Paste a video link first."}, status=400)

    found = extract_video_embeds(url)
    if not found:
        return JsonResponse(
            {"error": "This link isn't supported yet. Try a TikTok, Facebook, Instagram or YouTube video link."},
            status=400,
        )

    item = found[0]
    existing = SharedVideo.objects.filter(user=request.user, source_url=item["source_url"]).first()
    if existing:
        return JsonResponse({"item": _shared_json(existing), "duplicate": True})

    video = SharedVideo.objects.create(user=request.user, note=note, **item)
    return JsonResponse({"item": _shared_json(video)})
'''


def step_views():
    rel = "chat/video_views.py"
    s = read(rel)
    new = once(
        s,
        "from django.views.decorators.http import require_POST\n",
        "from django.utils.html import strip_tags\n"
        "from django.views.decorators.http import require_POST\n",
        rel,
    )
    if '"note": v.note' not in new:
        anchor = '        "embed_url": v.embed_url,\n'
        i = new.find("def _shared_json(v):")
        j = new.find(anchor, i) if i != -1 else -1
        if j == -1:
            raise SystemExit(f"{rel}: _shared_json not found. Stopping.")
        new = new[:j + len(anchor)] + '        "note": v.note,\n' + new[j + len(anchor):]
    start = new.find("@login_required\n@require_POST\ndef videos_add(request):")
    if start == -1:
        raise SystemExit(f"{rel}: videos_add not found. Stopping.")
    new = new[:start] + VIDEOS_ADD_FN
    write(rel, new, s)


# ── templates/videos.html: composer, CSS, CKEditor script ─────────────────
COMPOSER_CSS = r'''
  #vid-composer{padding:8px 12px;background:#111;border-bottom:1px solid #222}
  #vid-composer .ck-editor__editable{min-height:80px;max-height:160px;color:#000;background:#fff}
  .vid-composer-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px}
  .vid-hint{font-size:12px;color:#888}
  .vid-note{position:absolute;top:12px;left:12px;right:12px;z-index:2;pointer-events:none;
    background:rgba(0,0,0,.55);color:#fff;font-size:14px;line-height:1.4;padding:8px 10px;
    border-radius:10px;white-space:pre-wrap}
'''

COMPOSER_HTML = r'''<section id="vid-composer">
  <div id="vid-editor"></div>
  <div class="vid-composer-row">
    <span class="vid-hint">Write a note and paste a video link, then tap Post.</span>
    <button id="vid-post" class="vid-btn" type="button">Post</button>
  </div>
</section>
'''

SCRIPT_OLD = "<script src=\"{% static 'chat/asterix_videos/videos_page.js' %}\" defer></script>"
SCRIPT_NEW = f'<link rel="stylesheet" href="{CK_CSS}">\n<script src="{CK_JS}" defer></script>\n' + SCRIPT_OLD


def step_template():
    rel = "templates/videos.html"
    s = read(rel)
    new = once(s, "</style>", COMPOSER_CSS + "</style>", rel)
    new = once(new, '<main id="vid-feed">', COMPOSER_HTML + '<main id="vid-feed">', rel)
    new = once(new, SCRIPT_OLD, SCRIPT_NEW, rel)
    write(rel, new, s)


# ── static/chat/asterix_videos/videos_page.js (full file) ─────────────────
VIDEOS_JS = r'''(function () {
  "use strict";

  const LIST_URL = "/videos/list/";
  const ADD_URL = "/videos/add/";
  const PAGE_SIZE = 20; // must match PAGE_SIZE in chat/video_views.py
  const URL_RE = /https?:\/\/[^\s<>"']+/g;
  const NAMES = { tiktok: "TikTok", facebook: "Facebook", instagram: "Instagram", youtube: "YouTube" };
  // Providers whose players are often blocked inside other sites: show a button instead.
  const NO_EMBED = { facebook: true };

  const form = document.getElementById("vid-form");
  const input = document.getElementById("vid-input");
  const playBtn = document.getElementById("vid-play");
  const pasteBtn = document.getElementById("vid-paste");
  const postBtn = document.getElementById("vid-post");
  const statusEl = document.getElementById("vid-status");
  const feed = document.getElementById("vid-feed");
  const emptyEl = document.getElementById("vid-empty");
  const csrf = document.querySelector("[name=csrfmiddlewaretoken]").value;

  const style = document.createElement("style");
  style.textContent = `
    .vid-fb-box{background:#1c1c1c;border-radius:14px;padding:22px;max-width:360px;width:100%;
      text-align:center;margin:0 16px}
    .vid-fb-title{font-size:17px;font-weight:700;margin-bottom:8px}
    .vid-fb-note{font-size:13px;color:#aaa;line-height:1.5;margin:0 0 16px}
    .vid-fb-watch{display:inline-block;background:#1877f2;color:#fff;text-decoration:none;
      padding:12px 18px;border-radius:10px;font-weight:600}
  `;
  document.head.appendChild(style);

  const sentinel = document.createElement("div");
  sentinel.className = "vid-sentinel";
  feed.append(sentinel);

  let oldestId = null;
  let loading = false;
  let exhausted = false;
  let editor = null;

  function setStatus(text, isError) {
    statusEl.textContent = text || "";
    statusEl.classList.toggle("err", !!isError);
  }

  function updateEmpty() {
    emptyEl.hidden = feed.querySelector(".vid-card") !== null;
  }

  // Load an iframe once its card is within one screen of the viewport.
  const loadIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const iframe = e.target.querySelector("iframe");
      if (e.isIntersecting && !iframe.getAttribute("src")) {
        iframe.src = e.target.dataset.embed;
      }
    }
  }, { root: feed, rootMargin: "100% 0px 100% 0px" });

  // Stop cards that are far away (this also stops their audio).
  const unloadIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) e.target.querySelector("iframe").removeAttribute("src");
    }
  }, { root: feed, rootMargin: "200% 0px 200% 0px" });

  // Fetch the next page of older videos when the bottom of the list is reached.
  const moreIO = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadMore();
  }, { root: feed });
  moreIO.observe(sentinel);

  function addNote(card, item) {
    if (!item.note) return;
    const note = document.createElement("div");
    note.className = "vid-note";
    note.textContent = item.note;
    card.append(note);
  }

  function makeFallbackCard(item) {
    const name = NAMES[item.provider] || item.provider;
    const card = document.createElement("section");
    card.className = "vid-card";
    card.dataset.id = item.id;

    const box = document.createElement("div");
    box.className = "vid-fb-box";

    const title = document.createElement("div");
    title.className = "vid-fb-title";
    title.textContent = `${name} video`;

    const text = document.createElement("p");
    text.className = "vid-fb-note";
    text.textContent = `${name} often blocks its videos inside other apps. Tap below to watch it there.`;

    const watch = document.createElement("a");
    watch.className = "vid-fb-watch";
    watch.href = item.source_url;
    watch.target = "_blank";
    watch.rel = "noopener noreferrer";
    watch.textContent = `Watch on ${name} ↗`;

    box.append(title, text, watch);
    card.append(box);
    addNote(card, item);
    return card;
  }

  function makeCard(item) {
    if (NO_EMBED[item.provider]) return makeFallbackCard(item);

    const card = document.createElement("section");
    card.className = "vid-card";
    card.dataset.id = item.id;
    card.dataset.embed = item.embed_url;

    const iframe = document.createElement("iframe");
    iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
    iframe.setAttribute("allowfullscreen", "");
    iframe.title = `${NAMES[item.provider] || item.provider} video`;

    const bar = document.createElement("div");
    bar.className = "vid-bar";
    const label = document.createElement("span");
    label.textContent = NAMES[item.provider] || item.provider;
    const open = document.createElement("a");
    open.href = item.source_url;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.textContent = "Open original ↗";
    bar.append(label, open);

    card.append(iframe, bar);
    addNote(card, item);
    loadIO.observe(card);
    unloadIO.observe(card);
    return card;
  }

  async function loadMore() {
    if (loading || exhausted) return;
    loading = true;
    try {
      const url = oldestId === null ? LIST_URL : `${LIST_URL}?before=${oldestId}`;
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { items } = await res.json();

      for (const it of items) {
        oldestId = oldestId === null ? it.id : Math.min(oldestId, it.id);
        if (feed.querySelector(`[data-id="${it.id}"]`)) continue;
        feed.insertBefore(makeCard(it), sentinel);
      }
      if (items.length < PAGE_SIZE) exhausted = true;
      updateEmpty();
    } catch (err) {
      setStatus("Could not load your videos. Check your connection and reload.", true);
    } finally {
      loading = false;
    }
  }

  async function sendLink(url, note) {
    const res = await fetch(ADD_URL, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
      body: JSON.stringify({ url, note: note || "" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Could not add that link (HTTP ${res.status}).`);
    return data;
  }

  function addOrFocusCard(item) {
    const existing = feed.querySelector(`[data-id="${item.id}"]`);
    if (existing) {
      existing.scrollIntoView({ behavior: "smooth" });
      return;
    }
    feed.insertBefore(makeCard(item), feed.firstChild);
    updateEmpty();
    feed.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Paste box: add one link straight away.
  async function addLink() {
    const url = input.value.trim();
    if (!url) {
      setStatus("Paste a video link first.", true);
      input.focus();
      return;
    }

    playBtn.disabled = true;
    setStatus("Loading video…");
    try {
      const data = await sendLink(url, "");
      addOrFocusCard(data.item);
      input.value = "";
      setStatus(data.duplicate ? "That video is already in your list." : "");
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      playBtn.disabled = false;
    }
  }

  // Composer: the note is the text without links; each link becomes a card.
  async function postComposer() {
    if (!editor) {
      setStatus("The post box did not load. Use the paste box above.", true);
      return;
    }

    const doc = new DOMParser().parseFromString(editor.getData(), "text/html");
    const text = (doc.body.textContent || "").replace(/\s+/g, " ").trim();

    const urls = new Set();
    doc.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href)) urls.add(href);
    });
    (text.match(URL_RE) || []).forEach((u) => urls.add(u.replace(/[.,)!?]+$/, "")));

    const note = text.replace(URL_RE, "").replace(/\s+/g, " ").trim();

    if (urls.size === 0) {
      setStatus("Add a video link to your post.", true);
      return;
    }

    postBtn.disabled = true;
    setStatus("Posting…");
    const errors = [];
    for (const url of urls) {
      try {
        const data = await sendLink(url, note);
        addOrFocusCard(data.item);
      } catch (err) {
        errors.push(err.message);
      }
    }

    if (errors.length === 0) {
      editor.setData("");
      setStatus("Posted.");
    } else {
      setStatus(errors[0], true);
    }
    postBtn.disabled = false;
  }

  async function initEditor() {
    if (!window.ClassicEditor || !document.getElementById("vid-editor")) return;
    try {
      editor = await window.ClassicEditor.create(document.getElementById("vid-editor"), {
        licenseKey: "GPL",
        placeholder: "Write a note about the video, then paste its link…",
        toolbar: ["bold", "italic", "|", "bulletedList", "numberedList", "|", "undo", "redo"],
      });
    } catch (err) {
      setStatus("The post box did not load. The paste box above still works.", true);
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addLink();
  });

  // Pasting a link into the box adds it straight away.
  input.addEventListener("paste", () => setTimeout(addLink, 50));

  pasteBtn.addEventListener("click", async () => {
    try {
      input.value = (await navigator.clipboard.readText()).trim();
      input.focus();
      if (input.value) addLink();
    } catch (err) {
      setStatus("Tap and hold the box, then choose Paste.", true);
      input.focus();
    }
  });

  postBtn.addEventListener("click", postComposer);

  updateEmpty();
  initEditor();
})();
'''


def step_js():
    rel = "static/chat/asterix_videos/videos_page.js"
    s = read(rel)
    write(rel, VIDEOS_JS, s)


def main():
    if not (ROOT / "manage.py").exists():
        raise SystemExit("Run this from the folder that contains manage.py.")

    say(f"backups: {BACKUP}")
    migrations_before = set(glob.glob(str(ROOT / "chat/migrations/*.py")))
    try:
        step_models()
        step_views()
        step_template()
        step_js()

        if DRY:
            say("dry run complete, nothing was written")
            return

        res = subprocess.run([sys.executable, "manage.py", "makemigrations", "chat", "--noinput"],
                             cwd=ROOT, capture_output=True, text=True)
        print(res.stdout + res.stderr)
        if res.returncode:
            raise SystemExit("makemigrations failed")
        new_migrations.extend(
            sorted(set(glob.glob(str(ROOT / "chat/migrations/*.py"))) - migrations_before))

        res = subprocess.run([sys.executable, "manage.py", "check"],
                             cwd=ROOT, capture_output=True, text=True)
        print(res.stdout + res.stderr)
        if res.returncode:
            raise SystemExit("manage.py check failed")
    except BaseException:
        if not DRY and touched:
            rollback()
            say(f"rolled back every change from this run. Backups: {BACKUP}")
        raise

    res = subprocess.run([sys.executable, "manage.py", "collectstatic", "--noinput"],
                         cwd=ROOT, capture_output=True, text=True)
    print(res.stdout.strip() or res.stderr.strip())
    say("done. Next: python manage.py migrate, then reload the web app.")


if __name__ == "__main__":
    main()