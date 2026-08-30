// static/js/media-editor.js
// ============================================================
// Standalone image editor: draw, add text, and stamp stickers
// onto an image before sending — WhatsApp-style, plus a Zambia
// sticker pack. Self-contained: own DOM, own CSS, own state.
// Public API: window.Asterix.mediaEditor.openForImage(file)
//             -> Promise<File|null>  (null = user cancelled)
// ============================================================

(function() {
  'use strict';

  if (window.Asterix && window.Asterix.mediaEditor) return; // already loaded

  var MAX_DIM = 1280; // matches chat.js's own compressImage() ceiling —
                       // keeps exported files small, which matters a lot
                       // on the data costs most people actually pay here.

  // Zambian flag colors (green, red, orange/copper, black) plus white,
  // as the default draw/text palette instead of WhatsApp's generic set.
  var PALETTE = ['#000000', '#FFFFFF', '#198A00', '#EF3340', '#DE7C1F', '#1C64F2'];

  var EMOJI = ['😂','❤️','🔥','👏','🙏','😍','😮','😢','🎉','💯','👍','😅','🤝','✨','😎','🥳'];

  // A little local flavor instead of only WhatsApp's Western-default set —
  // short Bemba/Nyanja greetings and Zambian symbols, stamped as pill
  // badges rather than plain emoji so they read clearly at a glance.
  var ZAMBIA_STICKERS = [
    { text: '🇿🇲 Zed',           bg: '#198A00' },
    { text: 'Mwapoleni! 🙌',      bg: '#EF3340' },
    { text: 'Muli bwanji? ☀️',    bg: '#DE7C1F' },
    { text: 'Zikomo 🙏',          bg: '#198A00' },
    { text: 'Sharp sharp 👌',     bg: '#1C64F2' },
    { text: '🥁 Vibes',           bg: '#EF3340' },
    { text: 'One Zambia 🌍',      bg: '#000000' },
    { text: 'Chikondi ❤️',        bg: '#DE7C1F' },
  ];

  // ── Styles (injected once) ──────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('media-editor-style')) return;
    var style = document.createElement('style');
    style.id = 'media-editor-style';
    style.textContent = [
      '#media-editor-overlay{position:fixed;inset:0;z-index:100000;background:#000;',
        'display:flex;flex-direction:column;color:#fff;font-family:inherit;}',
      '#me-topbar{display:flex;align-items:center;justify-content:space-between;',
        'padding:10px 14px;background:rgba(0,0,0,0.55);flex-shrink:0;}',
      '#me-topbar button{background:none;border:none;color:#fff;font-size:20px;',
        'padding:8px;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;}',
      '#me-topbar button:active{background:rgba(255,255,255,0.15);}',
      '#me-done{background:#25d366 !important;width:40px;height:40px;font-size:16px;}',
      '#me-canvas-wrap{flex:1;display:flex;align-items:center;justify-content:center;',
        'overflow:hidden;position:relative;touch-action:none;}',
      '#me-canvas{max-width:100%;max-height:100%;touch-action:none;background:#111;}',
      '#me-toolbar{display:flex;align-items:center;justify-content:center;gap:22px;',
        'padding:12px 14px;background:rgba(0,0,0,0.55);flex-shrink:0;}',
      '#me-toolbar button{background:none;border:none;color:#fff;font-size:19px;',
        'opacity:0.75;cursor:pointer;padding:8px;border-radius:50%;}',
      '#me-toolbar button.active{opacity:1;background:rgba(255,255,255,0.18);}',
      '#me-subbar{display:flex;align-items:center;justify-content:center;gap:10px;',
        'padding:8px 14px;background:rgba(0,0,0,0.4);flex-shrink:0;flex-wrap:wrap;}',
      '.me-swatch{width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,0.5);cursor:pointer;flex-shrink:0;}',
      '.me-swatch.active{border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,0.9);}',
      '.me-size{width:14px;height:14px;border-radius:50%;background:#fff;cursor:pointer;opacity:0.5;flex-shrink:0;}',
      '.me-size.active{opacity:1;box-shadow:0 0 0 2px rgba(255,255,255,0.9);}',
      '#me-sticker-panel{position:absolute;left:0;right:0;bottom:0;max-height:45%;',
        'background:rgba(20,20,20,0.96);overflow-y:auto;padding:12px;box-sizing:border-box;}',
      '#me-sticker-tabs{display:flex;gap:16px;margin-bottom:10px;}',
      '#me-sticker-tabs button{background:none;border:none;color:rgba(255,255,255,0.6);',
        'font-size:13px;font-weight:600;padding:4px 0;cursor:pointer;border-bottom:2px solid transparent;}',
      '#me-sticker-tabs button.active{color:#fff;border-bottom-color:#25d366;}',
      '#me-sticker-grid{display:flex;flex-wrap:wrap;gap:10px;}',
      '.me-emoji-btn{font-size:26px;background:none;border:none;cursor:pointer;padding:4px;}',
      '.me-zed-btn{border:none;border-radius:16px;color:#fff;font-size:13px;font-weight:600;',
        'padding:8px 14px;cursor:pointer;white-space:nowrap;}',
      '#me-text-input{position:absolute;background:transparent;border:1px dashed rgba(255,255,255,0.6);',
        'color:#fff;font-size:28px;font-weight:600;outline:none;resize:none;overflow:hidden;',
        'padding:2px 4px;min-width:40px;text-shadow:0 1px 3px rgba(0,0,0,0.8);}',
    ].join('');
    document.head.appendChild(style);
  }

  function openForImage(file) {
    return new Promise(function(resolve) {
      injectStyles();

      var img = new Image();
      var objUrl = URL.createObjectURL(file);

      img.onload = function() {
        buildEditor(img, file, objUrl, resolve);
      };
      img.onerror = function() {
        URL.revokeObjectURL(objUrl);
        resolve(null);
      };
      img.src = objUrl;
    });
  }

  function buildEditor(img, originalFile, objUrl, resolve) {
    // ── Working canvas sized down to MAX_DIM, matching chat.js's own
    // compression ceiling so edited images stay just as data-light as
    // unedited ones.
    var w = img.width, h = img.height;
    if (w > MAX_DIM || h > MAX_DIM) {
      if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
      else       { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
    }

    var overlay = document.createElement('div');
    overlay.id = 'media-editor-overlay';

    var topbar = document.createElement('div');
    topbar.id = 'me-topbar';
    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.setAttribute('aria-label', 'Discard changes');
    var undoBtn = document.createElement('button');
    undoBtn.innerHTML = '<i class="fas fa-undo"></i>';
    undoBtn.setAttribute('aria-label', 'Undo');
    var doneBtn = document.createElement('button');
    doneBtn.id = 'me-done';
    doneBtn.innerHTML = '<i class="fas fa-check"></i>';
    doneBtn.setAttribute('aria-label', 'Save');
    topbar.appendChild(closeBtn);
    topbar.appendChild(undoBtn);
    topbar.appendChild(doneBtn);

    var canvasWrap = document.createElement('div');
    canvasWrap.id = 'me-canvas-wrap';
    var canvas = document.createElement('canvas');
    canvas.id = 'me-canvas';
    canvas.width = w;
    canvas.height = h;
    canvasWrap.appendChild(canvas);

    var toolbar = document.createElement('div');
    toolbar.id = 'me-toolbar';
    var drawBtn = makeToolBtn('fa-pencil-alt', 'Draw');
    var textBtn = makeToolBtn('fa-font', 'Add text');
    var stickerBtn = makeToolBtn('fa-icons', 'Stickers');
    toolbar.appendChild(drawBtn);
    toolbar.appendChild(textBtn);
    toolbar.appendChild(stickerBtn);

    var subbar = document.createElement('div');
    subbar.id = 'me-subbar';
    subbar.style.display = 'none';

    overlay.appendChild(topbar);
    overlay.appendChild(canvasWrap);
    overlay.appendChild(subbar);
    overlay.appendChild(toolbar);
    document.body.appendChild(overlay);

    function makeToolBtn(icon, label) {
      var b = document.createElement('button');
      b.innerHTML = '<i class="fas ' + icon + '"></i>';
      b.setAttribute('aria-label', label);
      return b;
    }

    // ── State ──────────────────────────────────────────────────────
    var ctx = canvas.getContext('2d');
    var layers = []; // {type:'stroke'|'text'|'sticker', ...}
    var mode = 'none'; // 'draw' | 'text' | 'sticker' | 'none'
    var drawColor = PALETTE[0];
    var brushSize = 6;
    var currentStroke = null;
    var draggingLayer = null;
    var dragOffset = { x: 0, y: 0 };

    function redraw() {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      layers.forEach(drawLayer);
    }

    function drawLayer(layer) {
      if (layer.type === 'stroke') {
        if (layer.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = layer.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(layer.points[0].x, layer.points[0].y);
        for (var i = 1; i < layer.points.length; i++) {
          ctx.lineTo(layer.points[i].x, layer.points[i].y);
        }
        ctx.stroke();
      } else if (layer.type === 'text') {
        ctx.font = '600 ' + layer.fontSize + 'px sans-serif';
        ctx.fillStyle = layer.color;
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
        ctx.fillText(layer.text, layer.x, layer.y);
        ctx.shadowBlur = 0;
        layer._w = ctx.measureText(layer.text).width;
        layer._h = layer.fontSize * 1.2;
      } else if (layer.type === 'sticker') {
        ctx.font = '600 ' + layer.fontSize + 'px sans-serif';
        var metrics = ctx.measureText(layer.text);
        var padX = 14, padY = 8;
        var boxW = metrics.width + padX * 2;
        var boxH = layer.fontSize + padY * 2;
        layer._w = boxW;
        layer._h = boxH;
        ctx.fillStyle = layer.bg;
        roundRect(ctx, layer.x, layer.y, boxW, boxH, boxH / 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.fillText(layer.text, layer.x + padX, layer.y + boxH / 2 + 1);
      }
    }

    function roundRect(c, x, y, width, height, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + width, y, x + width, y + height, r);
      c.arcTo(x + width, y + height, x, y + height, r);
      c.arcTo(x, y + height, x, y, r);
      c.arcTo(x, y, x + width, y, r);
      c.closePath();
    }

    function hitTest(x, y) {
      for (var i = layers.length - 1; i >= 0; i--) {
        var l = layers[i];
        if (l.type === 'stroke') continue; // strokes aren't draggable
        var lw = l._w || 60, lh = l._h || 30;
        if (x >= l.x && x <= l.x + lw && y >= l.y - 4 && y <= l.y + lh) return l;
      }
      return null;
    }

    // ── Canvas coordinate helper (CSS px -> canvas px) ───────────────
    function toCanvasPoint(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (w / rect.width),
        y: (clientY - rect.top) * (h / rect.height)
      };
    }

    // ── Tool switching ────────────────────────────────────────────
    function setMode(next) {
      mode = next;
      [drawBtn, textBtn, stickerBtn].forEach(function(b) { b.classList.remove('active'); });
      subbar.innerHTML = '';
      subbar.style.display = 'none';

      if (next === 'draw') {
        drawBtn.classList.add('active');
        subbar.style.display = 'flex';
        PALETTE.forEach(function(c) {
          var sw = document.createElement('div');
          sw.className = 'me-swatch' + (c === drawColor ? ' active' : '');
          sw.style.background = c;
          sw.onclick = function() {
            drawColor = c;
            subbar.querySelectorAll('.me-swatch').forEach(function(s) { s.classList.remove('active'); });
            sw.classList.add('active');
          };
          subbar.appendChild(sw);
        });
        [3, 6, 12].forEach(function(sz) {
          var dot = document.createElement('div');
          dot.className = 'me-size' + (sz === brushSize ? ' active' : '');
          dot.style.width = dot.style.height = (8 + sz) + 'px';
          dot.onclick = function() {
            brushSize = sz;
            subbar.querySelectorAll('.me-size').forEach(function(s) { s.classList.remove('active'); });
            dot.classList.add('active');
          };
          subbar.appendChild(dot);
        });
      } else if (next === 'text') {
        textBtn.classList.add('active');
        subbar.style.display = 'flex';
        PALETTE.forEach(function(c) {
          var sw = document.createElement('div');
          sw.className = 'me-swatch' + (c === drawColor ? ' active' : '');
          sw.style.background = c;
          sw.onclick = function() {
            drawColor = c;
            subbar.querySelectorAll('.me-swatch').forEach(function(s) { s.classList.remove('active'); });
            sw.classList.add('active');
          };
          subbar.appendChild(sw);
        });
      } else if (next === 'sticker') {
        stickerBtn.classList.add('active');
        openStickerPanel();
      }
    }

    function openStickerPanel() {
      var panel = document.createElement('div');
      panel.id = 'me-sticker-panel';

      var tabs = document.createElement('div');
      tabs.id = 'me-sticker-tabs';
      var emojiTab = document.createElement('button');
      emojiTab.textContent = 'Emoji';
      emojiTab.className = 'active';
      var zedTab = document.createElement('button');
      zedTab.textContent = 'Zambia \uD83C\uDDFF\uD83C\uDDF2';
      tabs.appendChild(emojiTab);
      tabs.appendChild(zedTab);

      var grid = document.createElement('div');
      grid.id = 'me-sticker-grid';

      function renderEmoji() {
        grid.innerHTML = '';
        EMOJI.forEach(function(e) {
          var b = document.createElement('button');
          b.className = 'me-emoji-btn';
          b.textContent = e;
          b.onclick = function() { placeSticker(e, null); closeStickerPanel(); };
          grid.appendChild(b);
        });
      }
      function renderZed() {
        grid.innerHTML = '';
        ZAMBIA_STICKERS.forEach(function(s) {
          var b = document.createElement('button');
          b.className = 'me-zed-btn';
          b.style.background = s.bg;
          b.textContent = s.text;
          b.onclick = function() { placeSticker(s.text, s.bg); closeStickerPanel(); };
          grid.appendChild(b);
        });
      }
      emojiTab.onclick = function() {
        emojiTab.classList.add('active'); zedTab.classList.remove('active'); renderEmoji();
      };
      zedTab.onclick = function() {
        zedTab.classList.add('active'); emojiTab.classList.remove('active'); renderZed();
      };
      renderEmoji();

      panel.appendChild(tabs);
      panel.appendChild(grid);
      overlay.appendChild(panel);

      function closeStickerPanel() {
        panel.remove();
        setMode('none');
      }
      panel._close = closeStickerPanel;
    }

    function placeSticker(text, bg) {
      var layer = bg
        ? { type: 'sticker', text: text, bg: bg, fontSize: 20, x: w / 2 - 60, y: h / 2 - 20 }
        : { type: 'text', text: text, color: '#fff', fontSize: 44, x: w / 2 - 22, y: h / 2 - 22 };
      layers.push(layer);
      redraw();
    }

    // ── Draw / drag interaction ──────────────────────────────────
    canvas.addEventListener('pointerdown', function(e) {
      var p = toCanvasPoint(e.clientX, e.clientY);

      if (mode === 'draw') {
        currentStroke = { type: 'stroke', color: drawColor, size: brushSize, points: [p] };
        layers.push(currentStroke);
        return;
      }

      if (mode === 'text') {
        placeTextInput(p);
        setMode('none');
        return;
      }

      // 'none' mode — try to grab an existing text/sticker to drag
      var hit = hitTest(p.x, p.y);
      if (hit) {
        draggingLayer = hit;
        dragOffset.x = p.x - hit.x;
        dragOffset.y = p.y - hit.y;
      }
    });

    canvas.addEventListener('pointermove', function(e) {
      var p = toCanvasPoint(e.clientX, e.clientY);
      if (mode === 'draw' && currentStroke) {
        currentStroke.points.push(p);
        redraw();
      } else if (draggingLayer) {
        draggingLayer.x = p.x - dragOffset.x;
        draggingLayer.y = p.y - dragOffset.y;
        redraw();
      }
    });

    function endInteraction() {
      currentStroke = null;
      draggingLayer = null;
    }
    canvas.addEventListener('pointerup', endInteraction);
    canvas.addEventListener('pointerleave', endInteraction);

    function placeTextInput(point) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = rect.width / w;
      var input = document.createElement('textarea');
      input.id = 'me-text-input';
      input.rows = 1;
      input.style.left = (rect.left + point.x * scaleX) + 'px';
      input.style.top = (rect.top + point.y * (rect.height / h)) + 'px';
      input.style.color = drawColor;
      document.body.appendChild(input);
      input.focus();

      function commit() {
        var text = input.value.trim();
        input.remove();
        if (!text) return;
        layers.push({ type: 'text', text: text, color: drawColor, fontSize: 32, x: point.x, y: point.y });
        redraw();
      }
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = ''; input.blur(); }
      });
    }

    // ── Toolbar wiring ────────────────────────────────────────────
    drawBtn.onclick = function() { setMode(mode === 'draw' ? 'none' : 'draw'); };
    textBtn.onclick = function() { setMode(mode === 'text' ? 'none' : 'text'); };
    stickerBtn.onclick = function() { setMode(mode === 'sticker' ? 'none' : 'sticker'); };

    undoBtn.onclick = function() {
      layers.pop();
      redraw();
    };

    function cleanup() {
      overlay.remove();
      URL.revokeObjectURL(objUrl);
    }

    closeBtn.onclick = function() {
      cleanup();
      resolve(null);
    };

    doneBtn.onclick = function() {
      redraw(); // ensure the very latest state is flattened
      canvas.toBlob(function(blob) {
        cleanup();
        if (!blob) { resolve(null); return; }
        var editedFile = new File([blob], originalFile.name, { type: 'image/jpeg' });
        resolve(editedFile);
      }, 'image/jpeg', 0.9);
    };

    redraw();
  }

  window.Asterix = window.Asterix || {};
  window.Asterix.mediaEditor = { openForImage: openForImage };

  console.log('[Asterix] Media editor module loaded');
})();
