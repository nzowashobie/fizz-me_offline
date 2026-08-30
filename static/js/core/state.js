// ============================================================
// state.js — Single source of truth for mutable app state
// ============================================================

var State = {
  // ── Identity ──────────────────────────────────────────────
  ME: (window.ASTERIX && window.ASTERIX.ME) || '',

  // ── Chat ──────────────────────────────────────────────────
  activeRecipient:   null,
  lastMsgId:         0,
  prevCounts:        {},
  pendingRead:       new Set(),

  // ── Polling ───────────────────────────────────────────────
  pollTimer:         null,
  pollInitialized:   false,
  errStreak:         0,

  // ── Audio ─────────────────────────────────────────────────
  audioUnlocked:         false,
  notificationsMuted:    false,

  // ── Offline queue ─────────────────────────────────────────
  offlineQueue: (function() {
    try { return JSON.parse(localStorage.getItem('asterix_offline_queue')) || []; }
    catch(e) { return []; }
  })(),

  // ── Status viewer ─────────────────────────────────────────
  sv: {
    playlist:        [],
    idx:             0,
    timer:           null,
    duration:        SV_DURATION,
    currentCategory: null,
    segFill:         null
  },

  // ── Edit status ───────────────────────────────────────────
  editStatusId: null,

  // ── Wedding panel ─────────────────────────────────────────
  wp: {
    activeEventId:  null,
    activeInviteUrl: null,
    selectedVis:    'invite_only'
  },

  // ── Forward modal ─────────────────────────────────────────
  fwd: {
    msg:      null,
    selected: null,
    resolve:  function() {}
  },

  // ── Modal resolvers ───────────────────────────────────────
  confirmResolve: function() {},
  alertResolve:   function() {},
  phoneResolve:   function() {}
};
