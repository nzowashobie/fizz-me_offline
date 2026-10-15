(function () {
  "use strict";

  const LIST_URL = "/videos/list/";
  const ADD_URL = "/videos/add/";
  const PAGE_SIZE = 20; // must match PAGE_SIZE in chat/video_views.py
  const POLL_MS = 20000;
  const URL_RE = /https?:\/\/[^\s<>"']+/g;
  const NAMES = { tiktok: "TikTok", facebook: "Facebook", instagram: "Instagram", youtube: "YouTube" };
  // Providers whose players are often blocked inside other sites: show a button instead.
  const NO_EMBED = {};

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
    .vid-watch-yt{background:#ff0000}
    .vid-note{position:absolute;top:12px;left:12px;right:12px;z-index:2;pointer-events:none;
      background:rgba(0,0,0,.55);color:#fff;font-size:14px;line-height:1.4;padding:8px 10px;
      border-radius:10px;white-space:pre-wrap}
  `;
  document.head.appendChild(style);

  const sentinel = document.createElement("div");
  sentinel.className = "vid-sentinel";
  feed.append(sentinel);

  let oldestAt = null;   // created_at of the oldest card loaded so far
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

  function findCard(key) {
    return feed.querySelector(`[data-key="${key}"]`);
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

  function labelFor(item) {
    const name = NAMES[item.provider] || item.provider;
    return item.sender ? `${name} · from @${item.sender}` : name;
  }

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
    card.dataset.key = item.key;

    const box = document.createElement("div");
    box.className = "vid-fb-box";

    const title = document.createElement("div");
    title.className = "vid-fb-title";
    title.textContent = labelFor(item);

    const text = document.createElement("p");
    text.className = "vid-fb-note";
    text.textContent = `${name} often blocks its videos inside other apps. Tap below to watch it there.`;

    const watch = document.createElement("a");
    watch.className = "vid-fb-watch" + (item.provider === "youtube" ? " vid-watch-yt" : "");
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
    card.dataset.key = item.key;
    card.dataset.embed = item.embed_url;

    const iframe = document.createElement("iframe");
    iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
    iframe.title = `${NAMES[item.provider] || item.provider} video`;

    const bar = document.createElement("div");
    bar.className = "vid-bar";
    const label = document.createElement("span");
    label.textContent = labelFor(item);
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

  // Older items, one page at a time, as the user scrolls down.
  async function loadMore() {
    if (loading || exhausted) return;
    loading = true;
    try {
      const url = oldestAt === null
        ? LIST_URL
        : `${LIST_URL}?before=${encodeURIComponent(oldestAt)}`;
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { items } = await res.json();

      for (const it of items) {
        if (findCard(it.key)) continue;
        feed.insertBefore(makeCard(it), sentinel);
      }
      if (items.length) oldestAt = items[items.length - 1].created_at;
      if (items.length < PAGE_SIZE) exhausted = true;
      updateEmpty();
    } catch (err) {
      setStatus("Could not load your videos. Check your connection and reload.", true);
    } finally {
      loading = false;
    }
  }

  // Newer items (shared to you in chat, or pasted elsewhere) appear at the top.
  async function pollNew() {
    if (document.hidden || loading) return;
    try {
      const res = await fetch(LIST_URL, { credentials: "same-origin" });
      if (!res.ok) return;
      const { items } = await res.json();
      const fresh = items.filter((it) => !findCard(it.key));
      if (!fresh.length) return;

      const keep = feed.scrollTop;
      const before = feed.scrollHeight;
      for (const it of fresh.reverse()) {
        feed.insertBefore(makeCard(it), feed.firstChild);
      }
      feed.scrollTop = keep + (feed.scrollHeight - before);
      updateEmpty();
    } catch (err) {
      // Network hiccup: try again on the next tick.
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
    const existing = findCard(item.key);
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
  setInterval(pollNew, POLL_MS);
})();
