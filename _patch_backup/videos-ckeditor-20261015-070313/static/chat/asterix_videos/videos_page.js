(function () {
  "use strict";

  const LIST_URL = "/videos/list/";
  const ADD_URL = "/videos/add/";
  const PAGE_SIZE = 20; // must match PAGE_SIZE in chat/video_views.py
  const NAMES = { tiktok: "TikTok", facebook: "Facebook", instagram: "Instagram", youtube: "YouTube" };

  const form = document.getElementById("vid-form");
  const input = document.getElementById("vid-input");
  const playBtn = document.getElementById("vid-play");
  const pasteBtn = document.getElementById("vid-paste");
  const statusEl = document.getElementById("vid-status");
  const feed = document.getElementById("vid-feed");
  const emptyEl = document.getElementById("vid-empty");
  const csrf = document.querySelector("[name=csrfmiddlewaretoken]").value;

  const sentinel = document.createElement("div");
  sentinel.className = "vid-sentinel";
  feed.append(sentinel);

  let oldestId = null;
  let loading = false;
  let exhausted = false;

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

  function makeCard(item) {
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
      const res = await fetch(ADD_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Could not add that link (HTTP ${res.status}).`);

      const existing = feed.querySelector(`[data-id="${data.item.id}"]`);
      if (existing) {
        existing.scrollIntoView({ behavior: "smooth" });
      } else {
        feed.insertBefore(makeCard(data.item), feed.firstChild);
        updateEmpty();
        feed.scrollTo({ top: 0, behavior: "smooth" });
      }

      input.value = "";
      setStatus(data.duplicate ? "That video is already in your list." : "");
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      playBtn.disabled = false;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addLink();
  });

  // Pasting a link into the box plays it straight away.
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

  updateEmpty();
})();
