// ============================================================
// polling.js — HTTP polling for new messages, read receipts, & typing
// ============================================================

var POLL_ACTIVE = 4000;
var POLL_HIDDEN = 30000;
var POLL_MAX_BACKOFF = 60000;

async function pollMessages() {
  if (!State.activeRecipient || typeof State.activeRecipient !== 'string' || State.activeRecipient.trim() === '' || State.lastMsgId === null || State.lastMsgId === undefined) {
    return;
  }
  try {
    var res = await API.pollMessages(State.activeRecipient, State.lastMsgId || 0);
    if (!res.ok) return;
    var msgs = res.data;
    if (!msgs.length) return;

    if (window.Sync && typeof Sync.mergeMessages === 'function') {
      await Sync.mergeMessages(State.activeRecipient, msgs);
    }

    var box = document.getElementById('id_chat_item_container');
    if (!box) return;
    var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    var added = 0;
    msgs.forEach(function(m) {
      if (!m.id || m.id <= State.lastMsgId) return;
      var existing = box.querySelector('[data-msg-id="' + m.id + '"]') || box.querySelector('[data-server-id="' + m.id + '"]');
      if (existing) return;
      if (typeof buildBubble !== 'function') return;
      var bubble = buildBubble(m);
      bubble.setAttribute('data-server-id', m.id);
      box.appendChild(bubble);
      State.lastMsgId = m.id;
      added++;
    });
    if (added && atBottom) box.scrollTop = box.scrollHeight;

    if (added && localStorage.getItem('asterix_read_receipts') !== 'false') {
      API.markAsRead(State.activeRecipient);
      if (window.Sync) Sync.markAsRead(State.activeRecipient);
    }
  } catch(e) {
    console.warn('[polling] pollMessages error:', e);
  }
}

function fetchConversationPreviews() {
  return fetch('/api/conversation-previews/')
    .then(function(r) { return r.ok ? r.json() : {}; })
    .catch(function() { return {}; });
}

function applyConversationPreviews(previews) {
  var list = document.getElementById('conversation-list');
  if (!list) return;

  var keys = Object.keys(previews);
  for (var i = keys.length - 1; i >= 0; i--) {
    var who = keys[i];
    var item = document.querySelector('.conversation-item[data-recipient="' + who + '"]');
    if (!item && window.Asterix && window.Asterix.chat && window.Asterix.chat.addConversationItem) {
      window.Asterix.chat.addConversationItem({
        username: who,
        profile_picture: previews[who].profile_picture || ''
      });
      item = document.querySelector('.conversation-item[data-recipient="' + who + '"]');
    }
    if (item && list.firstElementChild !== item) {
      list.prepend(item);
    }

    var el = document.getElementById('preview-' + who);
    if (!el) continue;
    var p = previews[who];
    if (!p.preview) continue;
    el.textContent = (p.from_me ? 'You: ' : '') + p.preview;
  }
}

async function pollReadReceipts() {
  if (localStorage.getItem('asterix_read_receipts') === 'false') return;

  if (!State.activeRecipient || typeof State.activeRecipient !== 'string' || !API.checkReadStatus) return;
  var pendingIds = [];
  document.querySelectorAll('.msg-row.mine').forEach(function(row) {
    var id = row.getAttribute('data-server-id');
    if (id) {
      var tick = row.querySelector('.msg-status i');
      if (tick && tick.classList.contains('fa-check') && !tick.classList.contains('fa-check-double')) {
        pendingIds.push(id);
      }
    }
  });
  if (pendingIds.length > 0) {
    try {
      var res = await API.checkReadStatus(pendingIds);
      if (res.ok && res.data.status) {
        for (var id in res.data.status) {
          if (res.data.status[id]) {
            var row = document.querySelector('[data-server-id="' + id + '"]');
            if (row) {
              var tick = row.querySelector('.msg-status i');
              if (tick) {
                tick.className = 'fas fa-check-double read-tick';
                tick.style.color = '#25d366';
              }
            }
          }
        }
      }
    } catch(e) {}
  }
}

