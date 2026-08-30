// ============================================================
// emoji.js — Chat emoji picker
// ============================================================

(function() {
  'use strict';

  function init() {
    // ── DOM refs ────────────────────────────────────────────────
    var toggleBtn = document.getElementById('emoji-toggle-btn');
    var pickerWrap = document.getElementById('emoji-picker-wrap');
    var msgInput = document.getElementById('msg-input');

    if (!toggleBtn || !pickerWrap || !msgInput) {
      console.warn('[emoji.js] Required DOM elements not found. Aborting.');
      return;
    }

    // ── Use emojis from constants (CHAT_EMOJIS) ───────────────
    var emojis = window.CHAT_EMOJIS || [
      '😀','😂','😍','😭','😎','🥹','🤔','😴','🤩','😡',
      '👍','👎','❤️','💔','🔥','✅','⭐','🎉','🙏','💯',
      '😢','😅','🥺','😤','😏','🙃','😬','🤣','😇','🥳',
      '👋','✌️','🤞','💪','🫂','🤝','🫶','👀','💀','🫠',
      '🌹','🌟','🍕','☕','🎵','🚀','💡','📸','🎂','🏆',
      '😴','🤓','🧐','🤯','🥴','😵','🤐','🫡','🥶','🥵'
    ];

    // ── Build emoji grid ──────────────────────────────────────
    function buildPicker() {
      pickerWrap.innerHTML = '';
      emojis.forEach(function(emoji) {
        var btn = document.createElement('button');
        btn.textContent = emoji;
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', 'Emoji ' + emoji);
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          insertEmoji(emoji);
          closePicker();
        });
        pickerWrap.appendChild(btn);
      });
    }

    // ── Insert emoji at cursor ────────────────────────────────
    function insertEmoji(emoji) {
      msgInput.focus();
      var start = msgInput.selectionStart;
      var end = msgInput.selectionEnd;
      var value = msgInput.value;
      var newValue = value.substring(0, start) + emoji + value.substring(end);
      msgInput.value = newValue;
      var newPos = start + emoji.length;
      msgInput.selectionStart = msgInput.selectionEnd = newPos;
      var event = new Event('input', { bubbles: true });
      msgInput.dispatchEvent(event);
    }

    // ── Toggle picker ──────────────────────────────────────────
    function togglePicker(e) {
      e.stopPropagation();
      var isOpen = pickerWrap.classList.contains('open');
      if (isOpen) {
        closePicker();
      } else {
        openPicker();
      }
    }

    function openPicker() {
      pickerWrap.classList.add('open');
      if (pickerWrap.children.length === 0) {
        buildPicker();
      }
    }

    function closePicker() {
      pickerWrap.classList.remove('open');
    }

    // ── Click outside to close ────────────────────────────────
    function handleDocumentClick(e) {
      if (!pickerWrap.contains(e.target) && e.target !== toggleBtn) {
        closePicker();
      }
    }

    // ── Wire up toggle button ─────────────────────────────────
    toggleBtn.addEventListener('click', togglePicker);

    // ── Listen for clicks outside ─────────────────────────────
    document.addEventListener('click', handleDocumentClick);

    // ── Also close on Escape key ──────────────────────────────
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && pickerWrap.classList.contains('open')) {
        closePicker();
      }
    });

    // ── Build picker once (lazy) ─────────────────────────────
    buildPicker();

    // ── Expose API ─────────────────────────────────────────────
    window.Asterix = window.Asterix || {};
    window.Asterix.emoji = {
      openPicker: openPicker,
      closePicker: closePicker,
      togglePicker: togglePicker,
      insertEmoji: insertEmoji,
      buildPicker: buildPicker
    };

    console.log('[Asterix] Emoji picker loaded.');
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();