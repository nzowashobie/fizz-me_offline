// ============================================================
// constants.js — App-wide immutable configuration
// ============================================================

var POLL_ACTIVE  = 4000;   // ms between polls when tab is visible
var POLL_HIDDEN  = 20000;  // ms between polls when tab is hidden
var POLL_MAX     = 60000;  // max backoff interval on errors

var SV_DURATION = 5000;   // default status slide duration (ms)

var SV_CATEGORIES = ['General', 'Funerals', 'Weddings', 'Market', 'Church'];

var SV_CAT_ICONS = {
  General:  '🌐',
  Funerals: '🕊️',
  Weddings: '💍',
  Market:   '🛒',
  Church:   '⛪'
};

var CATEGORY_EMOJIS = {
  General:  ['😀', '😂', '❤️', '🔥', '🙏', '😮', '👍', '🎉', '💯', '😍'],
  Funerals: ['😢', '🕊️', '🙏', '💔', '😞', '🌹', '🕯️', '💐'],
  Weddings: ['💍', '❤️', '🎊', '💒', '🥂', '💐', '😍', '🎶', '👰', '💑'],
  Market:   ['🛒', '💰', '🔥', '👍', '⭐', '💸', '🏷️', '✅', '📦', '💎'],
  Church:   ['🙏', '✝️', '☦️', '😇', '🕊️', '📖', '🌟', '💒', '🎶', '🙌']
};
var DEFAULT_EMOJIS = ['😀', '😂', '❤️', '🔥', '🙏', '😮', '👍', '🎉', '💯', '😍'];

var CHAT_EMOJIS = [
  '😀','😂','😍','😭','😎','🥹','🤔','😴','🤩','😡',
  '👍','👎','❤️','💔','🔥','✅','⭐','🎉','🙏','💯',
  '😢','😅','🥺','😤','😏','🙃','😬','🤣','😇','🥳',
  '👋','✌️','🤞','💪','🫂','🤝','🫶','👀','💀','🫠',
  '🌹','🌟','🍕','☕','🎵','🚀','💡','📸','🎂','🏆',
  '😴','🤓','🧐','🤯','🥴','😵','🤐','🫡','🥶','🥵'
];
