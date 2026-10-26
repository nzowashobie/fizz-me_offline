// ============================================================
// bible-preview.js — in-app Bible reader for YouVersion links
// Works with links made by linkify() in chat.js. Does not modify chat.js.
// ============================================================
(function () {
  'use strict';

  var API = 'https://bible-api.com/';
  var LINK_SELECTOR = 'a[href*="bible.com/bible/111/"]';
  var LINK_RE = /bible\.com\/bible\/111\/([^.]+)\.(\d+)\.(\d+)/;
  var chapterCache = new Map();
  var canHover = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);

  function parseLink(href) {
    var m = LINK_RE.exec(href || '');
    if (!m) return null;
    return {
      book: decodeURIComponent(m[1]).replace(/\+/g, ' '),
      chapter: parseInt(m[2], 10),
      verse: parseInt(m[3], 10)
    };
  }

  function fetchChapter(book, chapter) {
    var key = book + '|' + chapter;
    if (chapterCache.has(key)) return Promise.resolve(chapterCache.get(key));
    return fetch(API + encodeURIComponent(book + ' ' + chapter))
      .then(function (r) {
        if (!r.ok) throw new Error('status ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var result = {
          reference: data.reference || (book + ' ' + chapter),
          verses: (data.verses || []).map(function (v) {
            return { verse: v.verse, text: (v.text || '').trim() };
          })
        };
        if (!result.verses.length) throw new Error('no verses');
        chapterCache.set(key, result);
        return result;
      });
  }

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }

  // ── Hover tooltip (desktop only) ─────────────────────────
  var tip = null;
  var hoverToken = 0;

  if (canHover) {
    tip = el('div',
      'position:fixed;z-index:10000;display:none;max-width:300px;background:#1f2c33;color:#e9edef;' +
      'border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 12px;font-size:13px;' +
      'line-height:1.45;box-shadow:0 6px 24px rgba(0,0,0,.45);pointer-events:none;');
    tip.appendChild(el('div', 'color:#f1c40f;font-weight:700;margin-bottom:4px;'));
    tip.appendChild(el('div', 'opacity:.85;'));
    document.body.appendChild(tip);

    document.addEventListener('mouseover', function (e) {
      var a = e.target.closest && e.target.closest(LINK_SELECTOR);
      if (!a) return;
      var p = parseLink(a.getAttribute('href'));
      if (!p) return;
      var token = ++hoverToken;
      tip.firstChild.textContent = p.book + ' ' + p.chapter + ':' + p.verse;
      tip.lastChild.textContent = 'Loading…';
      tip.style.display = 'block';
      fetchChapter(p.book, p.chapter).then(function (ch) {
        if (token !== hoverToken) return;
        var v = ch.verses.filter(function (x) { return x.verse === p.verse; })[0];
        tip.firstChild.textContent = ch.reference + ':' + p.verse;
        tip.lastChild.textContent = v ? v.text : 'Verse not found.';
      }).catch(function () {
        if (token === hoverToken) tip.lastChild.textContent = 'Preview unavailable. Tap to open.';
      });
    });

    document.addEventListener('mousemove', function (e) {
      if (!tip || tip.style.display !== 'block') return;
      var x = Math.min(e.clientX + 14, window.innerWidth - 320);
      var y = e.clientY + 18;
      if (y + tip.offsetHeight > window.innerHeight) y = e.clientY - tip.offsetHeight - 12;
      tip.style.left = Math.max(8, x) + 'px';
      tip.style.top = Math.max(8, y) + 'px';
    });

    document.addEventListener('mouseout', function (e) {
      var a = e.target.closest && e.target.closest(LINK_SELECTOR);
      if (!a) return;
      hoverToken++;
      tip.style.display = 'none';
    });
  }

  // ── In-app reader sheet ──────────────────────────────────
  var sheet = null;

  function closeSheet() {
    if (sheet) { sheet.remove(); sheet = null; }
  }

  function openReader(book, chapter, verse) {
    closeSheet();

    sheet = el('div',
      'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.6);display:flex;' +
      'align-items:flex-end;justify-content:center;');

    var card = el('div',
      'width:100%;max-width:560px;height:80vh;display:flex;flex-direction:column;background:#1f2c33;' +
      'color:#e9edef;border-radius:16px 16px 0 0;box-sizing:border-box;overflow:hidden;');

    var header = el('div',
      'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;' +
      'border-bottom:1px solid rgba(255,255,255,.08);');
    var title = el('div', 'font-size:16px;font-weight:700;color:#f1c40f;');
    var closeX = el('button',
      'background:none;border:none;color:#8696a0;font-size:22px;cursor:pointer;line-height:1;', '\u00D7');
    closeX.onclick = closeSheet;
    header.appendChild(title);
    header.appendChild(closeX);

    var body = el('div',
      'flex:1;overflow-y:auto;padding:14px 18px;font-size:15px;line-height:1.65;-webkit-overflow-scrolling:touch;');

    var footer = el('div',
      'display:flex;justify-content:space-between;gap:10px;padding:10px 14px;' +
      'border-top:1px solid rgba(255,255,255,.08);padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));');
    var btnCss = 'background:#2a3942;color:#e9edef;border:none;border-radius:16px;padding:8px 16px;' +
                 'font-size:13px;font-weight:700;cursor:pointer;';
    var prevBtn = el('button', btnCss, '\u2039 Previous chapter');
    var nextBtn = el('button', btnCss, 'Next chapter \u203A');
    footer.appendChild(prevBtn);
    footer.appendChild(nextBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    sheet.appendChild(card);
    document.body.appendChild(sheet);

    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });

    var current = { book: book, chapter: chapter };

    function show(b, ch, focusVerse) {
      current = { book: b, chapter: ch };
      title.textContent = b + ' ' + ch;
      body.innerHTML = '';
      body.appendChild(el('div', 'opacity:.7;', 'Loading…'));
      prevBtn.disabled = ch <= 1;
      prevBtn.style.opacity = ch <= 1 ? '.4' : '1';

      fetchChapter(b, ch).then(function (data) {
        title.textContent = data.reference;
        body.innerHTML = '';
        var target = null;
        data.verses.forEach(function (v) {
          var row = el('div', 'margin-bottom:10px;border-radius:8px;padding:2px 6px;');
          if (focusVerse && v.verse === focusVerse) {
            row.style.background = 'rgba(241,196,15,.15)';
            target = row;
          }
          row.appendChild(el('span', 'color:#f1c40f;font-weight:700;margin-right:6px;font-size:12px;', String(v.verse)));
          row.appendChild(el('span', '', v.text));
          body.appendChild(row);
        });
        if (target) target.scrollIntoView({ block: 'center' });
        else body.scrollTop = 0;
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
      }).catch(function () {
        body.innerHTML = '';
        body.appendChild(el('div', 'margin-bottom:12px;opacity:.8;',
          'Could not load this passage. Check your connection and try again.'));
        var retry = el('button', btnCss, 'Retry');
        retry.onclick = function () { show(b, ch, focusVerse); };
        body.appendChild(retry);
      });
    }

    prevBtn.onclick = function () {
      if (current.chapter > 1) show(current.book, current.chapter - 1, null);
    };
    nextBtn.onclick = function () {
      show(current.book, current.chapter + 1, null);
    };

    show(book, chapter, verse);
  }

  // ── Click: open reader instead of navigating ─────────────
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest(LINK_SELECTOR);
    if (!a) return;
    var p = parseLink(a.getAttribute('href'));
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    if (tip) tip.style.display = 'none';
    openReader(p.book, p.chapter, p.verse);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSheet();
  });
})();