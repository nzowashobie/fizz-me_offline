// ============================================================
// sync.js — IndexedDB persistent message store & sync manager
// ============================================================

(function() {
  'use strict';

  var DB_NAME = 'AsterixMessages';
  var DB_VERSION = 2;
  var STORE_NAME = 'messages';
  var DELETE_STORE = 'pendingDeletes';

  var db = null;
  var dbReady = false;
  var syncTimer = null;

  // ── In-flight send guard ─────────────────────────────────────────
  // chat.js's own 'online' listener AND this module's 'online' listener
  // both call flushOutgoingQueue() on the same reconnect event. Without
  // this, both calls independently read the same still-'pending' message
  // from IndexedDB and both POST it, producing a duplicate message
  // server-side. This Set makes flushOutgoingQueue() safe to call any
  // number of times concurrently — each local message can only be
  // "claimed" by one in-flight send at a time.
  var inFlightIds = new Set();

  function openDB() {
    return new Promise(function(resolve, reject) {
      if (db && dbReady) { resolve(db); return; }
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) {
          var store = d.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('recipient', 'recipient', { unique: false });
          store.createIndex('sender', 'sender', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
        if (!d.objectStoreNames.contains(DELETE_STORE)) {
          d.createObjectStore(DELETE_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = function(e) {
        db = e.target.result;
        dbReady = true;
        resolve(db);
      };
      request.onerror = function(e) { reject(e.target.error); };
    });
  }

  function saveMessage(msg) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var request = store.put(msg);
        request.onsuccess = function() { resolve(msg); };
        request.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function getMessages(recipient, limit) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var index = store.index('recipient');
        var range = IDBKeyRange.only(recipient);
        var request = index.openCursor(range, 'prev');
        var results = [];
        var count = 0;
        request.onsuccess = function(e) {
          var cursor = e.target.result;
          if (cursor && (!limit || count < limit)) {
            results.push(cursor.value);
            count++;
            cursor.continue();
          } else {
            resolve(results.reverse());
          }
        };
        request.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function getPendingMessages() {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var index = store.index('status');
        var range = IDBKeyRange.only('pending');
        var request = index.openCursor(range);
        var results = [];
        request.onsuccess = function(e) {
          var cursor = e.target.result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        request.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function updateMessageStatus(id, status, extra) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var getReq = store.get(id);
        getReq.onsuccess = function() {
          var msg = getReq.result;
          if (!msg) { resolve(null); return; }
          msg.status = status;
          if (extra) {
            Object.keys(extra).forEach(function(k) { msg[k] = extra[k]; });
          }
          var putReq = store.put(msg);
          putReq.onsuccess = function() { resolve(msg); };
          putReq.onerror = function(e) { reject(e.target.error); };
        };
        getReq.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function deleteMessage(id) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var request = store.delete(id);
        request.onsuccess = function() { resolve(); };
        request.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function deleteMessagesForRecipient(recipient) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var index = store.index('recipient');
        var range = IDBKeyRange.only(recipient);
        var cursor = index.openCursor(range);
        var count = 0;
        cursor.onsuccess = function(e) {
          var c = e.target.result;
          if (c) {
            store.delete(c.primaryKey);
            count++;
            c.continue();
          } else {
            resolve(count);
          }
        };
        cursor.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function markAsRead(recipient) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var index = store.index('recipient');
        var range = IDBKeyRange.only(recipient);
        var cursor = index.openCursor(range);
        var updated = 0;
        cursor.onsuccess = function(e) {
          var c = e.target.result;
          if (c) {
            var msg = c.value;
            if (!msg.is_read && msg.sender !== State.ME) {
              msg.is_read = true;
              store.put(msg);
              updated++;
            }
            c.continue();
          } else {
            resolve(updated);
          }
        };
        cursor.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function queueDelete(id) {
    if (id === null || id === undefined) return Promise.resolve();
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(DELETE_STORE, 'readwrite');
        var store = tx.objectStore(DELETE_STORE);
        var request = store.put({ id: id, queued_at: Date.now() });
        request.onsuccess = function() { resolve(); };
        request.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function clearPendingDelete(id) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(DELETE_STORE, 'readwrite');
        var store = tx.objectStore(DELETE_STORE);
        var request = store.delete(id);
        request.onsuccess = function() { resolve(); };
        request.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function getPendingDeleteIds() {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(DELETE_STORE, 'readonly');
        var store = tx.objectStore(DELETE_STORE);
        var ids = [];
        var cursorReq = store.openCursor();
        cursorReq.onsuccess = function(e) {
          var c = e.target.result;
          if (c) {
            ids.push(c.value.id);
            c.continue();
          } else {
            resolve(ids);
          }
        };
        cursorReq.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function flushPendingDeletes() {
    if (!navigator.onLine || !window.API || typeof API.deleteMessage !== 'function') {
      return Promise.resolve();
    }
    return getPendingDeleteIds().then(function(ids) {
      if (!ids.length) return Promise.resolve();
      var promises = ids.map(function(id) {
        return API.deleteMessage(id)
          .then(function(res) {
            if (res && res.ok) {
              return clearPendingDelete(id);
            }
            if (res && res.status === 404) {
              return clearPendingDelete(id);
            }
          })
          .catch(function() {});
      });
      return Promise.all(promises);
    });
  }

  function flushOutgoingQueue() {
    if (!navigator.onLine) return Promise.resolve();
    return getPendingMessages().then(function(pending) {
      // Claim every message we're about to send *synchronously*, right
      // here, before any async work (fetch, etc.) starts. If this function
      // is already running elsewhere (e.g. called by both chat.js's and
      // this module's 'online' listeners on the same reconnect), that
      // other call already claimed these ids and we skip them — the
      // message only ever gets sent once.
      var toSend = pending.filter(function(msg) {
        return !msg.server_id && !inFlightIds.has(msg.id);
      });
      toSend.forEach(function(msg) { inFlightIds.add(msg.id); });

      var promises = toSend.map(function(msg) {
        var fd = new FormData();
        fd.append('recipient', msg.recipient);
        fd.append('message', msg.message || '');
        if (msg.reply_to) {
          fd.append('reply_to', msg.reply_to);
          fd.append('reply_sender', msg.reply_sender || '');
          fd.append('reply_text', msg.reply_text || '');
          if (msg.reply_media) fd.append('reply_media', msg.reply_media);
        }
        return API.sendMessage(fd)
          .then(function(res) {
            inFlightIds.delete(msg.id);
            if (res.ok && res.data.status === 'success') {
              var serverMsg = res.data.message;
              return updateMessageStatus(msg.id, 'sent', { server_id: serverMsg.id, attachments: serverMsg.attachments || [] });
            } else {
              return updateMessageStatus(msg.id, 'failed');
            }
          })
          .catch(function() {
            inFlightIds.delete(msg.id);
            return updateMessageStatus(msg.id, 'failed');
          });
      });
      return Promise.all(promises);
    });
  }

  function retryFailedMessages() {
    if (!navigator.onLine) return;
    getPendingMessages().then(function(pending) {
      var failed = pending.filter(function(m) { return m.status === 'failed'; });
      if (!failed.length) return;
      flushOutgoingQueue().then(function() {
        getPendingMessages().then(function(stillPending) {
          var stillFailed = stillPending.filter(function(m) { return m.status === 'failed'; });
          if (stillFailed.length) {
            if (!syncTimer) {
              syncTimer = setTimeout(function() {
                syncTimer = null;
                retryFailedMessages();
              }, 5000);
            }
          }
        });
      });
    });
  }

  function mergeMessages(recipient, serverMsgs) {
    return Promise.all([openDB(), getPendingDeleteIds()]).then(function(results) {
      var d = results[0];
      var deletedIds = new Set(results[1]);
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var index = store.index('recipient');
        var range = IDBKeyRange.only(recipient);
        var cursor = index.openCursor(range);
        var localIds = new Set();
        cursor.onsuccess = function(e) {
          var c = e.target.result;
          if (c) {
            var msg = c.value;
            if (msg.server_id) localIds.add(msg.server_id);
            c.continue();
          } else {
            serverMsgs.forEach(function(sMsg) {
              if (localIds.has(sMsg.id)) return;
              if (deletedIds.has(sMsg.id)) return;
              var localMsg = {
                id: 'local_' + Date.now() + '_' + Math.random(),
                server_id: sMsg.id,
                sender: sMsg.sender,
                recipient: recipient,
                message: sMsg.message,
                timestamp: sMsg.timestamp,
                is_read: sMsg.is_read || false,
                status: 'received',
                attachments: sMsg.attachments || [],
                reply_to: sMsg.reply_to,
                reply_sender: sMsg.reply_sender || '',
                reply_text: sMsg.reply_text || '',
                reply_media: sMsg.reply_media || '',
                profile_picture: sMsg.profile_picture || '',
                related_status: sMsg.related_status || null   // NEW — commerce: which product this thread is about
              };
              store.put(localMsg);
            });
            resolve();
          }
        };
        cursor.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  var Sync = {
    openDB: openDB,
    saveMessage: saveMessage,
    getMessages: getMessages,
    getPendingMessages: getPendingMessages,
    updateMessageStatus: updateMessageStatus,
    deleteMessage: deleteMessage,
    deleteMessagesForRecipient: deleteMessagesForRecipient,
    markAsRead: markAsRead,
    flushOutgoingQueue: flushOutgoingQueue,
    retryFailedMessages: retryFailedMessages,
    mergeMessages: mergeMessages,
    queueDelete: queueDelete,
    clearPendingDelete: clearPendingDelete,
    getPendingDeleteIds: getPendingDeleteIds,
    flushPendingDeletes: flushPendingDeletes,
    dbReady: function() { return dbReady; }
  };

  window.Sync = Sync;

  document.addEventListener('DOMContentLoaded', function() {
    openDB().then(function() {
      if (navigator.onLine) {
        flushOutgoingQueue();
        flushPendingDeletes();
      }
    });
  });

  window.addEventListener('online', function() {
    flushOutgoingQueue();
    retryFailedMessages();
    flushPendingDeletes();
  });

  console.log('[Asterix] Sync module loaded (with deleteMessagesForRecipient)');
})();