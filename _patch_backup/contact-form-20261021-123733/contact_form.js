(function () {
  'use strict';
  if (window.__fzContactForm) return;
  window.__fzContactForm = true;

  var hasPicker = !!(navigator.contacts && navigator.contacts.select);
  var PALETTE = ['#00a884', '#7c5cff', '#e67e22', '#2e86de', '#e84393', '#16a085', '#d35400', '#8e44ad'];

  var css = document.createElement('style');
  css.textContent = [
    '#cf-screen{position:fixed;inset:0;z-index:30700;background:#111b21;color:#e9edef;display:flex;flex-direction:column;font-family:Segoe UI,system-ui,Arial,sans-serif;animation:cfIn .2s ease;}',
    '@keyframes cfIn{from{transform:translateX(28px);opacity:0}to{transform:none;opacity:1}}',
    '.cf-top{display:flex;align-items:center;gap:18px;height:60px;padding:0 14px 0 10px;background:#202c33;flex-shrink:0;box-shadow:0 1px 0 rgba(255,255,255,.04);}',
    '.cf-back{background:none;border:0;color:#aebac1;font-size:18px;width:38px;height:38px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
    '.cf-back:hover{background:rgba(255,255,255,.06);}',
    '.cf-title{flex:1;font-size:19px;font-weight:600;color:#e9edef;}',
    '.cf-save{background:none;border:0;color:#00a884;font-size:15px;font-weight:700;cursor:pointer;padding:8px 6px;}',
    '.cf-save:disabled{color:#3b4a54;cursor:default;}',
    '.cf-body{flex:1;overflow-y:auto;padding-bottom:calc(24px + env(safe-area-inset-bottom,0px));}',
    '.cf-row{display:flex;align-items:center;gap:16px;padding:14px 18px;cursor:pointer;transition:background .12s;}',
    '.cf-row:hover,.cf-row:active{background:rgba(255,255,255,.04);}',
    '.cf-ico{width:44px;height:44px;border-radius:50%;background:#00a884;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}',
    '.cf-rt{font-size:16px;color:#e9edef;}',
    '.cf-rs{font-size:13px;color:#8696a0;margin-top:2px;}',
    '.cf-div{height:1px;background:rgba(134,150,160,.14);margin-left:78px;}',
    '.cf-section{padding:18px 18px 4px;}',
    '.cf-label{font-size:13px;font-weight:600;color:#00a884;margin-bottom:10px;}',
    '.cf-phone{display:flex;align-items:center;gap:12px;border-bottom:2px solid #2a3942;padding-bottom:6px;transition:border-color .15s;}',
    '.cf-phone:focus-within{border-bottom-color:#00a884;}',
    '.cf-cc{font-size:16px;color:#e9edef;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.05);white-space:nowrap;}',
    '.cf-phone input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#e9edef;font-size:17px;padding:6px 0;font-family:inherit;}',
    '.cf-phone input::placeholder{color:#5a6a72;}',
    '.cf-hint{font-size:12.5px;color:#8696a0;line-height:1.55;margin:12px 0 4px;}',
    '.cf-hint.err{color:#f15c6d;}',
    '.cf-res{display:flex;align-items:center;gap:14px;padding:12px 18px;}',
    '.cf-av{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:#fff;flex-shrink:0;}',
    '.cf-ri{flex:1;min-width:0;}',
    '.cf-rn{font-size:15px;color:#e9edef;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.cf-rp{font-size:12.5px;color:#8696a0;margin-top:2px;}',
    '.cf-pill{font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:12px;white-space:nowrap;}',
    '.cf-pill.added{background:rgba(0,168,132,.16);color:#00a884;}',
    '.cf-pill.notOn{background:rgba(240,160,48,.16);color:#f0a030;}',
    '.cf-pill.failed{background:rgba(241,92,109,.16);color:#f15c6d;}',
    '.cf-busy{font-size:13px;color:#8696a0;padding:8px 18px;}'
  ].join('');
  document.head.appendChild(css);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function csrf() {
    var m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function colorFor(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return PALETTE[Math.abs(h) % PALETTE.length];
  }

  // Zambian numbers typed without a country code get +260.
  function normalizePhone(raw) {
    var s = String(raw || '').replace(/[\s\-().]/g, '');
    if (s.charAt(0) === '+') return '+' + s.slice(1).replace(/\D/g, '');
    if (s.slice(0, 2) === '00') return '+' + s.slice(2).replace(/\D/g, '');
    var digits = s.replace(/\D/g, '');
    if (digits.slice(0, 3) === '260') return '+' + digits;
    if (s.charAt(0) === '0') return '+260' + digits.slice(1);
    return digits;
  }

  function validDigits(p) { return p.replace(/\D/g, '').length >= 7; }

  // Put the person in the sidebar, select them and open their chat.
  function openChatWith(username, pic) {
    var c = window.Asterix && window.Asterix.chat;
    if (c && c.addConversationItem) c.addConversationItem({ username: username, profile_picture: pic || '' });
    if (c && c.openConversation) c.openConversation(username);
    if (c && c.loadMessages) {
      setTimeout(function () { c.loadMessages(username, true); }, 300);
    } else {
      document.dispatchEvent(new CustomEvent('asterix:contacts-changed'));
    }
  }

  var screen = null;
  var list = null;

  function onKey(e) { if (e.key === 'Escape') close(); }

  function close() {
    if (screen) { screen.remove(); screen = null; }
    document.removeEventListener('keydown', onKey);
  }

  function addOne(phone) {
    return fetch('/api/contacts/add-by-phone/', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf() },
      body: JSON.stringify({ phone_number: phone })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.ok && !d.error) {
          var c = d.contact || {}; return { status: 'added', phone: phone, username: c.username || d.username || '', pic: c.profile_picture || d.profile_picture || '' };
        }
        if (r.status === 404) return { status: 'notOn', phone: phone, username: '', pic: '' };
        return { status: 'failed', phone: phone, username: '', pic: '' };
      });
    }).catch(function () {
      return { status: 'failed', phone: phone, username: '', pic: '' };
    });
  }

  function resultRow(r) {
    var label = r.username || r.phone;
    var row = el('div', 'cf-res');
    var av = el('div', 'cf-av', label.replace(/^[@+]/, '').charAt(0).toUpperCase() || '?');
    av.style.background = colorFor(label);
    var info = el('div', 'cf-ri');
    info.appendChild(el('div', 'cf-rn', r.username ? '@' + r.username : r.phone));
    info.appendChild(el('div', 'cf-rp', r.phone));
    var text = r.status === 'added' ? 'Added' : r.status === 'notOn' ? 'Not on Fizzme' : 'Failed';
    row.appendChild(av);
    row.appendChild(info);
    row.appendChild(el('div', 'cf-pill ' + r.status, text));
    return row;
  }

  function setBusy(on, label) {
    var save = document.getElementById('cf-save');
    if (save) {
      save.disabled = on;
      save.textContent = on ? (label || 'Adding…') : 'Save';
    }
  }

  function addMany(phones, done) {
    var list2 = phones.filter(function (p, i) { return p && validDigits(p) && phones.indexOf(p) === i; });
    if (!list2.length) { done([]); return; }
    setBusy(true);
    var busy = document.getElementById('cf-busy');
    var results = [];
    var chain = Promise.resolve();
    list2.forEach(function (p, idx) {
      chain = chain.then(function () {
        if (busy) busy.textContent = 'Adding ' + (idx + 1) + ' of ' + list2.length + '…';
        return addOne(p).then(function (r) {
          results.push(r);
          if (list) list.appendChild(resultRow(r));
        });
      });
    });
    chain.then(function () {
      if (busy) busy.textContent = '';
      setBusy(false);
      done(results);
    });
  }

  function afterAdd(results) {
    var first = results.filter(function (r) { return r.status === 'added'; })[0];
    if (first) {
      close();
      openChatWith(first.username, first.pic);
      return;
    }
    var hint = document.getElementById('cf-hint');
    if (hint) {
      hint.classList.add('err');
      hint.textContent = results.length
        ? 'None of these numbers have a Fizzme account yet.'
        : 'Enter a valid phone number.';
    }
  }

  function open() {
    close();
    screen = el('div');
    screen.id = 'cf-screen';

    var top = el('div', 'cf-top');
    var back = el('button', 'cf-back');
    back.setAttribute('aria-label', 'Back');
    back.innerHTML = '<i class="fas fa-arrow-left"></i>';
    back.onclick = close;
    var title = el('div', 'cf-title', 'New contact');
    var save = el('button', 'cf-save', 'Save');
    save.id = 'cf-save';
    save.disabled = true;
    top.appendChild(back);
    top.appendChild(title);
    top.appendChild(save);
    screen.appendChild(top);

    var body = el('div', 'cf-body');

    if (hasPicker) {
      var pick = el('div', 'cf-row');
      var ico = el('div', 'cf-ico');
      ico.innerHTML = '<i class="fas fa-address-book"></i>';
      var pt = el('div');
      pt.appendChild(el('div', 'cf-rt', 'Choose from contacts'));
      pt.appendChild(el('div', 'cf-rs', 'Select people from your phone'));
      pick.appendChild(ico);
      pick.appendChild(pt);
      pick.onclick = function () {
        navigator.contacts.select(['name', 'tel'], { multiple: true }).then(function (picked) {
          var nums = [];
          (picked || []).forEach(function (c) {
            (c.tel || []).forEach(function (t) { nums.push(normalizePhone(t)); });
          });
          if (!nums.length) return;
          if (list) list.innerHTML = '';
          addMany(nums, afterAdd);
        }).catch(function () {
          var hint = document.getElementById('cf-hint');
          if (hint) { hint.classList.add('err'); hint.textContent = 'Contact access was not allowed. Type the number below instead.'; }
        });
      };
      body.appendChild(pick);
      body.appendChild(el('div', 'cf-div'));
    }

    var section = el('div', 'cf-section');
    section.appendChild(el('div', 'cf-label', 'Phone number'));
    var phone = el('div', 'cf-phone');
    phone.appendChild(el('div', 'cf-cc', '🇿🇲 +260'));
    var input = el('input');
    input.type = 'tel';
    input.inputMode = 'tel';
    input.autocomplete = 'off';
    input.placeholder = '97 123 4567';
    phone.appendChild(input);
    section.appendChild(phone);
    var hint = el('div', 'cf-hint', 'Type the number with or without the country code. Only people who already have a Fizzme account can be added.');
    hint.id = 'cf-hint';
    section.appendChild(hint);
    body.appendChild(section);

    var busy = el('div', 'cf-busy');
    busy.id = 'cf-busy';
    body.appendChild(busy);

    list = el('div');
    body.appendChild(list);
    screen.appendChild(body);

    function updateSave() {
      var ok = validDigits(normalizePhone(input.value));
      save.disabled = !ok;
    }

    function doSave() {
      var raw = input.value.trim();
      if (!raw) return;
      var num = normalizePhone(raw);
      if (!validDigits(num)) {
        hint.classList.add('err');
        hint.textContent = 'Enter a valid phone number.';
        return;
      }
      hint.classList.remove('err');
      hint.textContent = 'Type the number with or without the country code. Only people who already have a Fizzme account can be added.';
      list.innerHTML = '';
      addMany([num], function (results) {
        input.value = '';
        updateSave();
        afterAdd(results);
      });
    }

    input.addEventListener('input', updateSave);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSave(); });
    save.onclick = doSave;

    document.body.appendChild(screen);
    document.addEventListener('keydown', onKey);
    setTimeout(function () { input.focus(); }, 200);
  }

  // Replace the Add Contact handler: stop the older one from opening its sheet.
  window.addEventListener('click', function (e) {
    var item = e.target && e.target.closest ? e.target.closest('#ua-add-contact') : null;
    if (!item) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    var menu = document.getElementById('user-actions-context-menu');
    if (menu) menu.classList.remove('open');
    if (typeof window.closeActionsMenu === 'function') {
      try { window.closeActionsMenu(); } catch (err) {}
    }
    open();
  }, true);

  window.Asterix = window.Asterix || {};
  window.Asterix.contactForm = { open: open, close: close };
})();
