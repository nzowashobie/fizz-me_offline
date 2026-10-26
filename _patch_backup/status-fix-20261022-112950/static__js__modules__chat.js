// ============================================================
// chat.js — Full chat module
// ============================================================

(function() {
  'use strict';

  // ── DOM refs ─────────────────────────────────────────────
  var convList          = document.getElementById('conversation-list');
  var chatContainer     = document.getElementById('id_chat_item_container');
  var msgInput          = document.getElementById('msg-input');
  var sendBtn           = document.getElementById('send-btn');
  var fileInput         = document.getElementById('file-input');
  var attachBtn         = document.getElementById('attach-btn');
  var backBtn           = document.getElementById('back-btn');
  var chatHeaderAvatar  = document.getElementById('chat-header-avatar');
  var chatHeaderInfo    = document.getElementById('chat-header-info');
  var gearBtn           = document.getElementById('gear-btn');
  var searchInput       = document.getElementById('contact-search');
  var attachmentPreview = document.getElementById('attachment-preview');
  var offlineBanner     = document.getElementById('offline-banner');

  if (fileInput) fileInput.multiple = true;

  var MAX_ATTACH = 30;
  var selectedFiles = [];

  var activeRecipient = State.activeRecipient || null;
  var lastMsgId       = 0;
  var oldestMsgId     = null;
  var isLoadingOlder  = false;
  var hasMoreOlder    = true;
  var errStreak       = 0;
  var pendingRead     = State.pendingRead || new Set();
  var isLoading       = false;

  var messageCache      = new Map();
  var loadingRecipients = new Set();

  var INITIAL_LIMIT   = 30;
  var LOAD_MORE_LIMIT = 20;

  var PROXY_BASE = '/api/status/proxy-media/?url=';

  function proxyUrl(url) {
    if (!url) return url;
    if (url.indexOf('res.cloudinary.com') !== -1 || url.indexOf('cloudinary.com') !== -1) {
      return PROXY_BASE + encodeURIComponent(url);
    }
    return url;
  }

  function _fzProxy(url) {
    if (!url) return '';
    var s = String(url);
    if (s.indexOf('res.cloudinary.com') !== -1 || s.indexOf('cloudinary.com') !== -1) {
      return PROXY_BASE + encodeURIComponent(s);
    }
    return s;
  }

  function isMobile() { return window.innerWidth <= 768; }

  function fmtTime(ts) { return window.fmtTime ? window.fmtTime(ts) : ''; }

  function linkify(text) {
    if (!text) return '';
    var escaped = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return escaped.replace(/(https?:\/\/[^\s]+)/g, function(match) {
      var display = match.length > 60 ? match.substring(0, 60) + '\u2026' : match;
      return '<a href="' + match + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent2);text-decoration:underline;">' + display + '</a>';
    });
  }

  function getCsrf() {
    var cookies = document.cookie.split('; ');
    for (var i = 0; i < cookies.length; i++) {
      if (cookies[i].indexOf('csrftoken=') === 0) return cookies[i].slice('csrftoken='.length);
    }
    return (window.ASTERIX && window.ASTERIX.CSRF) || '';
  }

  function downloadFile(url, filename) {
    if (window.AndroidBridge && typeof window.AndroidBridge.downloadFileExternally === 'function') {
      var routed = proxyUrl(url);
      var abs = routed.indexOf('/') === 0 ? (window.location.origin + routed) : routed;
      window.AndroidBridge.downloadFileExternally(abs, filename || 'download', '');
      return;
    }
    fetch(proxyUrl(url))
      .then(function(r) { if (!r.ok) throw new Error('fetch failed'); return r.blob(); })
      .then(function(blob) {
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function() { URL.revokeObjectURL(link.href); }, 100);
      })
      .catch(function() { window.open(proxyUrl(url), '_blank'); });
  }

  function downloadAttachments(attachments) {
    attachments.forEach(function(att) { downloadFile(att.file_url, att.file_name || 'download'); });
  }

  function openDocumentExternally(url, filename, mimeType) {
    if (window.AndroidBridge && typeof window.AndroidBridge.openFileExternally === 'function') {
      var routed = proxyUrl(url);
      var abs = routed.indexOf('/') === 0 ? (window.location.origin + routed) : routed;
      window.AndroidBridge.openFileExternally(abs, filename || 'file', mimeType || '');
      return;
    }
    var proxied = PROXY_BASE + encodeURIComponent(url);
    fetch(proxied)
      .then(function(r) { if (!r.ok) throw new Error('proxy ' + r.status); return r.blob(); })
      .then(function(blob) {
        var typedBlob = new Blob([blob], { type: mimeType || blob.type || 'application/octet-stream' });
        var objUrl = URL.createObjectURL(typedBlob);
        var win = window.open(objUrl, '_blank');
        setTimeout(function() { URL.revokeObjectURL(objUrl); }, 30000);
        if (!win) window.open(proxied, '_blank');
      })
      .catch(function() { window.open(proxied, '_blank'); });
  }

  function mimeForFile(a, cls) {
    var name = getDisplayName(a).toLowerCase();
    if (cls.isPdf)  return 'application/pdf';
    if (cls.isDocx) return name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/msword';
    if (cls.isXlsx) return name.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel';
    if (cls.isPptx) return name.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/vnd.ms-powerpoint';
    if (cls.isTxt)  return 'text/plain';
    return a.file_type || 'application/octet-stream';
  }

  function compressImage(file, maxSize, quality) {
    return new Promise(function(resolve) {
      if (!file.type || file.type.indexOf('image/') !== 0) {
        resolve({ blob: file, name: file.name, type: file.type }); return;
      }
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var canvas = document.createElement('canvas');
          var w = img.width, h = img.height;
          if (w > maxSize || h > maxSize) {
            if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
            else       { w = Math.round(w * maxSize / h); h = maxSize; }
          }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob(function(blob) {
            resolve({ blob: blob || file, name: file.name, type: 'image/jpeg' });
          }, 'image/jpeg', quality);
        };
        img.onerror = function() { resolve({ blob: file, name: file.name, type: file.type }); };
        img.src = e.target.result;
      };
      reader.onerror = function() { resolve({ blob: file, name: file.name, type: file.type }); };
      reader.readAsDataURL(file);
    });
  }

  function getDisplayName(att) {
    var raw = att.file_name || att.file_url || '';
    return raw.split('/').pop().split('\\').pop().split('?')[0] || 'File';
  }

  function classifyFile(att) {
    var ft   = (att.file_type || '').toLowerCase();
    var name = getDisplayName(att).toLowerCase();
    return {
      isImage: ft.indexOf('image/') === 0,
      isVideo: ft.indexOf('video/') === 0,
      isAudio: ft.indexOf('audio/') === 0,
      isPdf:   ft === 'application/pdf' || name.endsWith('.pdf'),
      isDocx:  name.endsWith('.doc')  || name.endsWith('.docx'),
      isXlsx:  name.endsWith('.xls')  || name.endsWith('.xlsx'),
      isPptx:  name.endsWith('.ppt')  || name.endsWith('.pptx'),
      isTxt:   name.endsWith('.txt')  || ft === 'text/plain',
      isZip:   name.endsWith('.zip')  || name.endsWith('.rar'),
    };
  }

  function fileIconAndColor(cls) {
    if (cls.isPdf)  return { icon: 'fa-file-pdf',        color: '#e74c3c' };
    if (cls.isDocx) return { icon: 'fa-file-word',       color: '#2b579a' };
    if (cls.isXlsx) return { icon: 'fa-file-excel',      color: '#217346' };
    if (cls.isPptx) return { icon: 'fa-file-powerpoint', color: '#d24726' };
    if (cls.isTxt)  return { icon: 'fa-file-alt',        color: '#e9edef' };
    if (cls.isZip)  return { icon: 'fa-file-archive',    color: '#795548' };
    return { icon: 'fa-file', color: '#aaa' };
  }

  function refreshThread() {
    if (State.activeRecipient && window.Asterix && window.Asterix.chat) {
      window.Asterix.chat.loadMessages(State.activeRecipient, true);
    }
  }

  function buildTransactionCard(msg) {
    if (window.Asterix && window.Asterix.negotiate) {
      return window.Asterix.negotiate.buildTransactionCard(msg);
    }
    var el = document.createElement('div');
    el.style.cssText = 'font-size:12px;color:rgba(255,255,255,.55);font-style:italic;';
    el.textContent = msg.message || '';
    return el;
  }

  // ── Bubble ───────────────────────────────────────────────
  function buildBubble(msg) {
    var isMe   = msg.sender === State.ME || msg.sender === 'me';
    var sender = msg.sender || msg.username || 'Unknown';
    var row    = document.createElement('div');
    row.className = 'msg-row ' + (isMe ? 'mine' : 'theirs');
    if (msg.id)        row.setAttribute('data-msg-id',    String(msg.id));
    if (msg.server_id) row.setAttribute('data-server-id', String(msg.server_id));
    if (msg.local_id)  row.setAttribute('data-local-id',  msg.local_id);

    var bub = document.createElement('div');
    bub.className = 'msg-bubble';

    if (msg.reply_to) {
      var quote    = document.createElement('div');
      quote.className = 'msg-quote';
      var qSender  = msg.reply_sender || 'Unknown';
      var qText    = msg.reply_text   || '';
      var mediaUrl = msg.reply_media  || '';
      var qContent = document.createElement('div');
      qContent.style.cssText = 'display:flex;align-items:center;gap:8px;';
      if (mediaUrl) {
        var pmu   = _fzProxy(mediaUrl);
        var thumb = document.createElement('div');
        thumb.style.cssText = 'flex-shrink:0;width:40px;height:40px;border-radius:4px;overflow:hidden;background:var(--mid);';
        var isVid = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(pmu);
        var isDoc = /\.(pdf|docx?|xlsx?|pptx?|zip|txt|csv)(\?|$)/i.test(pmu);
        if (isVid) {
          var qVid = document.createElement('video');
          qVid.src = pmu; qVid.style.cssText = 'width:100%;height:100%;object-fit:cover;'; qVid.muted = true;
          thumb.appendChild(qVid);
        } else if (isDoc) {
          thumb.style.display = 'none';
        } else {
          var qImg = document.createElement('img');
          qImg.src = pmu; qImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          qImg.onerror = function () { thumb.style.display = 'none'; };
          thumb.appendChild(qImg);
        }
        thumb.style.cursor = 'pointer';
        thumb.onclick = function (e) {
          e.stopPropagation();
          if (!(window.Asterix && window.Asterix.viewer)) return;
          var kind = isVid ? 'video' : 'image';
          window.Asterix.viewer.open(kind, pmu, qSender);
        };
        qContent.appendChild(thumb);
      }
      var textWrapper = document.createElement('div');
      textWrapper.style.cssText = 'flex:1;min-width:0;';
      textWrapper.innerHTML =
        '<span class="quote-sender" style="color:var(--accent2);font-weight:600;">' + qSender + '</span> ' +
        '<span class="quote-text" style="color:var(--text);">' + linkify(qText) + '</span>';
      qContent.appendChild(textWrapper);
      quote.appendChild(qContent);
      bub.appendChild(quote);
    }

    var meta = document.createElement('div');
    meta.className = 'msg-meta';
    var senderSpan = document.createElement('span');
    senderSpan.className = 'msg-sender';
    senderSpan.textContent = isMe ? 'You' : sender;
    var ts = document.createElement('span');
    ts.className = 'msg-ts';
    ts.textContent = fmtTime(msg.timestamp);
    meta.appendChild(senderSpan); meta.appendChild(ts);
    bub.appendChild(meta);

    if (msg.related_status && msg.related_status.is_commercial) {
      var rs = msg.related_status;
      var thumbSource = msg.reply_media || rs.media_url || '';
      if (thumbSource) {
        var pCard = document.createElement('div');
        pCard.style.cssText = 'display:flex;gap:9px;align-items:center;background:rgba(255,255,255,0.06);border-radius:10px;padding:8px 10px;margin-bottom:6px;border:1px solid rgba(255,255,255,0.1);max-width:260px;';
        var pThumbBox = document.createElement('div');
        pThumbBox.style.cssText = 'width:48px;height:48px;border-radius:7px;overflow:hidden;flex-shrink:0;background:var(--mid);';
        var pThumb = document.createElement('img');
        pThumb.src = _fzProxy(thumbSource);
        pThumb.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        pThumb.onerror = function() {
          if (rs.media_url && pThumb.src !== _fzProxy(rs.media_url)) {
            pThumb.src = _fzProxy(rs.media_url);
            return;
          }
          pThumbBox.innerHTML = '<i class="fas fa-tag" style="color:var(--sub);font-size:18px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;"></i>';
        };
        pThumbBox.appendChild(pThumb); pCard.appendChild(pThumbBox);
        var pInfo = document.createElement('div');
        pInfo.style.cssText = 'flex:1;min-width:0;';
        var pCaption = rs.caption ? rs.caption.slice(0, 45) + (rs.caption.length > 45 ? '…' : '') : 'Listing';
        var pPrice   = rs.price ? 'K' + parseFloat(rs.price).toLocaleString('en-ZM', {minimumFractionDigits:2}) : '';
        pInfo.innerHTML =
          '<div style="font-size:11px;color:#aaa;margin-bottom:2px;">📌 About this listing</div>' +
          '<div style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + pCaption + '</div>' +
          (pPrice ? '<div style="font-size:11px;color:#e6a817;font-weight:700;margin-top:1px;">' + pPrice + (rs.is_negotiable ? ' · negotiable' : '') + '</div>' : '');
        pCard.appendChild(pInfo); bub.appendChild(pCard);
      }
    }

    if (msg.message_type && msg.message_type !== 'text') {
      var card = buildTransactionCard(msg);
      if (card) bub.appendChild(card);
    } else if (msg.message) {
      var t = document.createElement('div');
      t.className = 'msg-text'; t.innerHTML = linkify(msg.message);
      bub.appendChild(t);
    }

    (msg.attachments || []).forEach(function(a) {
      var wrap        = document.createElement('div');
      wrap.className  = 'attachment-wrap';
      var cls         = classifyFile(a);
      var displayName = getDisplayName(a);

      if (cls.isImage) {
        var imgWrap = document.createElement('div');
        imgWrap.style.cssText = 'position:relative;display:inline-block;max-width:260px;border-radius:8px;overflow:hidden;background:var(--mid);';
        var img = document.createElement('img');
        img.src = _fzProxy(a.file_url); 
        img.style.cssText = 'width:100%;max-width:260px;max-height:320px;object-fit:cover;display:block;cursor:pointer;'; 
        img.loading = 'lazy';
        img.onclick = function(e) { e.stopPropagation(); if (window.Asterix && window.Asterix.viewer) window.Asterix.viewer.open('image', _fzProxy(a.file_url), displayName); else if (window.openZoom) window.openZoom('image', a.file_url); };
        var dlO = document.createElement('div');
        dlO.style.cssText = 'position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .2s;';
        dlO.innerHTML = '<i class="fas fa-download" style="color:#fff;font-size:14px;"></i>';
        dlO.onclick = function(e) { e.stopPropagation(); downloadFile(a.file_url, displayName); };
        imgWrap.onmouseenter = function() { dlO.style.opacity = '1'; };
        imgWrap.onmouseleave = function() { dlO.style.opacity = '0'; };
        imgWrap.appendChild(img); imgWrap.appendChild(dlO);
        wrap.appendChild(imgWrap); bub.appendChild(wrap); return;
      }

      if (cls.isVideo) {
        var vidWrap = document.createElement('div');
        vidWrap.style.cssText = 'position:relative;max-width:260px;border-radius:8px;overflow:hidden;background:var(--mid);';
        var video = document.createElement('video');
        video.src = _fzProxy(a.file_url); video.controls = true; video.preload = 'metadata';
        video.style.cssText = 'width:100%;max-width:260px;max-height:320px;object-fit:contain;background:#000;display:block;'; video.playsInline = true;
        var vidExp = document.createElement('div');
        vidExp.style.cssText = 'position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;';
        vidExp.innerHTML = '<i class="fas fa-expand" style="color:#fff;font-size:13px;"></i>';
        vidExp.onclick = function(e) { e.stopPropagation(); if (window.Asterix && window.Asterix.viewer) window.Asterix.viewer.open('video', _fzProxy(a.file_url), displayName); };
        vidWrap.appendChild(vidExp);
        vidWrap.appendChild(video);
        wrap.appendChild(vidWrap); bub.appendChild(wrap); return;
      }

      if (cls.isAudio) {
        var audio = document.createElement('audio');
        audio.src = _fzProxy(a.file_url);
        audio.style.display = 'none'; // Hide native player

        var audioUI = document.createElement('div');
        audioUI.style.cssText = 'display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border-radius:12px;padding:10px 14px;margin-top:4px;max-width:260px;';

        var iconBox = document.createElement('div');
        iconBox.innerHTML = '<i class="fas fa-music" style="color:#25d366;font-size:20px;"></i>';
        iconBox.style.cssText = 'flex-shrink:0;';

        var label = document.createElement('div');
        label.style.cssText = 'flex:1;font-size:13px;font-weight:600;color:var(--text);';
        label.textContent = 'Audio Message';

        var playBtn = document.createElement('button');
        playBtn.innerHTML = '<i class="fas fa-play" style="color:#fff;font-size:14px;"></i>';
        playBtn.style.cssText = 'background:var(--accent2);border:none;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;';

        var dlBtn = document.createElement('button');
        dlBtn.innerHTML = '<i class="fas fa-download" style="color:#fff;font-size:14px;"></i>';
        dlBtn.style.cssText = 'background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin-left:4px;';

        playBtn.onclick = function(e) {
          e.stopPropagation();
          if (audio.paused) {
            audio.play();
            playBtn.innerHTML = '<i class="fas fa-pause" style="color:#fff;font-size:14px;"></i>';
          } else {
            audio.pause();
            playBtn.innerHTML = '<i class="fas fa-play" style="color:#fff;font-size:14px;"></i>';
          }
        };

        audio.onended = function() {
          playBtn.innerHTML = '<i class="fas fa-play" style="color:#fff;font-size:14px;"></i>';
        };

        dlBtn.onclick = function(e) {
          e.stopPropagation();
          downloadFile(a.file_url, displayName);
        };

        audioUI.appendChild(iconBox);
        audioUI.appendChild(label);
        audioUI.appendChild(playBtn);
        audioUI.appendChild(dlBtn);

        wrap.appendChild(audioUI);
        wrap.appendChild(audio);
        bub.appendChild(wrap);
        return;
      }

      var pill = document.createElement('div');
      pill.className = 'file-pill';
      var ic = fileIconAndColor(cls);
      pill.innerHTML = '<i class="fas ' + ic.icon + '" style="color:' + ic.color + ';font-size:22px;flex-shrink:0;"></i>' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + displayName + '</span>' +
        '<i class="fas fa-download pill-dl" style="margin-left:8px;cursor:pointer;color:var(--accent2);flex-shrink:0;"></i>';
      pill.onclick = function(e) {
        if (e.target.classList.contains('pill-dl') || (e.target.closest && e.target.closest('.pill-dl'))) {
          e.stopPropagation(); downloadFile(a.file_url, displayName); return;
        }
        if (cls.isPdf && window.Asterix && window.Asterix.viewer) window.Asterix.viewer.open('pdf', _fzProxy(a.file_url), displayName);
        else openDocumentExternally(a.file_url, displayName, mimeForFile(a, cls));
      };
      wrap.appendChild(pill); bub.appendChild(wrap);
    });

    if (isMe) {
      var statusWrap = document.createElement('div');
      statusWrap.className = 'msg-status';
      statusWrap.style.cssText = 'display:flex;justify-content:flex-end;align-items:center;gap:4px;margin-top:4px;font-size:11px;color:var(--sub);width:100%;';
      
      if (msg.status === 'pending') {
        statusWrap.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:var(--accent2);"></i> Sending\u2026';
      } else if (msg.status === 'failed') {
        statusWrap.innerHTML = '<span style="color:#f15c6d;"><i class="fas fa-exclamation-circle"></i> Failed</span> ' +
          '<button class="msg-retry-btn" style="background:none;border:none;color:var(--accent2);cursor:pointer;font-size:11px;text-decoration:underline;">Retry</button>';
        statusWrap.querySelector('.msg-retry-btn').onclick = function(e) { e.stopPropagation(); retryMessage(msg.id || msg.local_id); };
      } else {
        // Server messages (sent or received)
        var tickClass = msg.is_read ? 'fa-check-double' : 'fa-check';
        var tickColor = msg.is_read ? '#25d366' : '#8696a0'; /* GREEN TICK */
        statusWrap.innerHTML = '<i class="fas ' + tickClass + ' read-tick" style="color:' + tickColor + '; font-size:12px;"></i>';
      }
      bub.appendChild(statusWrap);
    }

    bub.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      document.querySelectorAll('.ctx-menu').forEach(function(m) { m.remove(); });
      var menu = document.createElement('div');
      menu.className = 'ctx-menu';
      var options = [];
      if (msg.status !== 'pending' && msg.status !== 'failed')
        options.push({ label: '\uD83D\uDCAC Reply', action: function() { window.Asterix.chat.replyToMessage(msg); } });
      options.push({ label: '\uD83D\uDCCB Copy',    action: function() { navigator.clipboard && navigator.clipboard.writeText(msg.message || ''); } });
      options.push({ label: '\u2197\uFE0F Forward', action: function() { window.Asterix.chat.forwardMessage(msg); } });
      if (msg.attachments && msg.attachments.length)
        options.push({ label: '\u2B07\uFE0F Download', action: function() { downloadAttachments(msg.attachments); } });
      options.push({ label: '\uD83D\uDDD1\uFE0F Delete', action: function() { window.Asterix.chat.deleteMessage(msg.id || msg.server_id || msg.local_id); } });
      options.forEach(function(opt) {
        var d = document.createElement('div'); d.textContent = opt.label;
        d.onclick = function() { opt.action(); menu.remove(); };
        menu.appendChild(d);
      });
      var menuW = 180, menuH = options.length * 40 + 16, spaceBelow = window.innerHeight - e.clientY;
      var left = Math.min(e.clientX, window.innerWidth - menuW - 10);
      var top  = (spaceBelow < menuH && e.clientY > menuH) ? e.clientY - menuH - 10 : Math.min(e.clientY + 10, window.innerHeight - menuH - 10);
      menu.style.left = Math.max(10, left) + 'px'; menu.style.top = Math.max(10, top) + 'px';
      document.body.appendChild(menu);
      var close = function() { menu.remove(); document.removeEventListener('click', close); };
      setTimeout(function() { document.addEventListener('click', close); }, 0);
    });

    row.appendChild(bub);

    var startX = 0, startY = 0, isSwiping = false;
    row.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; startY = e.touches[0].clientY; isSwiping = false; }, { passive: true });
    row.addEventListener('touchmove', function(e) {
      if (!startX) return;
      var diffX = e.touches[0].clientX - startX, diffY = e.touches[0].clientY - startY;
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
        isSwiping = true;
        var translate = Math.min(Math.max(diffX, -100), 0);
        row.style.transform = 'translateX(' + translate + 'px)'; row.style.transition = 'none';
        var indicator = row.querySelector('.swipe-reply-indicator');
        if (!indicator) {
          indicator = document.createElement('div'); indicator.className = 'swipe-reply-indicator';
          indicator.textContent = '\u21A9\uFE0F'; row.style.position = 'relative'; row.appendChild(indicator);
        }
        indicator.style.opacity = String(Math.min(Math.abs(translate) / 100, 1));
      }
    }, { passive: true });
    row.addEventListener('touchend', function() {
      if (isSwiping) {
        var tx = parseFloat(row.style.transform.replace('translateX(', '')) || 0;
        if (tx < -40) window.Asterix.chat.replyToMessage(msg);
        row.style.transform = ''; row.style.transition = 'transform .3s ease';
        var indicator = row.querySelector('.swipe-reply-indicator');
        if (indicator) indicator.remove();
      }
      startX = 0; startY = 0; isSwiping = false;
    }, { passive: true });

    return row;
  }

  window.buildBubble = buildBubble;

  window.openZoom = function(type, url) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    var close = function() { document.body.removeChild(overlay); };
    overlay.addEventListener('click', close);
    if (type === 'image') {
      var img = document.createElement('img');
      img.src = _fzProxy(url); img.style.cssText = 'max-width:95vw;max-height:92vh;border-radius:6px;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,.7);';
      img.addEventListener('click', function(e) { e.stopPropagation(); }); overlay.appendChild(img);
    } else if (type === 'video') {
      var vid = document.createElement('video');
      vid.src = _fzProxy(url); vid.controls = true; vid.autoplay = true;
      vid.style.cssText = 'max-width:95vw;max-height:92vh;border-radius:6px;box-shadow:0 8px 40px rgba(0,0,0,.7);';
      vid.addEventListener('click', function(e) { e.stopPropagation(); }); overlay.appendChild(vid);
    }
    var onKey = function(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  };

  function retryMessage(localId) {
    if (!window.Sync) return;
    Sync.openDB().then(function(db) {
      var tx = db.transaction('messages', 'readwrite'), store = tx.objectStore('messages'), req = store.get(localId);
      req.onsuccess = function() {
        var msg = req.result; if (!msg) return;
        msg.status = 'pending'; store.put(msg);
        var row = document.querySelector('[data-local-id="' + localId + '"]');
        if (row) { var sw = row.querySelector('.msg-status'); if (sw) sw.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:var(--accent2);"></i> Sending\u2026'; }
        Sync.flushOutgoingQueue();
      };
    });
  }

  function loadOlderMessages() {
    if (isLoadingOlder || !hasMoreOlder || !oldestMsgId || !activeRecipient) return;
    isLoadingOlder = true;
    API.getMessages(activeRecipient, { before_id: oldestMsgId, limit: LOAD_MORE_LIMIT })
      .then(function(res) {
        if (!res.ok) throw new Error('Failed to load older messages');
        var msgs = res.data; if (!msgs.length) { hasMoreOlder = false; return; }
        var doRender = function(toRender) {
          var frag = document.createDocumentFragment();
          toRender.forEach(function(m) { frag.appendChild(buildBubble(m)); });
          var oldH = chatContainer.scrollHeight;
          chatContainer.insertBefore(frag, chatContainer.firstChild);
          chatContainer.scrollTop = chatContainer.scrollHeight - oldH + 50;
          oldestMsgId = toRender[0].id;
          if (toRender.length < LOAD_MORE_LIMIT) hasMoreOlder = false;
          if (window._currentMessages) window._currentMessages = toRender.concat(window._currentMessages);
          var cached = messageCache.get(activeRecipient) || [];
          messageCache.set(activeRecipient, toRender.concat(cached));
        };
        if (window.Sync) Sync.mergeMessages(activeRecipient, msgs).then(function() { doRender(msgs); });
        else doRender(msgs);
      })
      .catch(function() { toast('Error', 'Could not load older messages.'); })
      .finally(function() { isLoadingOlder = false; });
  }

  function fetchContactInfo(username) {
    return API.getContactInfo(username).then(function(res) { return res.ok ? res.data : null; }).catch(function() { return null; });
  }

  function updateOnlineStatus(recipient, info) {
    var subEl = document.querySelector('.chat-header-sub');
    if (subEl) {
      if (info && info.online) { 
        subEl.innerHTML = '<span style="color:#25d366;">\u25CF Online</span>'; 
      }
      else if (info && info.last_seen) {
        var diff = Math.round((new Date() - new Date(info.last_seen)) / 60000);
        var label = 'Last seen ';
        if      (diff < 1)    label += 'just now';
        else if (diff < 60)   label += diff + 'm ago';
        else if (diff < 1440) label += Math.round(diff / 60) + 'h ago';
        else                  label += Math.round(diff / 1440) + 'd ago';
        subEl.textContent = label;
      } else { subEl.textContent = 'tap for info'; }
    }
    
    var dot = document.getElementById('online-' + recipient);
    if (dot) {
      if (info && info.online) {
        dot.style.display = 'block';
        dot.style.background = '#25d366';
        dot.style.width = '12px';
        dot.style.height = '12px';
        dot.style.borderRadius = '50%';
        dot.style.position = 'absolute';
        dot.style.bottom = '0';
        dot.style.right = '0';
        dot.style.border = '2px solid var(--dark)';
        dot.style.zIndex = '10';
      } else {
        dot.style.display = 'none';
      }
    }
  }

  function isInCart(statusId) {
    return !!(window.Asterix && window.Asterix.cart && window.Asterix.cart.isInCart(statusId));
  }
  function toggleCartItem(statusId, statusObj) {
    if (!(window.Asterix && window.Asterix.cart)) {
      toast('Error', 'Basket module not available — make sure cart.js is loaded before chat.js.'); return;
    }
    window.Asterix.cart.toggle(statusObj);
  }

  function _hasDeclinedOffer(statusId, viewerName) {
    var msgs = window._currentMessages || [];
    for (var i = msgs.length - 1; i >= 0; i--) {
      var m = msgs[i];
      if (m.message_type !== 'offer' || !m.offer) continue;
      if (!m.related_status || m.related_status.status_id !== statusId) continue;
      if (m.offer.buyer !== viewerName) continue;
      if (m.offer.state === 'declined') return true;
      if (m.offer.state === 'pending' || m.offer.state === 'accepted') return false;
    }
    return false;
  }

  function renderAllListings() {
    var existing = chatHeaderInfo.querySelectorAll('.chat-product-banner-wrap');
    existing.forEach(function(el) { el.remove(); });

    var msgs = window._currentMessages || [];
    var statusMap = {};
    msgs.forEach(function(msg) {
      if (msg.related_status && msg.related_status.is_commercial) {
        var key = msg.related_status.status_id;
        if (!statusMap[key]) statusMap[key] = msg.related_status;
        else statusMap[key] = Object.assign({}, statusMap[key], msg.related_status);
        if (msg.reply_media && (
              msg.message_type === 'offer' ||
              msg.message_type === 'deal_confirmation' ||
              msg.message_type === 'status_update')) {
          statusMap[key]._latest_reply_media = msg.reply_media;
        }
      }
    });
    var statuses = Object.values(statusMap);
    if (!statuses.length) { setMarketThreadMode(false); return; }

    setMarketThreadMode(true);
    var me = State.ME;

    statuses.forEach(function(rs) { (function(rs) {
      var wrap = document.createElement('div');
      wrap.className = 'chat-product-banner-wrap';
      wrap.dataset.statusId = rs.status_id;

      var priceNum   = rs.price ? parseFloat(rs.price) : null;
      var priceText  = priceNum ? 'K' + priceNum.toLocaleString('en-ZM', { minimumFractionDigits: 2 }) : '';
      var avail      = (rs.availability || 'available').toLowerCase();
      var isSold     = avail === 'sold';
      var isReserved = avail === 'reserved';
      var isOwner    = rs.username === me;
      var hasDeclined = _hasDeclinedOffer(rs.status_id, me);

      var strip = document.createElement('div');
      strip.className = 'chat-product-strip';
      strip.style.cssText = 'display:flex;align-items:center;gap:9px;background:rgba(255,255,255,0.04);border-radius:10px;padding:6px 9px;margin-bottom:5px;border:1px solid rgba(255,255,255,0.07);';

      var selectWrap = document.createElement('div');
      selectWrap.style.cssText = 'flex-shrink:0;display:flex;align-items:center;';
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.className = 'listing-select-cb';
      checkbox.style.cssText = 'width:18px;height:18px;accent-color:#25d366;cursor:pointer;pointer-events:auto;';
      checkbox.checked  = isInCart(rs.status_id);
      checkbox.disabled = (isSold || isReserved || isOwner || hasDeclined);
      if (!checkbox.disabled) {
        checkbox.onchange = function() {
          var statusWithMedia = Object.assign({}, rs, {
            selectedMedia: rs._latest_reply_media ? { url: rs._latest_reply_media } : null,
          });
          toggleCartItem(rs.status_id, statusWithMedia);
        };
      }
      selectWrap.appendChild(checkbox); strip.appendChild(selectWrap);

      var thumbBox = document.createElement('div');
      thumbBox.style.cssText = 'width:38px;height:38px;border-radius:6px;overflow:hidden;background:var(--mid);flex-shrink:0;display:flex;align-items:center;justify-content:center;';
      var thumbSrc = rs._latest_reply_media || rs.media_url || '';
      if (thumbSrc) {
        var tImg = document.createElement('img');
        tImg.src = _fzProxy(thumbSrc);
        tImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        tImg.onerror = function() {
          if (rs.media_url && tImg.src !== _fzProxy(rs.media_url)) {
            tImg.src = _fzProxy(rs.media_url);
            return;
          }
          thumbBox.innerHTML = '<i class="fas fa-tag" style="color:var(--sub);font-size:15px;"></i>';
        };
        thumbBox.appendChild(tImg);
      } else {
        thumbBox.innerHTML = '<i class="fas fa-tag" style="color:var(--sub);font-size:15px;"></i>';
      }
      strip.appendChild(thumbBox);

      var stripInfo = document.createElement('div');
      stripInfo.style.cssText = 'flex:1;min-width:0;';
      var caption = rs.caption ? rs.caption.slice(0, 55) + (rs.caption.length > 55 ? '…' : '') : 'Listing';
      var statusLabel = isSold ? ' · ✅ Sold' : isReserved ? ' · ⏳ Reserved' : (rs.is_negotiable ? ' · negotiable' : '');
      stripInfo.innerHTML =
        '<div style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + caption + '</div>' +
        '<div style="font-size:11px;color:#e6a817;font-weight:600;margin-top:1px;">' + (priceText || '🏷️ Listing') + statusLabel + '</div>';
      strip.appendChild(stripInfo);

      if (rs.active_deal_id && !isOwner) {
        var payLabel = '💳 Pay' + (rs.final_price ? '  K' + parseFloat(rs.final_price).toLocaleString('en-ZM', {minimumFractionDigits:2}) : '');
        strip.appendChild(_mkBannerBtn(payLabel, 'banner-btn-pay', function() {
          if (window.Asterix && window.Asterix.payment) {
            window.Asterix.payment.open(
              rs.active_deal_id, rs.final_price || rs.price, me, rs.username,
              function() { refreshThread(); }
            );
          }
        }));
      } else if (isSold) {
        var soldBadge = document.createElement('span');
        soldBadge.style.cssText = 'font-size:10px;background:#444;color:#aaa;border-radius:8px;padding:3px 8px;flex-shrink:0;';
        soldBadge.textContent = 'SOLD'; strip.appendChild(soldBadge);
      } else if (isReserved) {
        var resBadge = document.createElement('span');
        resBadge.style.cssText = 'font-size:10px;background:rgba(230,168,23,0.2);color:#e6a817;border-radius:8px;padding:3px 8px;flex-shrink:0;';
        resBadge.textContent = 'Reserved'; strip.appendChild(resBadge);
      } else if (hasDeclined && !isOwner) {
        var declinedBadge = document.createElement('span');
        declinedBadge.style.cssText = 'font-size:10px;background:rgba(241,92,109,0.15);color:#f15c6d;border-radius:8px;padding:3px 8px;flex-shrink:0;';
        declinedBadge.textContent = '❌ Declined'; strip.appendChild(declinedBadge);

        strip.appendChild(_mkBannerBtn('🤝 New Offer', 'banner-btn-offer', function() {
          if (window.Asterix && window.Asterix.negotiate) {
            window.Asterix.negotiate.openOfferFromBanner(rs);
          } else {
            openChatCommercePanel(rs, 'offer');
          }
        }));
      } else if (!isOwner) {
        if (rs.is_negotiable) {
          strip.appendChild(_mkBannerBtn('🤝 Offer', 'banner-btn-offer', function() {
            if (window.Asterix && window.Asterix.negotiate) {
              window.Asterix.negotiate.openOfferFromBanner(rs);
            } else {
              openChatCommercePanel(rs, 'offer');
            }
          }));
        }
        strip.appendChild(_mkBannerBtn('🛒 Buy', 'banner-btn-buy', function() {
          if (window.Asterix && window.Asterix.checkout) {
            var sel = rs._latest_reply_media ? { url: rs._latest_reply_media } : null;
            window.Asterix.checkout.open(rs, sel, function() { refreshThread(); });
          } else {
            toast('Error', 'Checkout module not available.');
          }
        }));
      } else {
        var ownerBadge = document.createElement('span');
        ownerBadge.style.cssText = 'font-size:10px;background:rgba(37,211,102,0.15);color:#25d366;border-radius:8px;padding:3px 8px;flex-shrink:0;';
        ownerBadge.textContent = '📦 Your listing'; strip.appendChild(ownerBadge);
      }

      wrap.appendChild(strip);
      chatHeaderInfo.appendChild(wrap);
    })(rs); });
  }

  function _mkBannerBtn(label, cls, onClick) {
    var btn = document.createElement('button');
    btn.className = 'chat-banner-action-btn ' + cls;
    btn.style.cssText = [
      'border:none;border-radius:16px;padding:5px 12px;',
      'font-size:11px;font-weight:700;cursor:pointer;',
      'white-space:nowrap;flex-shrink:0;',
      'pointer-events:auto;position:relative;z-index:10;'
    ].join('');
    if (cls === 'banner-btn-buy')   { btn.style.background = '#25d366'; btn.style.color = '#000'; }
    if (cls === 'banner-btn-offer') { btn.style.background = '#e6a817'; btn.style.color = '#000'; }
    if (cls === 'banner-btn-pay')   { btn.style.background = '#2b8cff'; btn.style.color = '#fff'; }
    btn.innerHTML = label;
    btn.onclick = function(e) { e.stopPropagation(); onClick(); };
    return btn;
  }

  function openChatCommercePanel(rs, mode) {
    var old = document.getElementById('chat-commerce-panel');
    if (old) old.remove();
    if (mode === 'offer') {
      if (window.Asterix && window.Asterix.negotiate) {
        window.Asterix.negotiate.openOfferFromBanner(rs);
      }
      return;
    }
    var panel = document.createElement('div');
    panel.id = 'chat-commerce-panel';
    panel.style.cssText = 'position:absolute;bottom:100%;left:0;right:0;z-index:30;background:var(--card,#1e1e1e);border-top:1px solid rgba(255,255,255,0.1);border-radius:16px 16px 0 0;padding:16px;';
    panel.innerHTML = '<div style="font-size:13px;color:var(--sub);text-align:center;">Handled by the bargaining sheet.</div>';
    var inputBar = document.getElementById('chat-input-bar');
    if (inputBar) inputBar.appendChild(panel);
  }

  function setMarketThreadMode(on) {
    var area = document.getElementById('chat-area');
    if (area) area.classList[on ? 'add' : 'remove']('market-thread-mode');
    var nameEl = chatHeaderInfo.querySelector('.chat-header-name');
    if (!nameEl) return;
    var pill = nameEl.querySelector('.market-thread-pill');
    if (on && !pill) {
      pill = document.createElement('span'); pill.className = 'market-thread-pill'; pill.innerHTML = '🛒 Market';
      nameEl.appendChild(pill);
    } else if (!on && pill) { pill.remove(); }
  }

  function loadMessages(recipient, forceRefresh) {
    if (!recipient) return Promise.resolve();
    if (loadingRecipients.has(recipient)) return Promise.resolve();
    activeRecipient = recipient; State.activeRecipient = recipient;

    if (forceRefresh) {
      messageCache.delete(recipient);
      if (window._currentMessages && activeRecipient === recipient) {
        window._currentMessages = [];
      }
      if (window.Sync && typeof Sync.deleteMessagesForRecipient === 'function') {
        Sync.deleteMessagesForRecipient(recipient).catch(function() {});
      }
    }

    loadingRecipients.add(recipient);
    isLoading = true;
    try { chatContainer.classList.add('syncing'); } catch (e) {}
    chatHeaderInfo.innerHTML = '<div class="chat-header-name">' + recipient + '</div>' +
      '<div class="chat-header-sub" style="color:var(--accent2);"><i class="fas fa-spinner fa-spin"></i> Syncing\u2026</div>';
    oldestMsgId = null; hasMoreOlder = true; isLoadingOlder = false;
    var options = { limit: INITIAL_LIMIT };
    if (forceRefresh) options._t = Date.now();

    return API.getMessages(recipient, options)
      .then(function(res) {
        if (!res.ok) throw new Error((res.data && res.data.error) || 'Failed to load messages');
        var msgs = res.data;
        if (window.Sync) {
          return Sync.mergeMessages(recipient, msgs).then(function() { return msgs; });
        }
        return msgs;
      })
      .then(function(allMsgs) {
        renderMessages(recipient, allMsgs);
        messageCache.set(recipient, allMsgs);
        window._currentMessages = allMsgs;

        var latestServer = null;
        for (var i = allMsgs.length - 1; i >= 0; i--) {
          if (allMsgs[i].server_id) { latestServer = allMsgs[i]; break; }
        }
        lastMsgId = latestServer ? latestServer.server_id : 0;

        if (allMsgs.length) {
          oldestMsgId = allMsgs[0].id;
          hasMoreOlder = allMsgs.length >= INITIAL_LIMIT;
        } else {
          oldestMsgId = null;
          hasMoreOlder = false;
        }

        pendingRead.add(recipient);
        State.prevCounts[recipient] = 0;
        var badge = document.getElementById('unread-' + recipient);
        if (badge) {
          badge.textContent = '';
          badge.classList.remove('show', 'pop');
          badge.classList.add('hide');
          setTimeout(function() { badge.classList.remove('hide'); }, 300);
        }

        if (localStorage.getItem('asterix_read_receipts') !== 'false') {
          API.markAsRead(recipient);
          if (window.Sync) Sync.markAsRead(recipient);
        }
        setTimeout(function() { pendingRead.delete(recipient); }, 4000);

        var item = document.querySelector('.conversation-item[data-recipient="' + recipient + '"]');
        if (item) {
          var avatar = item.querySelector('.conv-avatar');
          chatHeaderAvatar.src = avatar ? avatar.src : '';
          chatHeaderAvatar.style.display = 'block';
          chatHeaderInfo.innerHTML = '<div class="chat-header-name">' + recipient + '</div><div class="chat-header-sub">tap for info</div>';
          gearBtn.style.display = 'flex';
        }

        setTimeout(function() { renderAllListings(); }, 0);

        fetch('/api/conversation-previews/').then(function(r) { return r.ok ? r.json() : {}; })
          .then(function(previews) { markMarketConversations(previews); }).catch(function() {});

        document.querySelectorAll('.conversation-item').forEach(function(i) { i.classList.remove('active'); });
        if (item) item.classList.add('active');

        hideSidebarOnMobile();
        if (!isMobile() && msgInput) msgInput.focus();
        fetchContactInfo(recipient).then(function(info) { if (info) updateOnlineStatus(recipient, info); });
        isLoading = false;
        errStreak = 0;
        return allMsgs;
      })
      .catch(function(e) {
        toast('Error', 'Could not load messages.');
        chatHeaderInfo.innerHTML = '<div class="chat-header-name">' + recipient + '</div><div class="chat-header-sub" style="color:#f15c6d;">Error loading</div>';
        isLoading = false;
        throw e;
      })
      .finally(function() { loadingRecipients.delete(recipient); try { chatContainer.classList.remove('syncing'); } catch (e) {} });
  }

  function hideSidebarOnMobile() {
    if (isMobile()) {
      var sidebar = document.getElementById('sidebar');
      if (sidebar) { sidebar.classList.add('hidden'); if (backBtn) backBtn.style.display = 'flex'; }
      var cp = document.getElementById('chat-commerce-panel'); if (cp) cp.remove();
    }
  }

  function renderMessages(recipient, msgs) {
    chatContainer.innerHTML = '';
    msgs.forEach(function(m) { chatContainer.appendChild(buildBubble(m)); });
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function clearCache(recipient) {
    if (recipient) {
      messageCache.delete(recipient);
      if (window._currentMessages && activeRecipient === recipient) {
        window._currentMessages = [];
      }
    } else {
      messageCache.clear();
      window._currentMessages = [];
    }
  }

  function replyToMessage(msg) {
    var replyId = msg.server_id || msg.id;
    if (!replyId) { toast('Cannot reply', 'This message is not yet delivered.'); return; }
    var sender = msg.sender === State.ME ? 'You' : (msg.sender || 'Unknown');
    var mediaUrl = '', mediaType = '', mediaIcon = '';
    if (msg.attachments && msg.attachments.length) {
      var att = msg.attachments[0]; mediaUrl = att.file_url; mediaType = att.file_type || '';
      if      (mediaType.indexOf('image/') === 0) mediaIcon = '\uD83D\uDCF7 Photo';
      else if (mediaType.indexOf('video/') === 0) mediaIcon = '\uD83C\uDFAC Video';
      else if (mediaType.indexOf('audio/') === 0) mediaIcon = '\uD83C\uDFB5 Audio';
      else                                        mediaIcon = '\uD83D\uDCCE File';
    } else if (msg.reply_media) {
      mediaUrl = msg.reply_media;
      if      (/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(mediaUrl)) mediaType = 'image/*';
      else if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(mediaUrl))          mediaType = 'video/*';
      mediaIcon = mediaType.indexOf('image/') === 0 ? '\uD83D\uDCF7 Photo' : mediaType.indexOf('video/') === 0 ? '\uD83C\uDFAC Video' : '\uD83D\uDCCE File';
    }
    var previewText = msg.message ? msg.message.substring(0, 80) : '';
    var existing = document.getElementById('_reply-banner'); if (existing) existing.remove();
    var bar = document.getElementById('chat-input-bar');
    var banner = document.createElement('div'); banner.id = '_reply-banner';
    var thumbHtml = '';
    if (mediaUrl) {
      var pmu2 = _fzProxy(mediaUrl);
      if (mediaType.indexOf('image/') === 0) thumbHtml = '<img src="' + pmu2 + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0;">';
      else if (mediaType.indexOf('video/') === 0) thumbHtml = '<video src="' + pmu2 + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0;" muted></video>';
      else thumbHtml = '';
    }
    banner.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;flex:1;overflow:hidden;">' + (thumbHtml || '') +
      '<div style="flex:1;overflow:hidden;"><div class="reply-sender">' + sender + '</div><div class="reply-preview">' + previewText + '</div></div></div>' +
      '<button id="_reply-cancel" style="background:none;border:none;color:#8696a0;font-size:18px;cursor:pointer;line-height:1;">\xD7</button>';
    bar.insertBefore(banner, bar.firstChild);
    document.getElementById('_reply-cancel').onclick = function() { banner.remove(); window._replyContext = null; };
    window._replyContext = { id: replyId, sender: sender, text: previewText, mediaUrl: mediaUrl, mediaType: mediaType };
    msgInput.focus(); msgInput.dispatchEvent(new Event('input'));
    var row = document.querySelector('[data-msg-id="' + msg.id + '"]') || document.querySelector('[data-server-id="' + msg.server_id + '"]') || document.querySelector('[data-local-id="' + msg.local_id + '"]');
    if (row) { var bub = row.querySelector('.msg-bubble'); if (bub) { bub.style.transition = 'background .2s'; bub.style.background = 'rgba(37,211,102,0.18)'; setTimeout(function() { bub.style.background = ''; }, 1800); } }
  }

  function deleteMessage(id) {
    var cached = messageCache.get(activeRecipient) || [], msg = null;
    for (var i = 0; i < cached.length; i++) {
      if (cached[i].id == id || cached[i].server_id == id || cached[i].local_id == id) { msg = cached[i]; break; }
    }
    if (!msg) {
      var row2 = document.querySelector('[data-msg-id="' + id + '"]') || document.querySelector('[data-local-id="' + id + '"]') || document.querySelector('[data-server-id="' + id + '"]');
      if (row2) { var sid = row2.getAttribute('data-server-id'); msg = sid ? { server_id: sid, local_id: id } : { local_id: id }; }
    }
    if (!msg) return;
    var row3 = document.querySelector('[data-msg-id="' + id + '"]') || document.querySelector('[data-local-id="' + id + '"]') || document.querySelector('[data-server-id="' + id + '"]');
    if (row3) row3.remove();
    var idx = -1;
    for (var j = 0; j < cached.length; j++) {
      if (cached[j].id == id || cached[j].server_id == id || cached[j].local_id == id) { idx = j; break; }
    }
    if (idx !== -1) { cached.splice(idx, 1); messageCache.set(activeRecipient, cached); }
    if (window.Sync) { var localId2 = msg.local_id || msg.id; if (localId2) Sync.deleteMessage(localId2).catch(function() {}); }
    var serverId = msg.server_id;
    if (serverId && /^\d+$/.test(String(serverId))) {
      if (window.Sync) Sync.queueDelete(serverId).catch(function() {});
      if (navigator.onLine) {
        API.deleteMessage(serverId).then(function(res) {
          if ((res.ok || res.status === 404) && window.Sync) {
            Sync.clearPendingDelete(serverId).catch(function() {});
          }
        }).catch(function() {});
      } else {
        toast('Offline', 'Message will be deleted when you reconnect.');
      }
    } else {
      toast('Deleted', 'Message removed locally.');
    }
  }

  // Shows progress inside the message bubble that is sending.
  function setBubbleStatus(localId, text, spinning) {
    var row = document.querySelector('[data-local-id="' + localId + '"]');
    var s = row && row.querySelector('.msg-status');
    if (!s) return;
    s.innerHTML = (spinning ? '<i class="fas fa-spinner fa-spin" style="color:var(--accent2);"></i> ' : '') + text;
  }

  function sendMessage() {
    var text = msgInput.value.trim();
    var fileList = Array.prototype.slice.call(selectedFiles || []);
    if (!activeRecipient) {
      var activeItem = document.querySelector('.conversation-item.active');
      if (activeItem) { activeRecipient = activeItem.getAttribute('data-recipient'); State.activeRecipient = activeRecipient; }
      if (!activeRecipient) { toast('No chat', 'Open a conversation first.'); return; }
    }
    if (!text && !fileList.length) return;

    var localId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    var localMsg = {
      id: localId, local_id: localId, sender: State.ME, recipient: activeRecipient,
      message: text, timestamp: new Date().toISOString(), is_read: false,
      status: 'pending', attachments: [], reply_to: null, reply_sender: '',
      reply_text: '', reply_media: ''
    };
    if (window._replyContext && window._replyContext.id) {
      localMsg.reply_to = window._replyContext.id;
      localMsg.reply_sender = window._replyContext.sender || '';
      localMsg.reply_text = window._replyContext.text || '';
      localMsg.reply_media = window._replyContext.mediaUrl || '';
    }
    var replyCtx = window._replyContext ? {
      id: window._replyContext.id,
      sender: window._replyContext.sender || '',
      text: window._replyContext.text || '',
      mediaUrl: window._replyContext.mediaUrl || ''
    } : null;

    if (window.Sync) Sync.saveMessage(localMsg);
    chatContainer.appendChild(buildBubble(localMsg));
    chatContainer.scrollTop = chatContainer.scrollHeight;
    resetInputs();
    if (!navigator.onLine) {
      toast('Offline', 'Message queued – will send when online.');
      return;
    }

    var compressed = new Array(fileList.length);
    var compressPromises = fileList.map(function(f, idx) {
      return compressImage(f, 1280, 0.8).then(function(r) { compressed[idx] = r; });
    });
    setBubbleStatus(localId, 'Preparing…', true);

    Promise.all(compressPromises).then(function() {
      var fd = new FormData();
      fd.append('recipient', activeRecipient);
      fd.append('message', text);
      if (replyCtx) {
        fd.append('reply_to', replyCtx.id);
        fd.append('reply_sender', replyCtx.sender);
        fd.append('reply_text', replyCtx.text);
        if (replyCtx.mediaUrl) fd.append('reply_media', replyCtx.mediaUrl);
        window._replyContext = null;
        var b2 = document.getElementById('_reply-banner');
        if (b2) b2.remove();
      }
      compressed.forEach(function(item) { fd.append('files', item.blob, item.name); });
      return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/messages/send/');
        xhr.setRequestHeader('X-CSRFToken', getCsrf());
        xhr.upload.onprogress = function(e) {
          if (e.lengthComputable && window.Asterix && window.Asterix.ui) {
            setBubbleStatus(localId, 'Uploading… ' + Math.round(e.loaded / e.total * 100) + '%', true);
          }
        };
        xhr.onload = function() {
          var res = { ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, rawText: xhr.responseText };
          try { res.data = JSON.parse(xhr.responseText); } catch(e) { res.data = { error: xhr.responseText || 'Server error' }; }
          resolve(res);
        };
        xhr.onerror = function() { reject(new Error('Network error')); };
        xhr.ontimeout = function() { reject(new Error('Upload timeout')); };
        xhr.timeout = 120000;
        xhr.send(fd);
      });
    }).then(function(res) {
      if (window.Asterix && window.Asterix.ui) window.Asterix.ui.hideSpinner();
      if (!res.ok) {
        var err = new Error((res.data && (res.data.message || res.data.error)) || res.rawText || 'Server error (' + res.status + ')');
        err.response = res; throw err;
      }
      if (res.data.status !== 'success') {
        var err2 = new Error((res.data && res.data.message) || 'Send failed');
        err2.response = res; throw err2;
      }
      var serverMsg = res.data.message;
      if (window.Sync) {
        var updatedMsg = {
          id: localId, local_id: localId, server_id: serverMsg.id,
          sender: serverMsg.sender, recipient: serverMsg.recipient,
          message: serverMsg.message, timestamp: serverMsg.timestamp,
          is_read: serverMsg.is_read, status: 'sent',
          attachments: serverMsg.attachments || [],
          reply_to: serverMsg.reply_to,
          reply_sender: serverMsg.reply_sender || '',
          reply_text: serverMsg.reply_text || '',
          reply_media: serverMsg.reply_media || '',
          profile_picture: serverMsg.profile_picture || '',
          related_status: serverMsg.related_status || null,
          offer: serverMsg.offer || null,
          deal: serverMsg.deal || null,
        };
        Sync.saveMessage(updatedMsg).then(function() {
          var row4 = document.querySelector('[data-local-id="' + localId + '"]');
          if (row4) {
            var nb = buildBubble(serverMsg);
            nb.setAttribute('data-server-id', serverMsg.id);
            nb.setAttribute('data-local-id', localId);
            row4.parentNode.replaceChild(nb, row4);
          }
          clearCache(activeRecipient);
        });
      } else {
        clearCache(activeRecipient);
        return loadMessages(activeRecipient, true);
      }
      if (typeof window.fetchConversationPreviews === 'function') {
        window.fetchConversationPreviews().then(window.applyConversationPreviews);
      }
    }).catch(function(e) {
      if (window.Asterix && window.Asterix.ui) window.Asterix.ui.hideSpinner();
      if (window.Sync) {
        Sync.updateMessageStatus(localId, 'failed');
        var row5 = document.querySelector('[data-local-id="' + localId + '"]');
        if (row5) {
          var bub2 = row5.querySelector('.msg-bubble'),
              sw2 = bub2 && bub2.querySelector('div:last-child');
          if (sw2 && sw2.style && sw2.style.fontSize === '11px') {
            sw2.innerHTML = '<span style="color:#f15c6d;"><i class="fas fa-exclamation-circle"></i> Failed</span> <button class="msg-retry-btn" style="background:none;border:none;color:var(--accent2);cursor:pointer;font-size:11px;text-decoration:underline;">Retry</button>';
            sw2.querySelector('.msg-retry-btn').onclick = function(ev) {
              ev.stopPropagation();
              retryMessage(localId);
            };
          }
        }
      }
      var errMsg = e.message || 'Unknown error';
      toast(navigator.onLine ? 'Send failed' : 'Offline', navigator.onLine ? errMsg : 'Message queued – will send when online.');
    });
  }

  function resetInputs() {
    msgInput.value = '';
    msgInput.style.height = '42px';
    fileInput.value = '';
    selectedFiles = [];
    attachmentPreview.innerHTML = '';
    sendBtn.classList.remove('show');
    msgInput.focus();
  }

  function clearChat() {
    var recipient = State.activeRecipient || activeRecipient;
    if (!recipient) { toast('No chat', 'Open a conversation first.'); return; }
    showConfirm({
      icon: '\uD83E\uDDF9',
      title: 'Clear Chat',
      body: 'Clear all messages with ' + recipient + ' from your device only?',
      okLabel: 'Clear for Me',
      okClass: 'danger'
    }).then(function(ok) {
      if (!ok) return;
      if (window.Asterix && window.Asterix.ui) window.Asterix.ui.showSpinner('Clearing chat…');
      chatContainer.innerHTML = '';
      clearCache(recipient);
      lastMsgId = 0; oldestMsgId = null; hasMoreOlder = true; isLoadingOlder = false;
      pendingRead.delete(recipient);

      var clearDB = Promise.resolve();
      if (window.Sync && typeof Sync.deleteMessagesForRecipient === 'function') {
        clearDB = Sync.deleteMessagesForRecipient(recipient);
      }
      clearDB.then(function() { return API.clearChat(recipient); })
      .then(function(res) {
        if (res.ok) {
          toast('\u2705', 'Chat cleared for you.');
          return loadMessages(recipient, true);
        } else {
          toast('Error', ((res.data && (res.data.error || res.data.message)) || res.rawText || 'Could not clear chat.'));
        }
      }).catch(function(e) {
        toast('Error', 'Failed to clear chat: ' + (e.message || 'unknown error'));
      }).finally(function() {
        if (window.Asterix && window.Asterix.ui) window.Asterix.ui.hideSpinner();
      });
    });
  }

  var forwardState = { message: null, selected: null, modal: null, list: null, sendBtn: null };

  function forwardMessage(msg) {
    var contacts = [];
    document.querySelectorAll('.conversation-item').forEach(function(item) {
      var u = item.getAttribute('data-recipient');
      if (u !== activeRecipient) {
        var av = item.querySelector('.conv-avatar');
        contacts.push({ username: u, avatar: av ? av.src : '' });
      }
    });
    var modal = document.getElementById('forward-modal'),
        list = document.getElementById('fwd-contacts-list'),
        sendBtn2 = document.getElementById('fwd-send-btn');
    if (!modal || !list || !sendBtn2) { toast('Error', 'Forward modal not available.'); return; }
    if (!contacts.length) { toast('No contacts', 'No other contacts to forward to.'); return; }
    list.innerHTML = contacts.map(function(c) {
      return '<div class="fwd-contact-item" data-username="' + c.username + '"><img class="fwd-avatar" src="' + c.avatar + '"> <span>' + c.username + '</span></div>';
    }).join('');
    forwardState.message = msg;
    forwardState.modal = modal;
    forwardState.list = list;
    forwardState.sendBtn = sendBtn2;
    forwardState.selected = null;
    sendBtn2.disabled = true;
    list.querySelectorAll('.fwd-contact-item').forEach(function(el) {
      el.addEventListener('click', function() {
        list.querySelectorAll('.fwd-contact-item').forEach(function(i) { i.classList.remove('selected'); });
        this.classList.add('selected');
        forwardState.selected = this.getAttribute('data-username');
        sendBtn2.disabled = false;
      });
    });
    modal.classList.add('open');
  }

  function _fwdResolve() {
    if (forwardState.modal) forwardState.modal.classList.remove('open');
    forwardState.selected = null;
    if (forwardState.sendBtn) forwardState.sendBtn.disabled = true;
  }

  function _fwdConfirm() {
    var username = forwardState.selected;
    if (!username) { toast('Error', 'Please select a contact.'); return; }
    var msg = forwardState.message;
    if (!msg) { toast('Error', 'No message to forward.'); return; }
    var fd = new FormData();
    fd.append('recipient', username);
    fd.append('message', msg.message || '');
    var ids = (msg.attachments || []).map(function(a) { return a.id; }).filter(Boolean);
    if (ids.length) fd.append('forward_attachment_ids', ids.join(','));
    if (window.Asterix && window.Asterix.ui) window.Asterix.ui.showSpinner('Forwarding…');
    API.sendMessage(fd).then(function(res) {
      if (window.Asterix && window.Asterix.ui) window.Asterix.ui.hideSpinner();
      if (res.ok && res.data.status === 'success') {
        toast('Forwarded', 'Message sent to ' + username);
        _fwdResolve();
      } else {
        toast('Error', (res.data && res.data.message) || 'Forward failed');
      }
    }).catch(function() {
      if (window.Asterix && window.Asterix.ui) window.Asterix.ui.hideSpinner();
      toast('Error', 'Forward failed');
    });
  }

  window.Asterix = window.Asterix || {};
  window.Asterix.messages = { _fwdResolve: _fwdResolve, _fwdConfirm: _fwdConfirm };

  function addConversationItem(contact) {
    if (!contact || !contact.username) return;
    var list = document.getElementById('conversation-list');
    if (!list) return;
    if (document.querySelector('.conversation-item[data-recipient="' + contact.username + '"]')) return;
    var item = document.createElement('div');
    item.className = 'conversation-item';
    item.setAttribute('data-recipient', contact.username);
    var avatarUrl = contact.profile_picture || '',
        initial = (contact.username || '?').charAt(0).toUpperCase();
    var bgColors = ['#e53935','#8e24aa','#1e88e5','#00897b','#f4511e','#6d4c41','#546e7a','#43a047'];
    var bgColor  = bgColors[contact.username.charCodeAt(0) % bgColors.length];
    item.innerHTML = '<div class="conv-avatar-wrapper"><div class="conv-avatar-init" style="background:' + bgColor + ';">' + initial + '</div>' + (avatarUrl ? '<img class="conv-avatar" src="' + avatarUrl + '" alt="' + contact.username + '">' : '') + '<span class="online-dot" id="online-' + contact.username + '" style="display:none;"></span></div><div class="conv-body"><div class="conv-name">' + contact.username + '</div><div class="conv-preview" id="preview-' + contact.username + '">Tap to open chat</div></div><span class="unread-badge" id="unread-' + contact.username + '"></span>';
    list.appendChild(item);
  }

  function openConversation(recipient) {
    var item = document.querySelector('.conversation-item[data-recipient="' + recipient + '"]');
    if (item) item.click();
  }

  function markMarketConversations(previewsMap) {
    if (!previewsMap) return;
    document.querySelectorAll('.conversation-item').forEach(function(item) {
      var recipient = item.getAttribute('data-recipient'),
          existing = item.querySelector('.market-conv-badge');
      if (previewsMap[recipient] && previewsMap[recipient].has_market_thread) {
        if (!existing) {
          var badge = document.createElement('span');
          badge.className = 'market-conv-badge';
          badge.textContent = '🛒';
          badge.title = 'Market conversation';
          item.insertBefore(badge, item.querySelector('.unread-badge') || null);
        }
        item.setAttribute('data-market', 'true');
      } else {
        if (existing) existing.remove();
        item.removeAttribute('data-market');
      }
    });
  }

  window.Asterix.chat = {
    loadMessages: loadMessages,
    sendMessage: sendMessage,
    replyToMessage: replyToMessage,
    forwardMessage: forwardMessage,
    deleteMessage: deleteMessage,
    addConversationItem: addConversationItem,
    openConversation: openConversation,
    clearCache: clearCache,
    clearChat: clearChat,
    markMarketConversations: markMarketConversations,
    renderAllListings: renderAllListings,
    refreshThread: refreshThread,
  };

  (function wireStatusHub() {
    var hub = document.getElementById('status-hub');
    if (!hub) return;
    hub.addEventListener('click', function(e) {
      var cat = e.target.closest('.status-cat');
      if (!cat) return;
      e.stopPropagation();
      if (cat.id === 'open-my-status-btn') {
        var s = window.Asterix && window.Asterix.status;
        if (s && typeof s.openMyStatus === 'function') { s.openMyStatus(); return; }
        return;
      }
      var catName = cat.getAttribute('data-category');
      if (!catName) return;
      var s = window.Asterix && window.Asterix.status;
      if (s && typeof s.open === 'function') { s.open(catName); return; }
    });
  })();

  if (convList) {
    convList.addEventListener('click', function(e) {
      var item = e.target.closest('.conversation-item');
      if (!item) return;
      var recipient = item.getAttribute('data-recipient');
      if (!recipient) return;
      document.querySelectorAll('.conversation-item').forEach(function(i) { i.classList.remove('active'); });
      item.classList.add('active');
      hideSidebarOnMobile();
      loadMessages(recipient);
    });
  }

  chatContainer.addEventListener('scroll', function() {
    if (this.scrollTop < 100) loadOlderMessages();
  });
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (msgInput) {
    msgInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    var typingTimeout = null;
  msgInput.addEventListener('input', function() {
      this.style.height = '42px';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      sendBtn.classList.toggle('show', this.value.trim().length > 0 || fileInput.files.length > 0);
      
      if (activeRecipient && this.value.trim().length > 0) {
        if (typingTimeout) clearTimeout(typingTimeout);
        if (API.sendTyping) API.sendTyping(activeRecipient);
        typingTimeout = setTimeout(function() { typingTimeout = null; }, 4000);
      }
  });

  function checkOnline() {
    if (activeRecipient) {
      fetchContactInfo(activeRecipient).then(function(info) {
        if (info) updateOnlineStatus(activeRecipient, info);
      });
    }
  }
  window.Asterix.chat.checkOnline = checkOnline;
  }
  if (attachBtn) attachBtn.addEventListener('click', function() { fileInput.click(); });

  if (fileInput) {
    fileInput.addEventListener('change', function() {
      var incoming = Array.prototype.slice.call(this.files);
      if (incoming.length) {
        selectedFiles = selectedFiles.concat(incoming).slice(0, MAX_ATTACH);
      }
      this.value = ''; // Reset input so same file can be selected again
      renderAttachmentPreviews();
    });
  }

  function renderAttachmentPreviews() {
    var prev = document.getElementById('attachment-preview');
    if (!prev) return;
    prev.innerHTML = '';
    
    selectedFiles.forEach(function(f, index) {
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative; display:inline-block; margin-right:6px; margin-bottom:6px;';
      
      if (f.type && f.type.startsWith('image/')) {
        var img = document.createElement('img');
        img.src = URL.createObjectURL(f);
        img.style.cssText = 'width:58px; height:58px; border-radius:6px; object-fit:cover; border:1px solid rgba(255,255,255,.15);';
        wrapper.appendChild(img);
      } else {
        var cls = classifyFile({ file_name: f.name, file_type: f.type });
        var ic = fileIconAndColor(cls);
        var p = document.createElement('div');
        p.className = 'att-pill';
        p.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:11px; background:rgba(255,255,255,.08); border-radius:12px; padding:4px 10px; color:var(--text); max-width:130px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; height:58px;';
        p.innerHTML = '<i class="fas ' + ic.icon + '" style="color:' + ic.color + '; font-size:16px;"></i> ' + f.name;
        wrapper.appendChild(p);
      }

      var delBtn = document.createElement('button');
      delBtn.innerHTML = '&times;';
      delBtn.style.cssText = 'position:absolute; top:-4px; right:-4px; background:#f15c6d; color:#fff; border:none; border-radius:50%; width:18px; height:18px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; line-height:1; box-shadow:0 2px 6px rgba(0,0,0,0.5);';
      delBtn.onclick = function(e) {
        e.stopPropagation();
        selectedFiles.splice(index, 1);
        renderAttachmentPreviews();
      };
      
      wrapper.appendChild(delBtn);
      prev.appendChild(wrapper);
    });

    sendBtn.classList.toggle('show', msgInput.value.trim().length > 0 || selectedFiles.length > 0);
  }

  if (backBtn) {
    backBtn.addEventListener('click', function() {
      var sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.classList.remove('hidden');
        backBtn.style.display = 'none';
        chatContainer.innerHTML = '';
        chatHeaderInfo.innerHTML = '<div class="no-chat-hint">Select a conversation to start chatting</div>';
        chatHeaderAvatar.style.display = 'none';
        if (gearBtn) gearBtn.style.display = 'none';
        setMarketThreadMode(false);
        document.querySelectorAll('.conversation-item').forEach(function(i) { i.classList.remove('active'); });
        activeRecipient = null;
        State.activeRecipient = null;
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      var q = this.value.toLowerCase();
      document.querySelectorAll('.conversation-item').forEach(function(i) {
        i.style.display = i.getAttribute('data-recipient').toLowerCase().indexOf(q) !== -1 ? '' : 'none';
      });
    });
  }

  document.addEventListener('fz-cart-changed', function(e) {
    var detail = e.detail || {};
    document.querySelectorAll('.chat-product-banner-wrap').forEach(function(wrap) {
      var cb = wrap.querySelector('.listing-select-cb');
      if (!cb) return;
      if (detail.action === 'cleared' || String(wrap.dataset.statusId) === String(detail.statusId)) {
        cb.checked = false;
      }
    });
  });

  window.addEventListener('online', function() {
    toast('Online', 'You are back online!');
    if (offlineBanner) offlineBanner.classList.remove('show');
    if (window.Sync) {
      Sync.flushOutgoingQueue();
      Sync.retryFailedMessages();
      Sync.flushPendingDeletes();
    }
    if (activeRecipient) loadMessages(activeRecipient, true);
  });
  window.addEventListener('offline', function() {
    toast('Offline', 'You are offline. Messages will be queued.');
    if (offlineBanner) offlineBanner.classList.add('show');
  });

  if (typeof pollLoop === 'function') pollLoop();
  
  // Ensure online status and typing updates independently of polling loop
  setInterval(function() {
    if (activeRecipient && window.Asterix && window.Asterix.chat && window.Asterix.chat.checkOnline) {
      window.Asterix.chat.checkOnline();
    }
  }, 5000);

  console.log('[Asterix] chat.js loaded — enquiry preserved + declined Buy hidden + media proxied');
})();