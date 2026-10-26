(function () {
  'use strict';
  if (window.__fzFriendsSheet) return;
  window.__fzFriendsSheet = true;

  var hasPicker = !!(navigator.contacts && navigator.contacts.select);

  var css = document.createElement('style');
  css.textContent = [
    '#fs-overlay{position:fixed;inset:0;z-index:30600;background:rgba(0,0,0,.62);display:flex;align-items:flex-end;justify-content:center;animation:fsFade .18s ease;}',
    '@keyframes fsFade{from{opacity:0}to{opacity:1}}',
    '@keyframes fsUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}',
    '#fs-sheet{width:min(440px,100%);max-height:90dvh;overflow:auto;background:#17212a;color:#e9edef;border-radius:24px 24px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.5);animation:fsUp .24s cubic-bezier(.2,.9,.3,1);padding-bottom:calc(18px + env(safe-area-inset-bottom,0px));box-sizing:border-box;font-family:Segoe UI,system-ui,Arial,sans-serif;}',
    '.fs-hero{position:relative;padding:22px 20px 20px;background:linear-gradient(135deg,#128c7e 0%,#25d366 100%);border-radius:24px 24px 0 0;}',
    '.fs-grab{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.45);margin:0 auto 14px;}',
    '.fs-hero-row{display:flex;align-items:center;gap:14px;}',
    '.fs-icon{width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;flex-shrink:0;}',
    '.fs-title{font-size:20px;font-weight:800;color:#fff;}',
    '.fs-sub{font-size:13px;color:rgba(255,255,255,.88);margin-top:2px;line-height:1.4;}',
    '.fs-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;border:0;background:rgba(0,0,0,.18);color:#fff;font-size:18px;cursor:pointer;}',
    '.fs-body{padding:18px 18px 4px;}',
    '.fs-pick{width:100%;display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;border:1px solid rgba(37,211,102,.35);background:rgba(37,211,102,.1);color:#e9edef;font-size:15px;font-weight:700;cursor:pointer;text-align:left;font-family:inherit;}',
    '.fs-pick small{display:block;font-weight:500;font-size:12px;color:#8696a0;margin-top:2px;}',
    '.fs-ico{width:40px;height:40px;border-radius:12px;background:#25d366;color:#000;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}',
    '.fs-divider{display:flex;align-items:center;gap:10px;margin:18px 0 14px;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#8696a0;}',
    '.fs-divider::before,.fs-divider::after{content:"";flex:1;height:1px;background:rgba(255,255,255,.08);}',
    '.fs-field{position:relative;background:#111b21;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px 14px 12px 44px;transition:border-color .15s,box-shadow .15s;}',
    '.fs-field:focus-within{border-color:#25d366;box-shadow:0 0 0 4px rgba(37,211,102,.12);}',
    '.fs-field > i{position:absolute;left:16px;top:16px;color:#25d366;font-size:15px;}',
    '.fs-field textarea{width:100%;background:transparent;border:0;outline:0;color:#e9edef;font-size:15px;line-height:1.6;resize:none;font-family:inherit;min-height:84px;box-sizing:border-box;}',
    '.fs-field textarea::placeholder{color:#5a6a72;}',
    '.fs-hint{font-size:12px;color:#8696a0;margin:8px 4px 0;line-height:1.5;}',
    '.fs-go{width:100%;margin-top:14px;padding:14px;border:0;border-radius:18px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 8px 22px rgba(37,211,102,.25);font-family:inherit;}',
    '.fs-go:disabled{opacity:.55;cursor:default;box-shadow:none;}',
    '.fs-progress{height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:14px;display:none;}',
    '.fs-progress.on{display:block;}',
    '.fs-progress > div{height:100%;width:0;background:#25d366;transition:width .25s ease;}',
    '.fs-status{font-size:13px;color:#aebac1;text-align:center;margin-top:8px;min-height:18px;}',
    '.fs-results{padding:6px 18px 4px;display:flex;flex-direction:column;gap:8px;}',
    '.fs-res{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);animation:fsUp .25s ease;}',
    '.fs-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#000;flex-shrink:0;}',
    '.fs-num{flex:1;min-width:0;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.fs-pill{font-size:11px;font-weight:800;padding:4px 10px;border-radius:12px;white-space:nowrap;}',
    '.fs-ok .fs-av{background:#25d366;}',
    '.fs-ok .fs-pill{background:rgba(37,211,102,.16);color:#25d366;}',
    '.fs-no .fs-av{background:#f0a030;}',
    '.fs-no .fs-pill{background:rgba(240,160,48,.16);color:#f0a030;}',
    '.fs-bad .fs-av{background:#f15c6d;}',
    '.fs-bad .fs-pill{background:rgba(241,92,109,.16);color:#f15c6d;}',
    '.fs-empty{font-size:13px;color:#8696a0;text-align:center;padding:6px 0 2px;}',
    '.fs-footer{padding:12px 18px 0;font-size:12px;color:#8696a0;text-align:center;}'
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

  function normalizePhone(raw) {
    var s = String(raw || '').replace(/[\s\-().]/g, '');
    if (s.charAt(0) === '+') return '+' + s.slice(1).replace(/\D/g, '');
    return s.replace(/\D/g, '');
  }

  function refreshContactList() {
    var chat = window.Asterix && window.Asterix.chat;
    var candidates = [
      chat && chat.refreshContacts, chat && chat.loadContacts,
      window.refreshContacts, window.loadContacts, window.renderContacts
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (typeof candidates[i] === 'function') {
        try { candidates[i](); return true; } catch (e) {}
      }
    }
    document.dispatchEvent(new CustomEvent('asterix:contacts-changed'));
    return false;
  }

  var overlay = null;

  function onKey(e) { if (e.key === 'Escape') close(); }

  function close() {
    if (overlay) { overlay.remove(); overlay = null; }
    document.removeEventListener('keydown', onKey);
  }

  function addRow(box, kind, label, pill) {
    var r = el('div', 'fs-res fs-' + kind);
    var mark = kind === 'ok' ? '✓' : kind === 'no' ? '!' : '×';
    r.appendChild(el('div', 'fs-av', mark));
    r.appendChild(el('div', 'fs-num', label));
    r.appendChild(el('div', 'fs-pill', pill));
    box.appendChild(r);
  }

  function addPhones(list, ui) {
    var nums = list.filter(function (n, i) {
      return n && list.indexOf(n) === i && n.replace(/\D/g, '').length >= 7;
    });
    ui.results.innerHTML = '';
    if (!nums.length) {
      ui.status.textContent = 'Enter at least one phone number.';
      return;
    }

    ui.btn.disabled = true;
    ui.bar.classList.add('on');
    var done = 0, added = 0, notOn = 0;

    function progress() {
      ui.bar.firstChild.style.width = Math.round(done / nums.length * 100) + '%';
      ui.status.textContent = 'Checking ' + Math.min(done + 1, nums.length) + ' of ' + nums.length + '…';
    }
    progress();

    var chain = Promise.resolve();
    nums.forEach(function (phone) {
      chain = chain.then(function () {
        return fetch('/api/contacts/add-by-phone/', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf() },
          body: JSON.stringify({ phone_number: phone })
        }).then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (d) {
            done++; progress();
            if (r.ok && !d.error) {
              added++;
              addRow(ui.results, 'ok', d.username ? '@' + d.username : phone, 'Added');
            } else if (r.status === 404) {
              notOn++;
              addRow(ui.results, 'no', phone, 'Not on Fizzme');
            } else {
              addRow(ui.results, 'bad', phone, 'Failed');
            }
          });
        }).catch(function () {
          done++; progress();
          addRow(ui.results, 'bad', phone, 'Network error');
        });
      });
    });

    chain.then(function () {
      ui.btn.disabled = false;
      ui.bar.classList.remove('on');
      var parts = [];
      if (added) parts.push(added + ' added');
      if (notOn) parts.push(notOn + ' not on Fizzme yet');
      ui.status.textContent = parts.join(' · ') || 'Done.';
      if (added) {
        refreshContactList();
        if (window.Swal) {
          Swal.fire({ toast: true, position: 'top', icon: 'success',
                      title: 'Added ' + added, timer: 1800, showConfirmButton: false });
        }
      }
    });
  }

  function open() {
    close();
    overlay = el('div');
    overlay.id = 'fs-overlay';
    var sheet = el('div');
    sheet.id = 'fs-sheet';
    overlay.appendChild(sheet);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    var hero = el('div', 'fs-hero');
    hero.appendChild(el('div', 'fs-grab'));
    var heroRow = el('div', 'fs-hero-row');
    var icon = el('div', 'fs-icon');
    icon.innerHTML = '<i class="fas fa-user-plus"></i>';
    var txt = el('div');
    txt.appendChild(el('div', 'fs-title', 'Add friends'));
    txt.appendChild(el('div', 'fs-sub', 'Find people who already use Fizzme.'));
    heroRow.appendChild(icon);
    heroRow.appendChild(txt);
    hero.appendChild(heroRow);
    var x = el('button', 'fs-close', '×');
    x.setAttribute('aria-label', 'Close');
    x.onclick = close;
    hero.appendChild(x);
    sheet.appendChild(hero);

    var body = el('div', 'fs-body');
    var results = el('div', 'fs-results');
    var bar = el('div', 'fs-progress');
    bar.appendChild(el('div'));
    var status = el('div', 'fs-status');
    var btn = el('button', 'fs-go', 'Add numbers');

    if (hasPicker) {
      var pick = el('button', 'fs-pick');
      var pIco = el('div', 'fs-ico');
      pIco.innerHTML = '<i class="fas fa-address-book"></i>';
      var pTxt = el('div');
      pTxt.appendChild(document.createTextNode('Choose from my contacts'));
      pTxt.appendChild(el('small', null, 'Pick several people at once'));
      pick.appendChild(pIco);
      pick.appendChild(pTxt);
      body.appendChild(pick);
      body.appendChild(el('div', 'fs-divider', 'or type numbers'));
    }

    var field = el('div', 'fs-field');
    var fIco = el('i');
    fIco.className = 'fas fa-phone';
    var ta = el('textarea');
    ta.rows = 3;
    ta.placeholder = '0977 123 456\n+260 96 123 4567';
    field.appendChild(fIco);
    field.appendChild(ta);
    body.appendChild(field);
    body.appendChild(el('div', 'fs-hint', 'One number per line. With or without +260 both work.'));
    body.appendChild(btn);
    body.appendChild(bar);
    body.appendChild(status);
    sheet.appendChild(body);
    sheet.appendChild(results);
    sheet.appendChild(el('div', 'fs-footer', 'Only people with a Fizzme account are added.'));

    var ui = { results: results, btn: btn, bar: bar, status: status };

    btn.onclick = function () {
      addPhones(ta.value.split(/\r?\n|,/).map(normalizePhone), ui);
    };

    if (hasPicker) {
      var pickBtn = body.querySelector('.fs-pick');
      pickBtn.onclick = function () {
        navigator.contacts.select(['name', 'tel'], { multiple: true }).then(function (picked) {
          var nums = [];
          (picked || []).forEach(function (c) {
            (c.tel || []).forEach(function (t) { nums.push(normalizePhone(t)); });
          });
          addPhones(nums, ui);
        }).catch(function () {
          status.textContent = 'Contact access was not allowed. Type the numbers below instead.';
        });
      };
    }

    document.body.appendChild(overlay);
    setTimeout(function () { ta.focus(); }, 150);
  }

  // Capture the menu item before the older handler runs.
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
  window.Asterix.friends = { open: open, close: close };
})();