function pollTyping() {
  if (!State.activeRecipient || typeof State.activeRecipient !== 'string' || !API.checkTyping) return;
  var who = State.activeRecipient;
  API.checkTyping(who).then(function(res) {
    if (State.activeRecipient !== who) return;
    var typing = !!(res && res.ok && res.data && res.data.typing);
    if (typing) {
      window.__fzTypingUntil = Date.now() + 3500;
      window.__fzWasTyping = true;

      var subEl = document.querySelector('.chat-header-sub');
      if (subEl) subEl.innerHTML = '<span style="color:#25d366; font-weight: 600;">typing...</span>';

      // SHOW TYPING BUBBLE
      if (window.Asterix && window.Asterix.chat && window.Asterix.chat.showTypingBubble) {
        window.Asterix.chat.showTypingBubble();
      }

    } else {
      window.__fzTypingUntil = 0;
      if (window.__fzWasTyping) {
        window.__fzWasTyping = false;

        // HIDE TYPING BUBBLE
        if (window.Asterix && window.Asterix.chat && window.Asterix.chat.hideTypingBubble) {
          window.Asterix.chat.hideTypingBubble();
        }

        if (window.Asterix && window.Asterix.chat && window.Asterix.chat.checkOnline) {
          window.Asterix.chat.checkOnline();
        }
      }
    }
  }).catch(function(){});
}

async function pollUnread() {
  await pollMessages();
  var res    = await API.getUnreadCounts();
  var counts = (res && res.ok && res.data) || {};
  var total  = 0;

  try {
    var previews = await fetchConversationPreviews();
    applyConversationPreviews(previews);
  } catch(e) {}

  document.querySelectorAll('.conversation-item').forEach(function(item) {
    var who    = item.getAttribute('data-recipient');
    var badge  = document.getElementById('unread-' + who);
    var n      = counts[who] || 0;
    var prev   = State.prevCounts[who] || 0;
    var suppress = (who === State.activeRecipient) || State.pendingRead.has(who);
    var display  = suppress ? 0 : n;
    var prevDisplay = suppress ? 0 : prev;
    total += display;

    if (badge && display !== prevDisplay) {
      badge.textContent = display > 0 ? String(display) : '';
      if (display > 0) {
        if (!badge.classList.contains('show')) {
          badge.classList.remove('hide');
          badge.classList.add('show');
          void badge.offsetWidth;
          badge.classList.add('pop');
          setTimeout(function() { badge.classList.remove('pop'); }, 400);
        } else {
          badge.classList.add('pop');
          setTimeout(function() { badge.classList.remove('pop'); }, 400);
        }
      } else {
        badge.classList.remove('show');
        badge.classList.add('hide');
        setTimeout(function() { badge.classList.remove('hide'); }, 300);
      }
    }
    if (State.pollInitialized && n > prev && !suppress) {
      if (typeof playNotifSound === 'function') playNotifSound();

      if (window.PWABridge && window.PWABridge.showLocalNotification) {
        window.PWABridge.showLocalNotification('💬 ' + who, { body: 'New message', icon: '/static/images/icon-192.png' });
      }
      if (window.AndroidBridge && window.AndroidBridge.showNotification) {
        try {
          var avatar = document.querySelector('.conversation-item[data-recipient="' + who + '"] .conv-avatar');
          var avatarUrl = avatar ? avatar.src : '';
          window.AndroidBridge.showNotification('💬 ' + who, 'New message', avatarUrl, window.location.href);
        } catch(e) { }
      }
      toast('💬 ' + who, 'New message');
    }
  });

  State.prevCounts    = counts;
  State.pollInitialized = true;
  document.title = total > 0 ? '(' + total + ')' + ' Fizzme' : 'Fizzme';
}

function _pollDelay() {
  if (State.errStreak) return Math.min(POLL_ACTIVE * Math.pow(2, State.errStreak), POLL_MAX_BACKOFF);
  return document.hidden ? POLL_HIDDEN : POLL_ACTIVE;
}

async function pollLoop() {
  try {
    await pollUnread();
    State.errStreak = 0;
  } catch(e) {
    State.errStreak = Math.min(State.errStreak + 1, 4);
  } finally {
    clearTimeout(State.pollTimer);
    State.pollTimer = setTimeout(pollLoop, _pollDelay());
  }
}

window.pollLoop = pollLoop;
window.pollUnread = pollUnread;
window.fetchConversationPreviews = fetchConversationPreviews;
window.applyConversationPreviews = applyConversationPreviews;

window.restartPolling = function() {
  clearTimeout(State.pollTimer);
  State.pollTimer = null;
  pollLoop();
};

document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    clearTimeout(State.pollTimer);
    State.pollTimer = null;
    pollLoop();
  }
});

function pollingHeartbeat() {
  if (!State.pollTimer) pollLoop();
}
setInterval(pollingHeartbeat, 30000);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', pollLoop);
} else {
  pollLoop();
}

(function() {
  var rrBusy = false;
  setInterval(function() {
    if (document.hidden) return;
    try { pollTyping(); } catch (e) {}
  }, 1500);
  setInterval(function() {
    if (document.hidden || rrBusy) return;
    rrBusy = true;
    Promise.resolve(pollReadReceipts()).catch(function() {}).then(function() { rrBusy = false; });
  }, 3000);
})();