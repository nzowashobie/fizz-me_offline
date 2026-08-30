// ============================================================
// profile.js — Enhanced profile picture upload + preview
// ============================================================

(function() {
  'use strict';

  function init() {
    // ── DOM refs ────────────────────────────────────────────────
    var modalOverlay = document.getElementById('profile-modal-overlay');
    var modalImg      = document.getElementById('profile-modal-img');
    var sidebarAvatar = document.getElementById('my-avatar');
    var headerAvatar  = document.getElementById('chat-header-avatar');
    var fileInput     = document.getElementById('profile-pic-input');
    var changeBtn     = document.getElementById('btn-change-pic');
    var saveBtn       = document.getElementById('pp-save-btn');
    var usernameInput = document.getElementById('pp-edit-username');
    var statusEl      = document.getElementById('pp-save-status');

    if (!changeBtn || !fileInput || !saveBtn) {
      console.warn('[profile.js] Required DOM elements not found. Aborting.');
      return;
    }

    function updateAvatars(url) {
      if (modalImg) modalImg.src = url;
      if (sidebarAvatar) sidebarAvatar.src = url;
      if (headerAvatar) headerAvatar.src = url;
    }

    function uploadProfilePicture(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(e) { updateAvatars(e.target.result); };
      reader.readAsDataURL(file);

      if (window.Asterix && window.Asterix.ui && typeof window.Asterix.ui.showSpinner === 'function') {
        window.Asterix.ui.showSpinner('Uploading picture…');
      }

      var fd = new FormData();
      fd.append('profile_picture', file);

      fetch('/api/upload-profile-picture/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrf() },
        body: fd
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (window.Asterix && window.Asterix.ui && typeof window.Asterix.ui.hideSpinner === 'function') {
          window.Asterix.ui.hideSpinner();
        }
        if (d.profile_picture_url) {
          updateAvatars(d.profile_picture_url);
          if (typeof toast === 'function') toast('✅', 'Profile picture updated.');
        } else {
          if (typeof toast === 'function') toast('Error', d.error || 'Upload failed.');
        }
      })
      .catch(function() {
        if (window.Asterix && window.Asterix.ui && typeof window.Asterix.ui.hideSpinner === 'function') {
          window.Asterix.ui.hideSpinner();
        }
        if (typeof toast === 'function') toast('Error', 'Picture upload failed.');
      });
    }

    changeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      fileInput.click();
    });

    fileInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        uploadProfilePicture(this.files[0]);
        this.value = '';
      }
    });

    saveBtn.addEventListener('click', function(e) {
      e.preventDefault();
      var newName = usernameInput.value.trim();
      if (!newName) {
        statusEl.textContent = 'Name cannot be empty.';
        statusEl.className = 'modal-status err';
        return;
      }
      if (newName.length > 150) {
        statusEl.textContent = 'Name too long (max 150 chars).';
        statusEl.className = 'modal-status err';
        return;
      }

      // ── Use updateProfile (works in both core and app API) ──
      var api = (typeof API !== 'undefined') ? API : (window.API || null);
      if (!api || typeof api.updateProfile !== 'function') {
        console.error('[profile.js] API.updateProfile not found. API:', api);
        statusEl.textContent = 'API not available. Please refresh and try again.';
        statusEl.className = 'modal-status err';
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      statusEl.textContent = '';
      statusEl.className = 'modal-status';

      if (window.Asterix && window.Asterix.ui && typeof window.Asterix.ui.showSpinner === 'function') {
        window.Asterix.ui.showSpinner('Updating username…');
      }

      api.updateProfile({ username: newName })
        .then(function(res) {
          if (window.Asterix && window.Asterix.ui && typeof window.Asterix.ui.hideSpinner === 'function') {
            window.Asterix.ui.hideSpinner();
          }
          if (res.ok && res.data.status === 'success') {
            statusEl.textContent = '✅ Saved!';
            statusEl.className = 'modal-status ok';
            var nameDisplay = document.getElementById('pp-modal-username');
            if (nameDisplay) nameDisplay.textContent = newName;
            setTimeout(function() {
              if (modalOverlay) {
                modalOverlay.classList.remove('open');
                modalOverlay.style.display = 'none';
              }
            }, 900);
          } else {
            statusEl.textContent = res.data.message || 'Could not save.';
            statusEl.className = 'modal-status err';
          }
        })
        .catch(function(err) {
          if (window.Asterix && window.Asterix.ui && typeof window.Asterix.ui.hideSpinner === 'function') {
            window.Asterix.ui.hideSpinner();
          }
          statusEl.textContent = 'Network error: ' + (err.message || '');
          statusEl.className = 'modal-status err';
        })
        .finally(function() {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
        });
    });

    function getCsrf() {
      var cookie = document.cookie.split('; ').find(function(r) { return r.startsWith('csrftoken='); });
      return cookie ? cookie.split('=')[1] : (window.ASTERIX && window.ASTERIX.CSRF) || '';
    }

    window.Asterix = window.Asterix || {};
    window.Asterix.profile = {
      uploadProfilePicture: uploadProfilePicture,
      updateAvatars: updateAvatars
    };

    console.log('[Asterix] Profile module loaded.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();