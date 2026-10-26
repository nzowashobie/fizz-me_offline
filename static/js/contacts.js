// static/js/contacts.js
// ============================================================
// Phone contacts modal, add contact, contact picker
// Uses batch API for checking multiple phones at once
// ============================================================

(function(contacts, utils, chat) {
  'use strict';

  var toast = utils.toast;
  var showConfirm = utils.showConfirm;
  var csrf = utils.csrf;

  // ── Contacts Modal ───────────────────────────────────────────
  contacts.openContactsModal = function() {
    var overlay = document.getElementById('contacts-modal-overlay');
    overlay.classList.add('open');
    contacts.loadPhoneContacts();
  };

  contacts.closeContactsModal = function() {
    document.getElementById('contacts-modal-overlay').classList.remove('open');
    document.getElementById('contacts-search-input').value = '';
  };

  contacts.loadPhoneContacts = function() {
    var container = document.getElementById('contacts-list-container');
    container.innerHTML = '<p style="padding:20px;color:var(--sub);text-align:center;">Loading contacts…</p>';

    if (window.AndroidBridge && window.AndroidBridge.getPhoneContactsWithDetails) {
      try {
        var contactsJson = window.AndroidBridge.getPhoneContactsWithDetails();
        var rawContacts = JSON.parse(contactsJson);
        contacts.renderContactsList(rawContacts);
      } catch(e) {
        container.innerHTML = '<p style="padding:20px;color:#f15c6d;text-align:center;">Failed to load contacts.</p>';
        console.warn('Contacts load error:', e);
      }
    } else {
      container.innerHTML = '<p style="padding:20px;color:var(--sub);text-align:center;">No Android bridge available.</p>';
    }
  };

  contacts.renderContactsList = function(contactsArray) {
    var container = document.getElementById('contacts-list-container');
    var searchInput = document.getElementById('contacts-search-input');

    if (!contactsArray || contactsArray.length === 0) {
      container.innerHTML = '<p style="padding:20px;color:var(--sub);text-align:center;">No contacts found.</p>';
      return;
    }

    // ── Batch check all phone numbers at once ──────────────────
    var phones = contactsArray.map(function(c) { return c.phone; }).filter(Boolean);

    // Registration status starts unknown and fills in once the batch
    // check resolves. render() below works fine either way, so the full
    // list appears — and is scrollable — immediately, instead of being
    // blocked behind the network request like before.
    var registered = {};
    var unregistered = [];
    var statusKnown = false;
    var checkFailed = false;

    function render(filter) {
      var filtered = contactsArray.filter(function(c) {
        if (!filter) return true;
        var name = (c.name || '').toLowerCase();
        var phone = (c.phone || '').toLowerCase();
        var q = filter.toLowerCase();
        return name.includes(q) || phone.includes(q);
      });

      container.innerHTML = '';

      if (filtered.length === 0) {
        container.innerHTML = '<p style="padding:20px;color:var(--sub);text-align:center;">No matching contacts.</p>';
        return;
      }

      filtered.forEach(function(contact) {
        var div = document.createElement('div');
        div.className = 'contact-item-modal';
        var initial = (contact.name || '?').charAt(0).toUpperCase();

        var avatarHtml = contact.photoUri ?
          '<img class="cav" src="' + contact.photoUri + '" alt="' + contact.name + '">' :
          '<div class="cav" style="background:var(--accent);">' + initial + '</div>';

        var normPhone = normalizePhoneForDisplay(contact.phone);
        var regInfo = registered[normPhone] || registered[contact.phone];

        var statusLabel = !statusKnown
          ? '\u23F3 Checking\u2026'
          : checkFailed
            ? '\u26A0\uFE0F Unknown'
            : (regInfo ? '\u2705 On Fizzme' : '\uD83D\uDCF1 Invite');

        div.innerHTML = avatarHtml +
          '<div>' +
            '<div class="cname">' + (contact.name || 'Unknown') + '</div>' +
            '<div class="cphone">' + (contact.phone || '') + '</div>' +
          '</div>' +
          '<span class="cstatus">' + statusLabel + '</span>';

        if (!statusKnown || checkFailed) {
          // Still checking (or the check failed) — visible and scrollable,
          // just not yet actionable since we don't know which action
          // (open chat vs. SMS invite) would actually be correct.
          div.querySelector('.cstatus').style.color = 'var(--sub)';
        } else if (regInfo) {
          div.querySelector('.cstatus').style.color = '#25d366';
          div.onclick = function() {
            var username = regInfo.username;
            if (!document.querySelector('.conversation-item[data-recipient="' + username + '"]')) {
              chat.addConversationItem({
                username: username,
                profile_picture: regInfo.profile_picture
              });
            }
            contacts.closeContactsModal();
            var item = document.querySelector('.conversation-item[data-recipient="' + username + '"]');
            if (item) item.click();
          };
        } else {
          var isUnregistered = unregistered.some(function(u) {
            return normalizePhoneForDisplay(u) === normalizePhoneForDisplay(contact.phone);
          });

          if (isUnregistered) {
            div.querySelector('.cstatus').style.color = 'var(--sub)';
            div.onclick = function() {
              showConfirm({
                icon: '📱',
                title: 'Invite to Asterix',
                body: (contact.name || 'This contact') + ' isn\'t on Asterix yet. Send an SMS invite?',
                okLabel: 'Send SMS',
                okClass: 'primary'
              }).then(function(ok) {
                if (ok && window.AndroidBridge && window.AndroidBridge.sendSms) {
                  window.AndroidBridge.sendSms(contact.phone, 'Join me on Fizzme! https://fizzme.pythonanywhere.com');
                  toast('Invite sent', 'SMS sent to ' + (contact.name || ''));
                }
              });
            };
          }
        }

        container.appendChild(div);
      });
    }

    // Render right away — scrollable immediately, badges read "Checking…"
    render(searchInput.value || '');
    searchInput.oninput = function() { render(this.value); };

    // Use the batch endpoint in the background; update in place once it
    // resolves instead of gating the whole list behind it.
    fetch('/api/contacts/check-phones/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrf()
      },
      body: JSON.stringify({ phones: phones })
    })
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(result) {
      registered = result.registered || {};
      unregistered = result.unregistered || [];
      statusKnown = true;
      render(searchInput.value || '');
    })
    .catch(function(e) {
      console.warn('Batch phone check failed:', e);
      // Keep the already-visible, scrollable list intact instead of
      // wiping it out — just mark status as unresolvable so rows don't
      // falsely claim "Invite" for contacts that might actually be
      // registered.
      statusKnown = true;
      checkFailed = true;
      render(searchInput.value || '');
      toast('Error', 'Could not check contacts\u2019 Asterix status.');
    });
  };

  // ── Helper: normalize phone for comparison ──────────────────
  function normalizePhoneForDisplay(phone) {
    if (!phone) return '';
    // Remove all non-digit except leading +
    var cleaned = phone.replace(/[^0-9+]/g, '');
    // Ensure +260 prefix for Zambian numbers
    if (cleaned.startsWith('0') && cleaned.length >= 9) {
      return '+260' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10 && (cleaned.startsWith('7') || cleaned.startsWith('9'))) {
        return '+260' + cleaned;
      }
    }
    return cleaned;
  }

  // ── Add contact by phone ─────────────────────────────────────
  contacts.addContactByPhone = async function(phone) {
    try {
      var ar = await fetch('/api/contacts/add-by-phone/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf() },
        body: JSON.stringify({ phone_number: phone })
      });
      var ad = await ar.json();
      if (!ar.ok) {
        toast(ad.status === 'not_registered' ? 'Not on Asterix yet' : 'Error', ad.message || 'Could not add contact.');
        return;
      }
      toast('Added', ad.message || ad.contact.username + ' added to contacts.');
      if (ad.contact && !document.querySelector('.conversation-item[data-recipient="' + ad.contact.username + '"]')) {
        chat.addConversationItem(ad.contact);
      }
      // Refresh contacts modal if open
      if (document.getElementById('contacts-modal-overlay').classList.contains('open')) {
        contacts.loadPhoneContacts();
      }
    } catch(e) {
      console.error(e);
      toast('Error', 'Something went wrong adding that contact.');
    }
  };

  // ── Contact picker (Android bridge → Web API → manual) ──────
  contacts.pickContact = async function() {
    if (window.AndroidBridge && window.AndroidBridge.pickContact) {
      try {
        var contactJson = window.AndroidBridge.pickContact();
        if (contactJson) {
          var contact = typeof contactJson === 'string' ? JSON.parse(contactJson) : contactJson;
          if (contact && contact.phone) {
            await contacts.addContactByPhone(contact.phone);
            return;
          }
        }
      } catch(e) { console.warn('Android contact picker failed:', e); }
    }
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        var picked = await navigator.contacts.select(['name', 'tel'], { multiple: false });
        if (picked && picked.length) {
          var person = picked[0];
          var tel = person.tel && person.tel[0];
          if (!tel) {
            toast('No phone number', ((person.name && person.name[0]) || 'That contact') + ' has no phone number saved.');
            return;
          }
          await contacts.addContactByPhone(tel);
          return;
        }
      } catch (e) { console.warn('Contact picker unavailable:', e); }
    }
    var phone = await utils.showPhoneModal();
    if (phone) await contacts.addContactByPhone(phone);
  };

})(window._contacts = window._contacts || {}, window._utils, window._chat);