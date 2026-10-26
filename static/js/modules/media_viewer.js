(function () {
  'use strict';

  var css = document.createElement('style');
  css.textContent = '@keyframes fzvFade{from{opacity:0}to{opacity:1}}';
  document.head.appendChild(css);

  var overlay = null;

  function onKey(e) { if (e.key === 'Escape') close(); }

  function close() {
    if (overlay) { overlay.remove(); overlay = null; }
    document.removeEventListener('keydown', onKey);
  }

  function open(type, url, name) {
    close();
    overlay = document.createElement('div');
    overlay.id = 'fz-media-viewer';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:30000;background:rgba(0,0,0,.94);' +
      'display:flex;flex-direction:column;animation:fzvFade .15s ease;';

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 14px;color:#fff;flex-shrink:0;';

    var title = document.createElement('div');
    title.style.cssText = 'flex:1;min-width:0;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    title.textContent = name || '';

    var dl = document.createElement('a');
    dl.href = url; dl.download = name || ''; dl.target = '_blank'; dl.rel = 'noopener';
    dl.setAttribute('aria-label', 'Download');
    dl.style.cssText = 'color:#fff;font-size:18px;padding:6px;';
    dl.innerHTML = '<i class="fas fa-download"></i>';

    var x = document.createElement('button');
    x.setAttribute('aria-label', 'Close');
    x.style.cssText = 'background:none;border:none;color:#fff;font-size:20px;padding:6px;cursor:pointer;';
    x.innerHTML = '<i class="fas fa-times"></i>';
    x.onclick = close;

    bar.appendChild(title); bar.appendChild(dl); bar.appendChild(x);

    var stage = document.createElement('div');
    stage.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:8px;';

    if (type === 'image') {
      var img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
      stage.appendChild(img);
    } else if (type === 'video') {
      var v = document.createElement('video');
      v.src = url; v.controls = true; v.autoplay = true; v.playsInline = true;
      v.style.cssText = 'max-width:100%;max-height:100%;';
      stage.appendChild(v);
    } else {
      var f = document.createElement('iframe');
      f.src = url;
      f.style.cssText = 'width:100%;height:100%;border:0;background:#fff;';
      stage.appendChild(f);
    }

    stage.addEventListener('click', function (e) { if (e.target === stage) close(); });

    overlay.appendChild(bar);
    overlay.appendChild(stage);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
  }

  window.Asterix = window.Asterix || {};
  window.Asterix.viewer = { open: open, close: close };
})();
