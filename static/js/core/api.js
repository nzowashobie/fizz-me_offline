// ============================================================
// api.js — Centralised fetch wrappers with improved error handling
// ============================================================



var API = (function() {

  function csrf() {
    var cookie = document.cookie.split('; ').find(function(r) { return r.startsWith('csrftoken='); });
    return cookie ? cookie.split('=')[1] : (window.ASTERIX && window.ASTERIX.CSRF) || '';
  }

  // ── Response parser: tries JSON, falls back to text ──────────────
  function parseResponse(response) {
    return response.text().then(function(text) {
      try {
        var data = JSON.parse(text);
        return { ok: response.ok, status: response.status, data: data, text: text };
      } catch (e) {
        // Not JSON – return the raw text
        return { ok: response.ok, status: response.status, data: { error: text || 'Server error' }, text: text };
      }
    });
  }

  function _post(url, body, isFormData) {
    var headers = { 'X-CSRFToken': csrf() };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    return fetch(url, {
      method: 'POST',
      headers: headers,
      body: isFormData ? body : JSON.stringify(body)
    })
    .then(function(response) {
      return parseResponse(response);
    })
    .catch(function(err) {
      return { ok: false, status: 0, data: { error: 'Network error: ' + err.message } };
    });
  }

  function _get(url) {
    return fetch(url)
      .then(function(response) {
        return parseResponse(response);
      })
      .catch(function(err) {
        return { ok: false, data: { error: 'Network error: ' + err.message } };
      });
  }

  function _del(url) {
    return fetch(url, { method: 'DELETE', headers: { 'X-CSRFToken': csrf() } })
      .then(function(response) {
        return parseResponse(response);
      })
      .catch(function(err) {
        return { ok: false, status: 0, data: { error: 'Network error: ' + err.message } };
      });
  }

  return {
    // ── Messages ────────────────────────────────────────────────
    getMessages: function(recipient, options) {
      options = options || {};
      var params = '?recipient=' + encodeURIComponent(recipient);
      if (options.before_id) params += '&before_id=' + options.before_id;
      if (options.after_id) params += '&after_id=' + options.after_id;
      if (options.limit) params += '&limit=' + options.limit;
      return _get('/api/messages/' + params);
    },
    pollMessages: function(recipient, afterId) {
      return _get('/api/messages/?recipient=' + encodeURIComponent(recipient) + '&after_id=' + afterId);
    },
    sendMessage: function(fd) {
      return _post('/api/messages/send/', fd, true);
    },
    deleteMessage: function(id) {
      return _del('/api/messages/delete/' + id + '/');
    },
    markAsRead: function(sender) {
      return _post('/api/messages/mark_as_read/?sender=' + encodeURIComponent(sender), {});
    },
    getUnreadCounts: function() {
      return _get('/api/messages/unread_count/');
    },
    sendTyping: function(recipient) {
      return _post('/api/messages/typing/', { recipient: recipient });
    },
    checkTyping: function(recipient) {
      return _get('/api/messages/typing/check/?recipient=' + encodeURIComponent(recipient));
    },
    checkReadStatus: function(ids) {
      return _post('/api/messages/read-status/', { message_ids: ids });
    },
    clearChat: function(recipientId, permanent) {
      if (permanent === undefined) permanent = true;
      return _post('/api/clear-chat/', { recipient_id: recipientId, permanent: permanent });
    },

    // ── Contacts ────────────────────────────────────────────────
    getContacts: function() {
      return _get('/api/contacts/');
    },
    getContactInfo: function(username) {
      return _get('/api/contacts/info/?username=' + encodeURIComponent(username));
    },
    getContactInfoByPhone: function(phone) {
      return _get('/api/contacts/info-by-phone/?phone=' + encodeURIComponent(phone));
    },
    addContactByPhone: function(phone) {
      return _post('/api/contacts/add-by-phone/', { phone_number: phone });
    },
    removeContact: function(username) {
      return _post('/api/contacts/remove/', { username: username });
    },
    blockUser: function(username) {
      return _post('/api/block-user/', { username: username });
    },
    unblockUser: function(username) {
      return _post('/api/unblock-user/', { username: username });
    },
    getOnlineUsers: function() {
      return _get('/api/users/online/');
    },

    // ── Profile ──────────────────────────────────────────────────
    updateUsername: function(username) {
      return _post('/api/profile/update/', { username: username });
    },
    uploadProfilePicture: function(fd) {
      return fetch('/api/upload-profile-picture/', { method: 'POST', headers: { 'X-CSRFToken': csrf() }, body: fd })
        .then(function(r) { return r.json(); })
        .catch(function() { return { error: 'Upload failed' }; });
    },

    // ── Statuses ────────────────────────────────────────────────
    getStatusFeed: function(category) {
      return _get('/api/status/feed/' + encodeURIComponent(category) + '/');
    },
    recordStatusView: function(statusId) {
      return _post('/api/status/view/', { status_id: statusId });
    },
    getStatusViews: function(statusId) {
      return _get('/api/status/' + statusId + '/views/');
    },
    getMyStatuses: function() {
      return _get('/api/status/mine/');
    },
    uploadStatus: function(fd) {
      return fetch('/api/status/upload/', { method: 'POST', headers: { 'X-CSRFToken': csrf() }, body: fd })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); });
    },
    deleteStatus: function(id) {
      return fetch('/api/status/' + id + '/delete/', { method: 'DELETE', headers: { 'X-CSRFToken': csrf() } });
    },
    editStatus: function(id, caption) {
      return _post('/api/status/' + id + '/edit/', { caption: caption });
    },
    proxyMedia: function(url) {
      return fetch('/api/status/proxy-media/?url=' + encodeURIComponent(url));
    },

    // ── Events (Wedding Panel) ──────────────────────────────────
    createEvent: function(fd) {
      return fetch('/api/events/create/', { method: 'POST', headers: { 'X-CSRFToken': csrf() }, body: fd })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); });
    },
    inviteToEvent: function(eventId, usernames) {
      return _post('/api/events/' + eventId + '/invite/', { usernames: usernames });
    },
    getEventGuests: function(eventId) {
      return _get('/api/events/' + eventId + '/guests/');
    },
    shareEventToStatus: function(eventId) {
      return _post('/api/events/' + eventId + '/share-to-status/', { category: 'Weddings' });
    }
  };
})();