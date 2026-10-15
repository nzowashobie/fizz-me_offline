(function () {
  "use strict";

  const FEED_URL = "/videos/feed/";
  const POLL_MS = 5000;
  const AUTO_OPEN = !!window.ASTERIX_VIDEOS_AUTO_OPEN; // set by the /videos/ page

  const style = document.createElement("style");
  style.textContent = `
    #asterix-reels-btn{position:fixed;right:16px;bottom:16px;z-index:9998;padding:10px 14px;
      border:0;border-radius:20px;background:#128c7e;color:#fff;font-weight:600;cursor:pointer}
    #asterix-reels{position:fixed;inset:0;z-index:9999;background:#000}
    #asterix-reels[hidden]{display:none}
    .ar-feed{height:100%;overflow-y:auto;scroll-snap-type:y mandatory}
    .ar-card{height:100%;scroll-snap-align:start;position:relative;background:#000}
    .ar-card iframe{width:100%;height:100%;border:0}
    .ar-meta{position:absolute;left:12px;bottom:12px;color:#fff;font-size:13px;
      text-shadow:0 1px 2px #000;z-index:2}
    .ar-meta a{color:#fff}
    .ar-close{position:absolute;top:12px;right:12px;z-index:3;background:rgba(0,0,0,.5);
      color:#fff;border:0;border-radius:50%;width:36px;height:36px;font-size:20px;cursor:pointer}
    .ar-empty{color:#aaa;text-align:center;padding:40px}
  `;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.id = "asterix-reels-btn";
  btn.type = "button";
  btn.textContent = "▶ Videos";

  const panel = document.createElement("div");
  panel.id = "asterix-reels";
  panel.hidden = true;
  panel.innerHTML = '<button class="ar-close" type="button" aria-label="Close">×</button>' +
                    '<div class="ar-feed"></div>';

  if (AUTO_OPEN) {
    // Standalone /videos/ page: no floating button, the feed is the page.
    document.body.append(panel);
  } else {
    document.body.append(btn, panel);
  }

  const feed = panel.querySelector(".ar-feed");
  const sentinel = document.createElement("div");
  sentinel.style.height = "1px";
  feed.append(sentinel);

  let newestId = 0;
  let oldestId = null;
  let loadingOlder = false;
  let pollTimer = null;
  let emptyNote = null;

  // Load an iframe when its card is within one screen of the viewport.
  const loadIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const iframe = e.target.querySelector("iframe");
      if (e.isIntersecting && !iframe.src) iframe.src = e.target.dataset.embed;
    }
  }, { root: feed, rootMargin: "100% 0px 100% 0px" });

  // Unload iframes that are more than two screens away (also stops their audio).
  // The wider margin keeps the two observers from fighting over the same card.
  const unloadIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) e.target.querySelector("iframe").removeAttribute("src");
    }
  }, { root: feed, rootMargin: "200% 0px 200% 0px" });

  function makeCard(item) {
    const card = document.createElement("section");
    card.className = "ar-card";
    card.dataset.embed = item.embed_url;

    const iframe = document.createElement("iframe");
    iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";

    const meta = document.createElement("div");
    meta.className = "ar-meta";
    const who = document.createElement("span");
    who.textContent = `@${item.sender} · ${item.provider}`;
    const link = document.createElement("a");
    link.href = item.source_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open original ↗";
    meta.append(who, document.createElement("br"), link);

    card.append(iframe, meta);
    loadIO.observe(card);
    unloadIO.observe(card);
    return card;
  }

  function showEmpty() {
    emptyNote = document.createElement("div");
    emptyNote.className = "ar-empty";
    emptyNote.textContent = "No shared videos yet. Share a TikTok, Facebook or other video link in chat.";
    feed.insertBefore(emptyNote, sentinel);
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // Load older pages when the bottom sentinel becomes visible.
  async function loadOlder() {
    if (loadingOlder) return;
    loadingOlder = true;
    try {
      const url = oldestId === null ? FEED_URL : `${FEED_URL}?before=${oldestId}`;
      const { items } = await fetchJSON(url);
      if (oldestId === null && items.length === 0) showEmpty();
      for (const it of items) {
        feed.insertBefore(makeCard(it), sentinel);
        newestId = Math.max(newestId, it.id);
        oldestId = oldestId === null ? it.id : Math.min(oldestId, it.id);
      }
    } catch (err) {
      console.warn("asterix_videos: could not load feed", err);
    } finally {
      loadingOlder = false;
    }
  }

  // Poll for new videos while the panel is open. Items arrive oldest first,
  // so prepending each one leaves the newest at the top.
  async function pollNew() {
    if (document.hidden) return;
    try {
      const { items } = await fetchJSON(`${FEED_URL}?since=${newestId}`);
      if (!items.length) return;
      if (emptyNote) { emptyNote.remove(); emptyNote = null; }

      const keep = feed.scrollTop;
      const heightBefore = feed.scrollHeight;
      for (const it of items) {
        feed.insertBefore(makeCard(it), feed.firstChild);
        newestId = Math.max(newestId, it.id);
      }
      // Keep the user's position when content is added above them.
      feed.scrollTop = keep + (feed.scrollHeight - heightBefore);
    } catch (err) {
      console.warn("asterix_videos: poll failed", err);
    }
  }

  const sentinelIO = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadOlder();
  }, { root: feed });
  sentinelIO.observe(sentinel);

  function open() {
    panel.hidden = false;
    pollNew();
    clearInterval(pollTimer);
    pollTimer = setInterval(pollNew, POLL_MS);
  }

  function close() {
    panel.hidden = true;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  // On the standalone page, leaving the feed returns to the chat list.
  function leave() {
    if (AUTO_OPEN) {
      window.location.href = "/";
    } else {
      close();
    }
  }

  panel.querySelector(".ar-close").addEventListener("click", leave);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) leave();
  });

  if (AUTO_OPEN) {
    open();
  } else {
    btn.addEventListener("click", open);
  }
})();