(function () {
  "use strict";

  const COUNT_URL = "/videos/unseen/";
  const VIDEOS_URL = "/videos/";
  const POLL_MS = 30000;
  const DOT_TEXTS = ["⋮", "⋯", "︙"];

  const style = document.createElement("style");
  style.textContent = `
    .asterix-videos-dot{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;
      padding:0 5px;border-radius:9px;background:#ff3b30;color:#fff;font-size:11px;
      font-weight:700;line-height:18px;text-align:center;box-sizing:border-box;
      pointer-events:none;z-index:5}
    .asterix-videos-dot[hidden]{display:none}
  `;
  document.head.appendChild(style);

  let badges = [];

  // 1. Add a "Videos" row to the menu by cloning the existing "Partners" row,
  //    so the new row uses the menu's own styling.
  function addMenuItem() {
    if (document.querySelector("[data-videos-menu]")) return false;
    const leaf = [...document.querySelectorAll("body *")].find(
      (el) => el.children.length === 0 && el.textContent.trim() === "Partners"
    );
    if (!leaf) return false;
    const row = leaf.closest("a, button, li, [role='menuitem']") || leaf.parentElement;
    if (!row || !row.parentElement) return false;
    if (!row.parentElement.textContent.includes("Logout")) return false;

    const item = row.cloneNode(true);
    item.setAttribute("data-videos-menu", "");
    item.setAttribute("data-videos-badge", "");
    [...item.attributes].forEach((a) => {
      if (a.name.startsWith("on") || a.name === "id" || a.name === "href") item.removeAttribute(a.name);
    });

    if (item.children.length === 0) {
      item.textContent = "Videos";
    } else {
      const label = [...item.querySelectorAll("*")].find(
        (el) => el.children.length === 0 && el.textContent.trim() === "Partners"
      );
      if (label) label.textContent = "Videos";
    }

    if (item.tagName === "A") item.setAttribute("href", VIDEOS_URL);
    item.addEventListener("click", () => { window.location.href = VIDEOS_URL; });
    row.parentElement.insertBefore(item, row.nextSibling);
    return true;
  }

  // 2. Find the three-dots button (and the Videos row) to hang the badge on.
  function findTargets() {
    const set = new Set(document.querySelectorAll("[data-videos-badge]"));
    document.querySelectorAll("body *").forEach((el) => {
      const isDot = el.children.length === 0 && DOT_TEXTS.includes(el.textContent.trim());
      const isMenuButton = el.matches("button, [role='button']") &&
        /menu|more|options/i.test(el.getAttribute("aria-label") || "");
      if (isDot || isMenuButton) set.add(el.closest("button, [role='button'], a") || el);
    });
    return [...set];
  }

  function attachBadges() {
    let added = 0;
    findTargets().forEach((el) => {
      if (el.dataset.videosBadged) return;
      el.dataset.videosBadged = "1";
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      const dot = document.createElement("span");
      dot.className = "asterix-videos-dot";
      dot.hidden = true;
      el.appendChild(dot);
      badges.push(dot);
      added++;
    });
    return added;
  }

  // 3. Ask the server how many chat videos are unseen.
  async function refresh() {
    try {
      const res = await fetch(COUNT_URL, { credentials: "same-origin" });
      if (!res.ok) return;
      const { count } = await res.json();
      const text = count > 9 ? "9+" : String(count);
      badges.forEach((b) => {
        b.textContent = text;
        b.hidden = count === 0;
      });
    } catch (err) {
      // Network error: keep the last known state and try again on the next tick.
    }
  }

  function tick() {
    if (attachBadges()) refresh();
  }

  tick();
  refresh();
  setInterval(() => { tick(); refresh(); }, POLL_MS);
  // The menu is often built when the three dots are tapped, so check after clicks.
  document.addEventListener("click", () => setTimeout(tick, 80));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
})();
