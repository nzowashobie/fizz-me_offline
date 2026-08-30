// ============================================================
// contacts_modal.js — Phone Contacts Modal (Android + Web)
// ============================================================

(function() {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────
  var ASTERIX = window.ASTERIX || {};
  var csrf = ASTERIX.CSRF || (function() {
    var cookie = document.cookie.split('; ').find(function(r) { return r.startsWith('csrftoken='); });
    return cookie ? cookie.split('=')[1] : '';
  })();
  var defaultAvatar = ASTERIX.DEFAULT_AVATAR || '/static/images/default_profile_picture.webp';

  // ── Ensure toast exists ────────────────────────────────────────────
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

  // ── Phone number normalisation (matches server) ──────────────────
  function normalizePhone(phone) {
    if (!phone) return '';
    var digits = String(phone).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) {
      digits = '260' + digits.substring(1);
    } else if (digits.length === 9) {
      digits = '260' + digits;
    }
    // Always return with leading '+'
    return '+' + digits;
  }

  // ── Inject modal HTML once ──────────────────────────────────────────
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

  // ── State ──────────────────────────────────────────────────────────
  var _allContacts  = [];
  var _asterixMap   = {};
  var _isLoading    = false;

  // ── Open / Close ──────────────────────────────────────────────────
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

  // ── Load contacts from Android bridge or fallback ────────────────
  function _loadContacts() {
    var list   = document.getElementById('contacts-modal-list');
    var status = document.getElementById('contacts-modal-status');
    list.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--sub);font-size:13px;"><i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>Loading contacts…</div>';
    status.textContent = '';

    // Check if Android bridge is available
    if (!window.AndroidBridge || typeof window.AndroidBridge.getPhoneContactsLight !== 'function') {
      // ── Web/PWA fallback: try the Contacts Picker API (Chrome/Android). ──
      if (window.PWABridge && window.PWABridge.contactsPickerSupported()) {
        _autoPickWebContacts(list, status);
        return;
      }

      list.innerHTML =
        '<div style="text-align:center;padding:30px 16px;color:var(--sub);font-size:13px;">' +
          '<i class="fas fa-info-circle" style="font-size:28px;display:block;margin-bottom:10px;"></i>' +
          'Phone contacts aren\'t available in this browser.<br>' +
          'Install the app on Android Chrome, or use the "Add Contact" button in the menu.' +
        '</div>';
      return;
    }

    // ── Native Android path ──────────────────────────────────────────
    if (_isLoading) return;
    _isLoading = true;

    try {
      var lightJson = window.AndroidBridge.getPhoneContactsLight();
      _allContacts = JSON.parse(lightJson || '[]');
    } catch(e) {
      _allContacts = [];
      console.warn('Failed to parse light contacts:', e);
    }

    if (!_allContacts.length) {
      list.innerHTML =
        '<div style="text-align:center;padding:30px 16px;color:var(--sub);font-size:13px;">' +
          '<i class="fas fa-user-slash" style="font-size:28px;display:block;margin-bottom:10px;"></i>' +
          'No contacts found. Grant contacts permission in device settings.' +
        '</div>';
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
        } catch(e) {
          console.warn('Failed to load full contacts:', e);
        }
      }, 300);
    }

    _isLoading = false;
  }

  // ── Auto‑pick web contacts (with smart close) ────────────────────
  function _autoPickWebContacts(list, status) {
    list.innerHTML =
      '<div style="text-align:center;padding:30px 16px;">' +
        '<i class="fas fa-address-book" style="font-size:28px;display:block;margin-bottom:10px;color:var(--sub);"></i>' +
        '<p style="color:var(--sub);font-size:13px;">Opening contacts picker…</p>' +
      '</div>';

    window.PWABridge.pickContactsWeb()
      .then(function(picked) {
        _allContacts = picked || [];
        if (!_allContacts.length) {
          closeContactsModal();
          toast('No contacts', 'No contacts were selected.');
          return;
        }
        _renderContacts(_allContacts);
        _checkAsterixMembership();
      })
      .catch(function(err) {
        console.warn('Contacts Picker error:', err);
        if (err && err.name === 'AbortError') {
          closeContactsModal();
          toast('Cancelled', 'Contacts picker was cancelled.');
          return;
        }
        list.innerHTML =
          '<div style="text-align:center;padding:20px;color:var(--sub);font-size:13px;">' +
            '<i class="fas fa-times-circle" style="font-size:24px;display:block;margin-bottom:10px;"></i>' +
            'Could not open contacts picker.<br>' +
            '<button id="pwa-retry-pick" class="modal-btn primary" style="margin-top:12px;">Try Again</button>' +
          '</div>';
        var retryBtn = document.getElementById('pwa-retry-pick');
        if (retryBtn) {
          retryBtn.onclick = function() {
            _autoPickWebContacts(list, status);
          };
        }
      });
  }

  // ── Check Asterix membership (batch) ─────────────────────────────
  function _checkAsterixMembership() {
    var status = document.getElementById('contacts-modal-status');
    status.textContent = 'Checking who is on Fizz-me…';

    // Normalise all phone numbers before sending
    var phones = _allContacts.map(function(c) { return normalizePhone(c.phone); }).filter(Boolean);
    if (!phones.length) {
      status.textContent = '';
      return;
    }

    fetch('/api/contacts/check-phones/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrf
      },
      body: JSON.stringify({ phones: phones })
    })
    .then(function(r) { return r.ok ? r.json() : Promise.reject('Failed'); })
    .then(function(data) {
      _asterixMap = data.registered || {};
      status.textContent = '';
      _renderContacts(_allContacts);
    })
    .catch(function(e) {
      console.warn('Batch check failed:', e);
      status.textContent = 'Could not check membership.';
    });
  }

  // ── Render contacts list ──────────────────────────────────────────
  function _renderContacts(contacts) {
    var list = document.getElementById('contacts-modal-list');
    list.innerHTML = '';

    if (!contacts || !contacts.length) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--sub);font-size:13px;">No contacts found.</div>';
      return;
    }

    contacts.forEach(function(contact) {
      var phone = contact.phone || '';
      // Use normalised phone as key for membership lookup
      var normPhone = normalizePhone(phone);
      var asterixInfo = _asterixMap[normPhone] || null;
      var row = document.createElement('div');
      row.className = 'contacts-modal-row';
      row.setAttribute('data-phone', phone);
      row.style.cssText =
        'display:flex;align-items:center;padding:10px 8px;border-radius:10px;cursor:pointer;gap:12px;' +
        'transition:background .15s;border-bottom:1px solid var(--border);';

      row.onmouseover = function() { this.style.background = 'var(--mid)'; };
      row.onmouseout  = function() { this.style.background = ''; };

      // Avatar
      var avatarWrap = document.createElement('div');
      avatarWrap.style.cssText = 'position:relative;flex-shrink:0;';
      var avatarEl = _buildAvatar(contact, asterixInfo);
      avatarWrap.appendChild(avatarEl);

      if (asterixInfo) {
        var dot = document.createElement('div');
        dot.style.cssText =
          'position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;' +
          'background:#25d366;border:2px solid var(--dark);';
        avatarWrap.appendChild(dot);
      }

      // Info
      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      var name = contact.name || 'Unknown';
      var phoneDisplay = phone;
      var statusText = asterixInfo ? ' · On Fizz-me' : '';
      info.innerHTML =
        '<div style="font-weight:600;font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
          _esc(name) +
        '</div>' +
        '<div style="font-size:12px;color:var(--sub);margin-top:2px;">' +
          _esc(phoneDisplay) +
          (statusText ? ' <span style="color:#25d366;font-weight:600;">' + statusText + '</span>' : '') +
        '</div>';

      // Action button
      var btn = document.createElement('button');
      btn.style.cssText =
        'flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:600;cursor:pointer;';

      if (asterixInfo) {
        btn.textContent = 'Add to Chat';
        btn.style.background = '#25d366';
        btn.style.color = '#fff';
        btn.onclick = function(e) {
          e.stopPropagation();
          _addAsterixContact(phone, asterixInfo, row);
        };
        row.onclick = function() { _addAsterixContact(phone, asterixInfo, row); };
      } else {
        btn.textContent = 'Invite';
        btn.style.background = 'var(--mid)';
        btn.style.color = 'var(--sub)';
        btn.onclick = function(e) {
          e.stopPropagation();
          _inviteContact(contact);
        };
        row.onclick = function() { _inviteContact(contact); };
      }

      row.append(avatarWrap, info, btn);
      list.appendChild(row);
    });
  }

  // ── Avatar builder ────────────────────────────────────────────────
  function _buildAvatar(contact, asterixInfo) {
    var size = '44px';
    var photoUrl = null;

    if (asterixInfo && asterixInfo.profile_picture) {
      photoUrl = asterixInfo.profile_picture;
    } else if (contact.photo_uri && contact.photo_uri.length > 0) {
      photoUrl = contact.photo_uri;
    }

    if (photoUrl) {
      var img = document.createElement('img');
      img.src = photoUrl;
      img.style.cssText =
        'width:' + size + ';height:' + size + ';border-radius:50%;object-fit:cover;' +
        'background:var(--mid);display:block;';
      img.onerror = function() {
        var parent = this.parentNode;
        if (parent) {
          var ini = _initialsAvatar(contact.name, size);
          parent.replaceChild(ini, this);
        }
      };
      var wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.width = size;
      wrapper.style.height = size;
      var initials = _initialsAvatar(contact.name, size);
      wrapper.appendChild(initials);
      wrapper.appendChild(img);
      img.style.position = 'absolute';
      img.style.top = '0';
      img.style.left = '0';
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.2s';
      img.onload = function() {
        initials.style.display = 'none';
        img.style.opacity = '1';
      };
      img.onerror = function() {
        initials.style.display = 'block';
        img.style.display = 'none';
      };
      img.src = photoUrl;
      return wrapper;
    }

    return _initialsAvatar(contact.name, size);
  }

  function _initialsAvatar(name, size) {
    var words    = (name || '?').trim().split(/\s+/);
    var initials = words.length >= 2
      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
      : (words[0] || '?')[0].toUpperCase();

    var colours = ['#e53935','#8e24aa','#1e88e5','#00897b','#f4511e','#6d4c41','#546e7a','#43a047'];
    var idx     = (name || '').split('').reduce(function(a, c) { return a + c.charCodeAt(0); }, 0) % colours.length;

    var div = document.createElement('div');
    div.style.cssText =
      'width:' + size + ';height:' + size + ';border-radius:50%;display:flex;align-items:center;justify-content:center;' +
      'background:' + colours[idx] + ';color:#fff;font-weight:700;font-size:16px;flex-shrink:0;';
    div.textContent = initials;
    return div;
  }

  // ── Add Asterix contact to chat list ─────────────────────────────
  function _addAsterixContact(phone, asterixInfo, rowEl) {
    var status = document.getElementById('contacts-modal-status');
    if (!asterixInfo) {
      status.textContent = 'No user found for this number.';
      status.className = 'modal-status err';
      return;
    }

    var username = asterixInfo.username;
    if (!username) {
      status.textContent = 'Username missing.';
      status.className = 'modal-status err';
      return;
    }

    if (document.querySelector('.conversation-item[data-recipient="' + CSS.escape(username) + '"]')) {
      status.textContent = username + ' is already in your chats.';
      status.className = 'modal-status ok';
      setTimeout(function() { status.textContent = ''; status.className = 'modal-status'; }, 2000);
      return;
    }

    // Send normalised phone to the server
    var normPhone = normalizePhone(phone);
    fetch('/api/contacts/add-by-phone/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrf
      },
      body: JSON.stringify({ phone_number: normPhone })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.status === 'success' || data.status === 'already_exists') {
        var contactObj = {
          username: username,
          profile_picture: asterixInfo.profile_picture || defaultAvatar
        };
        if (window.Asterix && window.Asterix.chat && typeof window.Asterix.chat.addConversationItem === 'function') {
          window.Asterix.chat.addConversationItem(contactObj);
        } else {
          var list = document.getElementById('conversation-list');
          if (list) {
            var item = document.createElement('div');
            item.className = 'conversation-item';
            item.setAttribute('data-recipient', username);
            item.innerHTML = '<img class="conv-avatar" src="' + (contactObj.profile_picture || defaultAvatar) + '" alt="' + username + '">' +
              '<div class="conv-body"><div class="conv-name">' + username + '</div><div class="conv-preview" id="preview-' + username + '">Tap to open chat</div></div>' +
              '<span class="unread-badge hide" id="unread-' + username + '"></span>';
            list.appendChild(item);
          }
        }
        status.textContent = '✅ ' + username + ' added to chat list!';
        status.className = 'modal-status ok';
        if (rowEl) {
          rowEl.style.opacity = '0.5';
          rowEl.style.pointerEvents = 'none';
        }
        setTimeout(function() {
          status.textContent = '';
          status.className = 'modal-status';
          closeContactsModal();
        }, 1500);
      } else {
        status.textContent = data.message || 'Could not add contact.';
        status.className = 'modal-status err';
      }
    })
    .catch(function() {
      status.textContent = 'Network error.';
      status.className = 'modal-status err';
    });
  }

  // ── Invite non-Asterix contact ────────────────────────────────────
  function _inviteContact(contact) {
    var inviteUrl  = 'https://fizzme.pythonanywhere.com';
    var name = contact.name || 'there';
    var inviteText = 'Hi ' + name + '! Join me on Fizz-me — Zambia\'s community chat app. ' +
                     'Download or open it here: ' + inviteUrl;

    if (window.AndroidBridge && typeof window.AndroidBridge.sendSms === 'function') {
      try {
        window.AndroidBridge.sendSms(contact.phone, inviteText);
        toast('Invite sent', 'SMS invite sent to ' + name);
        return;
      } catch(e) { /* fall through */ }
    }

    if (navigator.share) {
      navigator.share({ text: inviteText }).catch(function() {});
      return;
    }

    navigator.clipboard.writeText(inviteText).then(function() {
      toast('Invite copied', 'Invite message copied — paste it to send to ' + name);
    }).catch(function() {
      toast('Invite', inviteUrl);
    });
  }

  // ── Search filter ──────────────────────────────────────────────────
  var searchInput = document.getElementById('contacts-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      var query = this.value.trim().toLowerCase();
      if (!query) {
        _renderContacts(_allContacts);
        return;
      }
      if (window.AndroidBridge && typeof window.AndroidBridge.searchContacts === 'function') {
        try {
          var json = window.AndroidBridge.searchContacts(query);
          var results = JSON.parse(json || '[]');
          _renderContacts(results);
          return;
        } catch(e) { /* fall through */ }
      }
      var filtered = _allContacts.filter(function(c) {
        var name  = (c.name || '').toLowerCase();
        var phone = (c.phone || '');
        return name.includes(query) || phone.includes(query);
      });
      _renderContacts(filtered);
    });
  }

  // ── HTML escape ────────────────────────────────────────────────────
  function _esc(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // ── Wire "Add Contact" menu item ──────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    var addContactBtn = document.getElementById('ua-add-contact');
    if (addContactBtn) {
      addContactBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof window.openContactsModal === 'function') {
          window.openContactsModal();
        } else {
          toast('Not available', 'Contacts feature only in Android app.');
        }
      });
    }
  });

  console.log('[Asterix] Contacts modal loaded');
})();