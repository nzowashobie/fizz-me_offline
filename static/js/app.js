// ============================================================
// app.js — AJAX wrapper for all backend endpoints
// ============================================================

var API = (function() {
  function csrf() {
    var cookie = document.cookie.split('; ').find(function(r) { return r.startsWith('csrftoken='); });
    return cookie ? cookie.split('=')[1] : '';
  }

  // ── IMPROVED request: always read as text first ────────────
  function request(method, url, data, isFormData) {
    var options = {
      method: method,
      headers: { 'X-CSRFToken': csrf() }
    };
    if (data) {
      if (isFormData) {
        options.body = data;
      } else {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
      }
    }
    return fetch(url, options)
      .then(function(r) {
        return r.text().then(function(text) {
          var parsed = null;
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            parsed = { error: text || 'Server returned non‑JSON response' };
          }
          return { ok: r.ok, status: r.status, data: parsed, rawText: text };
        });
      })
      .catch(function() {
        return { ok: false, status: 0, data: { error: 'Network error' }, rawText: '' };
      });
  }

  // ── Messages ────────────────────────────────────────────────────────
  function getMessages(recipient, options) {
    options = options || {};
    var params = '?recipient=' + encodeURIComponent(recipient);
    if (options.before_id) params += '&before_id=' + options.before_id;
    if (options.after_id) params += '&after_id=' + options.after_id;
    if (options.limit) params += '&limit=' + options.limit;
    if (options._t) params += '&_t=' + options._t; // cache‑busting
    return request('GET', '/api/messages/' + params);
  }

  // ── Poll: lightweight — only messages newer than afterId ────────────
  // Called by polling.js every 3 s. Always returns a JSON array from
  // the dedicated /api/messages/poll/ endpoint which never returns a
  // dict on error, so res.data.length is always safe to check.
  function pollMessages(recipient, afterId) {
    return request(
      'GET',
      '/api/messages/poll/?recipient=' + encodeURIComponent(recipient) +
        '&after_id=' + (afterId || 0)
    );
  }

  function sendMessage(formData) {
    return request('POST', '/api/messages/send/', formData, true);
  }

  function deleteMessage(id) {
    return request('DELETE', '/api/messages/delete/' + id + '/');
  }

  function markAsRead(sender) {
    return request('POST', '/api/messages/mark_as_read/?sender=' + encodeURIComponent(sender));
  }

  function getUnreadCounts() {
    return request('GET', '/api/messages/unread_count/');
  }

  function clearChat(recipient) {
    return request('POST', '/api/clear-chat/', { recipient_id: recipient });
  }

  // ── Contacts ────────────────────────────────────────────────────────
  function getContacts() {
    return request('GET', '/api/contacts/');
  }

  function addContactByPhone(phone) {
    return request('POST', '/api/contacts/add-by-phone/', { phone_number: phone });
  }

  function removeContact(username) {
    return request('POST', '/api/contacts/remove/', { username: username });
  }

  function blockUser(username) {
    return request('POST', '/api/block-user/', { username: username });
  }

  function getContactInfo(username) {
    return request('GET', '/api/contacts/info/?username=' + encodeURIComponent(username));
  }

  function checkPhones(phones) {
    return request('POST', '/api/contacts/check-phones/', { phones: phones });
  }

  // ── Status ──────────────────────────────────────────────────────────
  function getStatusFeed(category) {
    return request('GET', '/api/status/feed/' + encodeURIComponent(category) + '/');
  }

  function uploadStatus(formData) {
    return request('POST', '/api/status/upload/', formData, true);
  }

  function getMyStatuses() {
    return request('GET', '/api/status/mine/');
  }

  function deleteStatus(id) {
    return request('DELETE', '/api/status/' + id + '/delete/');
  }

  function editStatus(id, caption) {
    return request('POST', '/api/status/' + id + '/edit/', { caption: caption });
  }

  // ── Events (wedding) ──────────────────────────────────────────────
  function createEvent(formData) {
    return request('POST', '/api/events/create/', formData, true);
  }

  function inviteToEvent(eventId, usernames) {
    return request('POST', '/api/events/' + eventId + '/invite/', { usernames: usernames });
  }

  function getEventGuests(eventId) {
    return request('GET', '/api/events/' + eventId + '/guests/');
  }

  function shareEventToStatus(eventId) {
    return request('POST', '/api/events/' + eventId + '/share-to-status/', { category: 'Weddings' });
  }

  function getMyEvents() {
    return request('GET', '/api/events/my/');
  }

  // ── Profile ────────────────────────────────────────────────────────
  function updateProfile(data) {
    return request('POST', '/api/profile/update/', data);
  }

  function uploadProfilePicture(formData) {
    return request('POST', '/api/upload-profile-picture/', formData, true);
  }

  // ── Online users ──────────────────────────────────────────────────
  function getOnlineUsers() {
    return request('GET', '/api/users/online/');
  }

  // ── Public API ────────────────────────────────────────────────────
  return {
    getMessages: getMessages,
    pollMessages: pollMessages,        // ← fixes "API.pollMessages is not a function"
    sendMessage: sendMessage,
    deleteMessage: deleteMessage,
    markAsRead: markAsRead,
    getUnreadCounts: getUnreadCounts,
    clearChat: clearChat,
    getContacts: getContacts,
    addContactByPhone: addContactByPhone,
    removeContact: removeContact,
    blockUser: blockUser,
    getContactInfo: getContactInfo,
    checkPhones: checkPhones,
    getStatusFeed: getStatusFeed,
    uploadStatus: uploadStatus,
    getMyStatuses: getMyStatuses,
    deleteStatus: deleteStatus,
    editStatus: editStatus,
    createEvent: createEvent,
    inviteToEvent: inviteToEvent,
    getEventGuests: getEventGuests,
    shareEventToStatus: shareEventToStatus,
    getMyEvents: getMyEvents,
    updateProfile: updateProfile,
    uploadProfilePicture: uploadProfilePicture,
    getOnlineUsers: getOnlineUsers
  };
})();