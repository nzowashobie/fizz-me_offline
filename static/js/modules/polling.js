// ============================================================
// polling.js — HTTP polling for new messages and unread counts
//                with IndexedDB merge, heartbeat, and 3s interval
// ============================================================

// ── Interval: 3 seconds (per user request) ────────────────────
var POLL_ACTIVE = 3000;
var POLL_HIDDEN = 10000;
var POLL_MAX_BACKOFF = 30000;

async function pollMessages() {
  if (!State.activeRecipient || State.lastMsgId === null || State.lastMsgId === undefined) {
    console.log('[polling] No active recipient or lastMsgId, skipping poll');
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
      var existing = box.querySelector('[data-msg-id="' + m.id + '"]') ||
                     box.querySelector('[data-server-id="' + m.id + '"]');
      if (existing) return;
      // buildBubble must be exposed globally from chat.js
      if (typeof buildBubble !== 'function') {
        console.warn('[polling] buildBubble not defined, cannot render message');
        return;
      }
      var bubble = buildBubble(m);
      bubble.setAttribute('data-server-id', m.id);
      box.appendChild(bubble);
      State.lastMsgId = m.id;
      added++;
    });
    if (added && atBottom) box.scrollTop = box.scrollHeight;
    if (added) {
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
  Object.keys(previews).forEach(function(who) {
    var el = document.getElementById('preview-' + who);
    if (!el) return;
    var p = previews[who];
    if (!p.preview) return;
    el.textContent = (p.from_me ? 'You: ' : '') + p.preview;
  });
}

async function pollUnread() {
  await pollMessages();
  var res    = await API.getUnreadCounts();
  var counts = res.data;
  var total  = 0;

  fetchConversationPreviews().then(applyConversationPreviews);

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
      playNotifSound();
      if (window.AndroidBridge && window.AndroidBridge.showNotification) {
        try {
          var avatar = document.querySelector('.conversation-item[data-recipient="' + who + '"] .conv-avatar');
          var avatarUrl = avatar ? avatar.src : '';
          window.AndroidBridge.showNotification('💬 ' + who, 'New message', avatarUrl, window.location.href);
        } catch(e) { /* ignore */ }
      }
      toast('💬 ' + who, 'New message');
    }
  });

  State.prevCounts    = counts;
  State.pollInitialized = true;
  document.title = total > 0 ? '(' + total + ') Asterix' : 'Asterix';
}

function _pollDelay() {
  if (State.errStreak) return Math.min(POLL_ACTIVE * Math.pow(2, State.errStreak), POLL_MAX);
  return document.hidden ? POLL_HIDDEN : POLL_ACTIVE;
}

async function pollLoop() {
  try {
    await pollUnread();
    State.errStreak = 0;
  } catch(e) {
    State.errStreak = Math.min(State.errStreak + 1, 4);
    console.warn('[polling] pollLoop error:', e);
  } finally {
    clearTimeout(State.pollTimer);
    State.pollTimer = setTimeout(pollLoop, _pollDelay());
  }
}

// ── Expose for chat.js and other modules ──────────────────────
window.pollLoop = pollLoop;
window.pollUnread = pollUnread;
window.fetchConversationPreviews = fetchConversationPreviews;
window.applyConversationPreviews = applyConversationPreviews;

// ── Restart polling manually (useful after clear chat) ─────────
window.restartPolling = function() {
  clearTimeout(State.pollTimer);
  State.pollTimer = null;
  pollLoop();
};

// ── Event listeners ─────────────────────────────────────────────
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    clearTimeout(State.pollTimer);
    State.pollTimer = null;
    pollLoop();
  }
});

// ── Heartbeat: restart polling if it stops unexpectedly ──────────
function pollingHeartbeat() {
  if (!State.pollTimer) {
    console.warn('[polling] Poll timer missing – restarting polling.');
    pollLoop();
  }
}
setInterval(pollingHeartbeat, 30000);

// ── Start polling when DOM is ready ────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', pollLoop);
} else {
  pollLoop();
}

console.log('[Asterix] Polling module loaded (3s interval, heartbeat active)');