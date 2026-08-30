// ============================================================
// modals.js — Promise-based modal helpers and profile actions
// ============================================================

// ── Confirm Dialog ─────────────────────────────────────────────────
function showConfirm(options) {
  options = options || {};
  return new Promise(function(resolve) {
    document.getElementById('confirm-icon').textContent  = options.icon    || '⚠️';
    document.getElementById('confirm-title').textContent = options.title   || 'Are you sure?';
    document.getElementById('confirm-body').textContent  = options.body    || '';
    var btn = document.getElementById('confirm-ok-btn');
    btn.textContent = options.okLabel || 'Confirm';
    btn.className   = 'modal-btn ' + (options.okClass || 'danger');
    document.getElementById('confirm-modal').classList.add('open');
    _confirmResolve = function(val) {
      document.getElementById('confirm-modal').classList.remove('open');
      resolve(val);
    };
  });
}

// ── Alert Dialog ───────────────────────────────────────────────────
function showAlert(options) {
  options = options || {};
  return new Promise(function(resolve) {
    document.getElementById('alert-icon').textContent  = options.icon  || 'ℹ️';
    document.getElementById('alert-title').textContent = options.title || 'Notice';
    document.getElementById('alert-body').textContent  = options.body  || '';
    document.getElementById('alert-modal').classList.add('open');
    _alertResolve = function() {
      document.getElementById('alert-modal').classList.remove('open');
      resolve();
    };
  });
}

// ── Phone Modal ────────────────────────────────────────────────────
function showPhoneModal() {
  return new Promise(function(resolve) {
    var inp = document.getElementById('phone-modal-input');
    inp.value = '';
    document.getElementById('phone-modal-status').textContent = '';
    document.getElementById('phone-modal-status').className   = 'modal-status';
    document.getElementById('phone-modal').classList.add('open');
    inp.focus();
    inp.onkeydown = function(e) { if (e.key === 'Enter') document.getElementById('phone-modal-ok').click(); };
    _phoneResolve = function(val) {
      if (val === null) {
        document.getElementById('phone-modal').classList.remove('open');
        resolve(null); return;
      }
      if (!val) {
        document.getElementById('phone-modal-status').textContent = 'Please enter a phone number.';
        document.getElementById('phone-modal-status').className   = 'modal-status err';
        return;
      }
      document.getElementById('phone-modal').classList.remove('open');
      resolve(val);
    };
  });
}

// ── Profile Modal ──────────────────────────────────────────────────
document.getElementById('ua-profile-modal-btn').onclick = function() {
  var el = document.getElementById('profile-modal-overlay');
  el.classList.add('open'); el.style.display = 'flex';
};
document.getElementById('btn-change-pic').onclick = function() {
  var input = document.getElementById('profile-pic-input');
  if (input) input.click();
};

async function saveProfileUsername() {
  var newName  = document.getElementById('pp-edit-username').value.trim();
  var statusEl = document.getElementById('pp-save-status');
  var btn      = document.getElementById('pp-save-btn');
  if (!newName) { statusEl.textContent = 'Name cannot be empty.'; statusEl.className = 'modal-status err'; return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    var res = await API.updateUsername(newName);
    if (res.ok && res.data.status === 'success') {
      statusEl.textContent = 'Saved!'; statusEl.className = 'modal-status ok';
      document.getElementById('pp-modal-username').textContent = newName;
      setTimeout(function() {
        document.getElementById('profile-modal-overlay').classList.remove('open');
        document.getElementById('profile-modal-overlay').style.display = 'none';
      }, 900);
    } else {
      statusEl.textContent = res.data.message || 'Could not save.';
      statusEl.className   = 'modal-status err';
    }
  } catch(e) { statusEl.textContent = 'Network error.'; statusEl.className = 'modal-status err'; }
  finally { btn.disabled = false; btn.textContent = 'Save Changes'; }
}

// ── Profile picture upload ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var picInput = document.getElementById('profile-pic-input');
  if (picInput) {
    picInput.onchange = function() {
      if (!this.files[0]) return;
      var localUrl = URL.createObjectURL(this.files[0]);
      document.getElementById('profile-modal-img').src = localUrl;
      var fd = new FormData(); fd.append('profile_picture', this.files[0]);
      API.uploadProfilePicture(fd)
        .then(function(d) {
          document.getElementById('my-avatar').src = d.profile_picture_url;
          document.getElementById('profile-modal-img').src = d.profile_picture_url;
          URL.revokeObjectURL(localUrl);
          toast('Done', 'Profile picture updated.');
        })
        .catch(function() {
          document.getElementById('profile-modal-img').src = document.getElementById('my-avatar').src;
          toast('Error', 'Picture upload failed.');
        });
    };
  }
});

// ── Partners Modal ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var partnersBtn = document.getElementById('ua-partners-modal-btn');
  if (partnersBtn) {
    partnersBtn.onclick = function() {
      var el = document.getElementById('partners-modal-overlay');
      if (el) {
        el.classList.add('open');
        el.style.display = 'flex';
      }
    };
  }
});