// ============================================================
// contacts_modal.js — Phone Contacts Modal (Android + Web)
// ============================================================

(function() {
  'use strict';

  var ASTERIX = window.ASTERIX || {};
  var csrf = ASTERIX.CSRF || (function() {
    var cookie = document.cookie.split('; ').find(function(r) { return r.startsWith('csrftoken='); });
    return cookie ? cookie.split('=')[1] : '';
  })();
  var defaultAvatar = ASTERIX.DEFAULT_AVATAR || '/static/images/default_profile_picture.webp';

  if (typeof toast !== 'function') {
    window.toast = function(title, body) {
      var el = document.getElementById('toast');
      if (!el) return;
      document.getElementById('toast-title').textContent = title;
      document.getElementById('toast-body').textContent = body;
      el.classList.add('show');
      clearTimeout(window._toastT);
      window._toastT = setTimeout(function() { el.classList.remove('show'); }, 4000);
    };
  }

  function normalizePhone(phone) {
    if (!phone) return '';
    var digits = String(phone).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) digits = '260' + digits.substring(1);
    else if (digits.length === 9) digits = '260' + digits;
    return '+' + digits;
  }

  if (!document.getElementById('contacts-modal-overlay')) {
    var html =
      '<div id="contacts-modal-overlay" class="modal-overlay" onclick="if(event.target===this)closeContactsModal()">' +
        '<div class="modal-card" style="width:380px;max-height:80vh;display:flex;flex-direction:column;border-radius:16px;overflow:hidden;" onclick="event.stopPropagation()">' +
          '<div class="modal-header">' +
            '<i class="fas fa-address-book"></i>' +
            '<h3>Phone Contacts</h3>' +
            '<button class="modal-close" onclick="closeContactsModal()">&times;</button>' +
          '</div>' +
          '<div style="padding:10px 16px 0;">' +
            '<div style="position:relative;">' +
              '<i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--sub);font-size:13px;"></i>' +
              '<input type="text" id="contacts-search-input" placeholder="Search name or number…"' +
                ' style="width:100%;box-sizing:border-box;padding:9px 12px 9px 32px;background:var(--mid);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;outline:none;">' +
            '</div>' +
          '</div>' +
          '<div id="contacts-modal-list" style="flex:1;overflow-y:auto;padding:8px 8px 16px;"></div>' +
          '<div id="contacts-modal-status" class="modal-status" style="text-align:center;padding-bottom:8px;"></div>' +
        '</div>' +
      '</div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  var _allContacts  = [];
  var _asterixMap   = {};
  var _isLoading    = false;
  var _permWaitTimer = null;

  window.openContactsModal = function() {
    var overlay = document.getElementById('contacts-modal-overlay');
    overlay.classList.add('open');
    document.getElementById('contacts-search-input').value = '';
    document.getElementById('contacts-modal-status').textContent = '';
    _loadContacts();
  };

  window.closeContactsModal = function() {
    document.getElementById('contacts-modal-overlay').classList.remove('open');
  };

  function _loadContacts() {
    if (_permWaitTimer) { clearTimeout(_permWaitTimer); _permWaitTimer = null; }
    var list   = document.getElementById('contacts-modal-list');
    var status = document.getElementById('contacts-modal-status');
    list.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--sub);font-size:13px;"><i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>Loading contacts…</div>';
    status.textContent = '';

    if (!window.AndroidBridge || typeof window.AndroidBridge.getPhoneContactsLight !== 'function') {
      if (window.PWABridge && window.PWABridge.contactsPickerSupported()) {
        _autoPickWebContacts(list, status);
        return;
      }
      list.innerHTML = '<div style="text-align:center;padding:30px 16px;color:var(--sub);font-size:13px;">' +
          '<i class="fas fa-info-circle" style="font-size:28px;display:block;margin-bottom:10px;"></i>' +
          'Phone contacts aren\'t available in this browser.<br>' +
          'Install the app on Android Chrome, or use the "Add Contact" button in the menu.</div>';
      return;
    }

    var hasPermission = false;
    try {
      hasPermission = window.AndroidBridge.hasContactsPermission();
    } catch (e) { hasPermission = false; }

    if (!hasPermission) {
      list.innerHTML =
        '<div style="text-align:center;padding:30px 16px;">' +
          '<i class="fas fa-address-book" style="font-size:32px;color:var(--accent2);margin-bottom:14px;display:block;"></i>' +
          '<div style="color:var(--text);font-size:15px;font-weight:600;margin-bottom:8px;">Allow contact access</div>' +
          '<div style="color:var(--sub);font-size:12px;line-height:1.55;margin-bottom:18px;">' +
            'Fizzme needs permission to read your contacts. Only people already on Fizzme are ever shown.' +
          '</div>' +
          '<button id="grant-contacts-btn" style="padding:11px 26px;background:var(--accent2);color:#fff;border:none;border-radius:24px;font-size:14px;font-weight:700;cursor:pointer;">Allow Access</button>' +
          '<button id="open-settings-btn" style="display:none;margin:14px auto 0;background:none;border:none;color:var(--sub);font-size:12px;text-decoration:underline;cursor:pointer;">Open phone settings</button>' +
        '</div>';

      var grantBtn = document.getElementById('grant-contacts-btn');
      if (grantBtn) {
        grantBtn.onclick = function () {
          try { window.AndroidBridge.requestContactsPermission(); } catch (e) {}
          list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--sub);font-size:13px;">' +
            '<i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>Waiting for permission…</div>';

          // If the user denied it previously and checked "Don't ask again", the OS won't show a prompt.
          // After 1.5 seconds, show the "Open settings" button.
          _permWaitTimer = setTimeout(function() {
             if (!window.AndroidBridge.hasContactsPermission()) {
                 var setBtn = document.getElementById('open-settings-btn');
                 if (setBtn) setBtn.style.display = 'inline-block';
                 list.innerHTML = '<div style="text-align:center;padding:20px;color:#f15c6d;font-size:13px;">Permission blocked. Please click "Open phone settings" below to allow it.</div>';
             }
          }, 1500);
        };
      }
      var setBtn = document.getElementById('open-settings-btn');
      if (setBtn) {
        setBtn.onclick = function () {
          try { window.AndroidBridge.openAppSettings(); } catch (e) {}
        };
      }
      return;
    }

    if (_isLoading) return;
    _isLoading = true;

    try {
      var lightJson = window.AndroidBridge.getPhoneContactsLight();
      _allContacts = JSON.parse(lightJson || '[]');
    } catch(e) {
      _allContacts = [];
    }

    if (!_allContacts.length) {
      list.innerHTML = '<div style="text-align:center;padding:30px 16px;color:var(--sub);font-size:13px;">' +
          '<i class="fas fa-user-slash" style="font-size:28px;display:block;margin-bottom:10px;"></i>' +
          'No contacts found on this device.</div>';
      _isLoading = false;
      return;
    }

    _renderContacts(_allContacts);
    _checkAsterixMembership();

    if (window.AndroidBridge && typeof window.AndroidBridge.getPhoneContactsWithDetails === 'function') {
      setTimeout(function() {
        try {
          var fullJson = window.AndroidBridge.getPhoneContactsWithDetails();
          var fullContacts = JSON.parse(fullJson || '[]');
          var photoMap = {};
          fullContacts.forEach(function(c) {
            if (c.phone && c.photo_uri) photoMap[c.phone] = c.photo_uri;
          });
          var updated = false;
          _allContacts.forEach(function(c) {
            if (photoMap[c.phone] && c.photo_uri !== photoMap[c.phone]) {
              c.photo_uri = photoMap[c.phone];
              updated = true;
            }
          });
          if (updated) _renderContacts(_allContacts);
        } catch(e) {}
      }, 300);
    }
    _isLoading = false;
  }

  function _autoPickWebContacts(list, status) {
    list.innerHTML = '<div style="text-align:center;padding:30px 16px;"><i class="fas fa-address-book" style="font-size:28px;display:block;margin-bottom:10px;color:var(--sub);"></i><p style="color:var(--sub);font-size:13px;">Opening contacts picker…</p></div>';
    window.PWABridge.pickContactsWeb().then(function(picked) {
        _allContacts = picked || [];
        if (!_allContacts.length) { closeContactsModal(); toast('No contacts', 'No contacts were selected.'); return; }
        _renderContacts(_allContacts);
        _checkAsterixMembership();
      }).catch(function(err) {
        list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--sub);font-size:13px;">Could not open contacts picker.</div>';
      });
  }

  function _checkAsterixMembership() {
    var status = document.getElementById('contacts-modal-status');
    status.textContent = 'Checking who is on Fizzme…';
    var phones = _allContacts.map(function(c) { return normalizePhone(c.phone); }).filter(Boolean);
    if (!phones.length) { status.textContent = ''; return; }

    fetch('/api/contacts/check-phones/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify({ phones: phones })
    }).then(function(r) { return r.ok ? r.json() : Promise.reject('Failed'); })
      .then(function(data) {
        _asterixMap = data.registered || {};
        status.textContent = '';
        _renderContacts(_allContacts);
      }).catch(function() { status.textContent = 'Could not check membership.'; });
  }

  function _renderContacts(contacts) {
    var list = document.getElementById('contacts-modal-list');
    list.innerHTML = '';
    if (!contacts || !contacts.length) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--sub);font-size:13px;">No contacts found.</div>';
      return;
    }

    contacts.forEach(function(contact) {
      var phone = contact.phone || '';
      var normPhone = normalizePhone(phone);
      var asterixInfo = _asterixMap[normPhone] || null;
      var row = document.createElement('div');
      row.className = 'contacts-modal-row';
      row.setAttribute('data-phone', phone);
      row.style.cssText = 'display:flex;align-items:center;padding:10px 8px;border-radius:10px;cursor:pointer;gap:12px;transition:background .15s;border-bottom:1px solid var(--border);';
      row.onmouseover = function() { this.style.background = 'var(--mid)'; };
      row.onmouseout  = function() { this.style.background = ''; };

      var avatarWrap = document.createElement('div');
      avatarWrap.style.cssText = 'position:relative;flex-shrink:0;';
      avatarWrap.appendChild(_buildAvatar(contact, asterixInfo));

      if (asterixInfo) {
        var dot = document.createElement('div');
        dot.style.cssText = 'position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:#25d366;border:2px solid var(--dark);';
        avatarWrap.appendChild(dot);
      }

      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      var name = contact.name || 'Unknown';
      var statusText = asterixInfo ? ' · On Fizzme' : '';
      info.innerHTML = '<div style="font-weight:600;font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(name) + '</div>' +
        '<div style="font-size:12px;color:var(--sub);margin-top:2px;">' + _esc(phone) + (statusText ? ' <span style="color:#25d366;font-weight:600;">' + statusText + '</span>' : '') + '</div>';

      var btn = document.createElement('button');
      btn.style.cssText = 'flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;';

      if (asterixInfo) {
        btn.textContent = 'Add to Chat';
        btn.style.background = '#25d366'; btn.style.color = '#fff';
        btn.onclick = function(e) { e.stopPropagation(); _addAsterixContact(phone, asterixInfo, row); };
        row.onclick = function() { _addAsterixContact(phone, asterixInfo, row); };
      } else {
        btn.textContent = 'Invite';
        btn.style.background = 'var(--mid)'; btn.style.color = 'var(--sub)';
        btn.onclick = function(e) { e.stopPropagation(); _inviteContact(contact); };
        row.onclick = function() { _inviteContact(contact); };
      }

      row.append(avatarWrap, info, btn);
      list.appendChild(row);
    });
  }

  function _buildAvatar(contact, asterixInfo) {
    var size = '44px';
    var photoUrl = (asterixInfo && asterixInfo.profile_picture) ? asterixInfo.profile_picture : (contact.photo_uri || null);
    if (photoUrl) {
      var img = document.createElement('img');
      img.style.cssText = 'width:' + size + ';height:' + size + ';border-radius:50%;object-fit:cover;background:var(--mid);display:block;';
      var wrapper = document.createElement('div');
      wrapper.style.position = 'relative'; wrapper.style.width = size; wrapper.style.height = size;
      var initials = _initialsAvatar(contact.name, size);
      wrapper.appendChild(initials); wrapper.appendChild(img);
      img.style.position = 'absolute'; img.style.top = '0'; img.style.left = '0';
      img.style.opacity = '0'; img.style.transition = 'opacity 0.2s';
      img.onload = function() { initials.style.display = 'none'; img.style.opacity = '1'; };
      img.onerror = function() { initials.style.display = 'block'; img.style.display = 'none'; };
      img.src = photoUrl;
      return wrapper;
    }
    return _initialsAvatar(contact.name, size);
  }

  function _initialsAvatar(name, size) {
    var words = (name || '?').trim().split(/\s+/);
    var initials = words.length >= 2 ? (words[0][0] + words[words.length - 1][0]).toUpperCase() : (words[0] || '?')[0].toUpperCase();
    var colours = ['#e53935','#8e24aa','#1e88e5','#00897b','#f4511e','#6d4c41','#546e7a','#43a047'];
    var idx = (name || '').split('').reduce(function(a, c) { return a + c.charCodeAt(0); }, 0) % colours.length;
    var div = document.createElement('div');
    div.style.cssText = 'width:' + size + ';height:' + size + ';border-radius:50%;display:flex;align-items:center;justify-content:center;background:' + colours[idx] + ';color:#fff;font-weight:700;font-size:16px;flex-shrink:0;';
    div.textContent = initials;
    return div;
  }

  function _addAsterixContact(phone, asterixInfo, rowEl) {
    var status = document.getElementById('contacts-modal-status');
    if (!asterixInfo || !asterixInfo.username) return;
    var username = asterixInfo.username;

    if (document.querySelector('.conversation-item[data-recipient="' + CSS.escape(username) + '"]')) {
      status.textContent = username + ' is already in your chats.';
      status.className = 'modal-status ok';
      setTimeout(function() { status.textContent = ''; status.className = 'modal-status'; }, 2000);
      return;
    }

    fetch('/api/contacts/add-by-phone/', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify({ phone_number: normalizePhone(phone) })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.status === 'success' || data.status === 'already_exists') {
        var contactObj = { username: username, profile_picture: asterixInfo.profile_picture || defaultAvatar };
        if (window.Asterix && window.Asterix.chat && typeof window.Asterix.chat.addConversationItem === 'function') {
          window.Asterix.chat.addConversationItem(contactObj);
        }
        status.textContent = '✅ ' + username + ' added to chat list!';
        status.className = 'modal-status ok';
        if (rowEl) { rowEl.style.opacity = '0.5'; rowEl.style.pointerEvents = 'none'; }
        setTimeout(function() { status.textContent = ''; status.className = 'modal-status'; closeContactsModal(); }, 1500);
      } else {
        status.textContent = data.message || 'Could not add contact.';
        status.className = 'modal-status err';
      }
    }).catch(function() { status.textContent = 'Network error.'; status.className = 'modal-status err'; });
  }

  function _inviteContact(contact) {
    var inviteText = 'Hi ' + (contact.name || 'there') + '! Join me on Fizzme — Zambia\'s community chat app. Install or open it here: https://fizzme.pythonanywhere.com';
    if (window.AndroidBridge && typeof window.AndroidBridge.sendSms === 'function') {
      try { window.AndroidBridge.sendSms(contact.phone, inviteText); toast('Invite sent', 'SMS invite sent.'); return; } catch(e) {}
    }
    if (navigator.share) { navigator.share({ text: inviteText }).catch(function() {}); return; }
    navigator.clipboard.writeText(inviteText).then(function() { toast('Invite copied', 'Paste it to send.'); });
  }

  var searchInput = document.getElementById('contacts-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      var query = this.value.trim().toLowerCase();
      if (!query) { _renderContacts(_allContacts); return; }
      if (window.AndroidBridge && typeof window.AndroidBridge.searchContacts === 'function') {
        try { _renderContacts(JSON.parse(window.AndroidBridge.searchContacts(query) || '[]')); return; } catch(e) {}
      }
      _renderContacts(_allContacts.filter(function(c) {
        return (c.name || '').toLowerCase().includes(query) || (c.phone || '').includes(query);
      }));
    });
  }

  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  document.addEventListener('DOMContentLoaded', function() {
    var addContactBtn = document.getElementById('ua-add-contact');
    if (addContactBtn) {
      addContactBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof window.openContactsModal === 'function') window.openContactsModal();
      });
    }
  });

  window.addEventListener('nativePermissionsChanged', function () {
    var overlay = document.getElementById('contacts-modal-overlay');
    if (overlay && overlay.classList.contains('open')) { _loadContacts(); }
  });

})();