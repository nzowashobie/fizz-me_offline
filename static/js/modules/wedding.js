// ============================================================
// wedding.js — Wedding / Events panel: create, invite card,
//              guest list, share to status, my events, cover photo
// ============================================================

// ── State for wedding panel ──────────────────────────────────────────
if (!window.State) window.State = {};
if (!State.wp) {
  State.wp = {
    selectedVis: 'invite_only',
    activeEventId: null,
    activeInviteUrl: null,
    guestPollTimer: null,
  };
}

// ── Open / Close ────────────────────────────────────────────────────
function openWeddingPanel() {
  document.getElementById('wedding-panel-overlay').classList.add('open');
  document.getElementById('wedding-panel').classList.add('open');
  switchWpTab('create');
}

function closeWeddingPanel() {
  document.getElementById('wedding-panel-overlay').classList.remove('open');
  document.getElementById('wedding-panel').classList.remove('open');
}

// ── Visibility selector ─────────────────────────────────────────────
function selectVisibility(chip) {
  document.querySelectorAll('.wp-vis-chip').forEach(function(c) { c.classList.remove('active'); });
  chip.classList.add('active');
  State.wp.selectedVis = chip.dataset.vis;
}

// ── Tab switching (includes "myevents") ────────────────────────────
function switchWpTab(tab) {
  ['create', 'invite', 'guests', 'myevents'].forEach(function(t) {
    var section = document.getElementById('wp-' + t + '-section');
    if (section) section.style.display = t === tab ? 'block' : 'none';
    var tabBtn = document.getElementById('wp-tab-' + t);
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });

  if (State.wp.guestPollTimer) {
    clearInterval(State.wp.guestPollTimer);
    State.wp.guestPollTimer = null;
  }

  if (tab === 'guests' && State.wp.activeEventId) {
    loadWeddingGuests();
    State.wp.guestPollTimer = setInterval(function() {
      if (State.wp.activeEventId && document.getElementById('wp-guests-section').style.display !== 'none') {
        loadWeddingGuests(true);
      }
    }, 3000);
  }
  
  if (tab === 'myevents') loadMyEvents();
}

// ── Event type toggle (show/hide bride/groom) ──────────────────────
document.getElementById('wp-event-type').addEventListener('change', function() {
  var showNames = ['wedding', 'lobola'].indexOf(this.value) !== -1;
  var wrap = document.getElementById('wp-names-wrap');
  if (wrap) wrap.style.display = showNames ? 'block' : 'none';
});

// ── Cover photo preview ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var coverInput = document.getElementById('wp-cover-photo');
  if (coverInput) {
    coverInput.addEventListener('change', function() {
      var file = this.files[0];
      var preview = document.getElementById('wp-cover-preview');
      var img = document.getElementById('wp-cover-preview-img');
      if (file) {
        var reader = new FileReader();
        reader.onload = function(e) {
          img.src = e.target.result;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        preview.style.display = 'none';
      }
    });
  }
});

// ── Create Event ────────────────────────────────────────────────────
async function createWeddingEvent() {
  var btn    = document.getElementById('wp-create-btn');
  var status = document.getElementById('wp-create-status');
  var title  = document.getElementById('wp-title').value.trim();
  var date   = document.getElementById('wp-date').value;

  if (!title) { status.textContent = 'Please enter a title.';         status.className = 'modal-status err'; return; }
  if (!date)  { status.textContent = 'Please pick a date and time.';  status.className = 'modal-status err'; return; }

  btn.disabled = true; btn.textContent = 'Creating…';
  status.textContent = ''; status.className = 'modal-status';

  try {
    var fd = new FormData();
    fd.append('event_type',    document.getElementById('wp-event-type').value);
    fd.append('title',         title);
    fd.append('bride_name',    (document.getElementById('wp-bride')         || {}).value || '');
    fd.append('groom_name',    (document.getElementById('wp-groom')         || {}).value || '');
    fd.append('venue',         (document.getElementById('wp-venue')         || {}).value || '');
    fd.append('event_date',    date);
    fd.append('dress_code',    (document.getElementById('wp-dress')         || {}).value || '');
    fd.append('rsvp_deadline', (document.getElementById('wp-rsvp-deadline') || {}).value || '');
    fd.append('family_name',   (document.getElementById('wp-family-name')   || {}).value || '');
    fd.append('family_phone',  (document.getElementById('wp-family-phone')  || {}).value || '');
    fd.append('description',   (document.getElementById('wp-description')   || {}).value || '');
    fd.append('visibility',    State.wp.selectedVis);

    var cover = document.getElementById('wp-cover-photo').files[0];
    if (cover) fd.append('cover_photo', cover);

    var res = await API.createEvent(fd);
    if (!res.ok) throw new Error(res.data.error || 'Could not create event.');

    State.wp.activeEventId  = res.data.event_id;
    var _origin = window.location.origin.replace(/^http:\/\//, 'https://');
    State.wp.activeInviteUrl = _origin + '/events/invite/' + res.data.invite_token + '/';

    status.textContent = '✅ Event created!'; status.className = 'modal-status ok';
    renderInviteCard(res.data);
    setTimeout(function() { switchWpTab('invite'); }, 600);
  } catch(e) {
    status.textContent = e.message; status.className = 'modal-status err';
  }
  btn.disabled = false; btn.textContent = '💌 Create Event & Get Invite Link';
}

// ── Invite Card (with cover photo) ─────────────────────────────────
function renderInviteCard(eventData) {
  var wrap     = document.getElementById('wp-invite-card-wrap');
  var isoDate  = eventData.event_date || '';
  var fmtDate  = isoDate ? new Date(isoDate).toLocaleDateString('en-ZM', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '';
  var fmtT     = isoDate ? new Date(isoDate).toLocaleTimeString('en-ZM', { hour:'2-digit', minute:'2-digit' }) : '';
  var bride    = (document.getElementById('wp-bride') || {}).value || '';
  var groom    = (document.getElementById('wp-groom') || {}).value || '';
  var names    = bride && groom ? bride + ' 💕 ' + groom : (bride || groom || '');
  var venue    = (document.getElementById('wp-venue') || {}).value || '';
  var dress    = (document.getElementById('wp-dress') || {}).value || '';
  var evTypeEl = document.getElementById('wp-event-type');
  var evType   = evTypeEl ? evTypeEl.options[evTypeEl.selectedIndex].text : 'Event';
  var titleVal = (document.getElementById('wp-title') || {}).value || eventData.title || 'Event';
  var inviteUrl = State.wp.activeInviteUrl || (window.location.origin + '/events/invite/' + eventData.invite_token + '/');

  var coverUrl = eventData.cover_photo || '';

  var _e = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var rsvpVal = (document.getElementById('wp-rsvp-deadline') || {}).value || '';
  var rsvpFmt = rsvpVal ? new Date(rsvpVal).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  var dateObj = isoDate ? new Date(isoDate) : null;
  var dayNum = dateObj ? dateObj.getDate() : '';
  var monShort = dateObj ? dateObj.toLocaleDateString('en-ZM', { month: 'short' }).toUpperCase() : '';
  var weekday = dateObj ? dateObj.toLocaleDateString('en-ZM', { weekday: 'long' }) : '';
  var family = (document.getElementById('wp-family-name') || {}).value || '';

  wrap.innerHTML =
    '<div class="ev-card"' + (coverUrl ? ' style="background-image:url(\'' + _e(coverUrl) + '\');"' : '') + '>' +
      '<div class="ev-card-shade"></div>' +
      '<div class="ev-card-body">' +
        '<div class="ev-card-top">' +
          '<span class="ev-chip">' + _e(evType) + '</span>' +
          (dateObj ? '<div class="ev-date"><div class="ev-date-day">' + dayNum + '</div><div class="ev-date-mon">' + monShort + '</div></div>' : '') +
        '</div>' +
        '<div class="ev-title">' + _e(titleVal) + '</div>' +
        (names ? '<div class="ev-names">' + _e(names) + '</div>' : '') +
        '<div class="ev-info">' +
          (weekday || fmtT ? '<div class="ev-row"><i class="fas fa-clock"></i><span>' + _e([weekday, fmtT].filter(Boolean).join(' · ')) + '</span></div>' : '') +
          (venue ? '<div class="ev-row"><i class="fas fa-map-marker-alt"></i><span>' + _e(venue) + '</span></div>' : '') +
          (dress ? '<div class="ev-row"><i class="fas fa-tshirt"></i><span>Dress code: ' + _e(dress) + '</span></div>' : '') +
          (rsvpFmt ? '<div class="ev-row"><i class="fas fa-reply"></i><span>RSVP by ' + _e(rsvpFmt) + '</span></div>' : '') +
        '</div>' +
        (family ? '<div class="ev-foot">Hosted by ' + _e(family) + '</div>' : '') +
      '</div>' +
    '</div>' +
    '<p style="font-size:11px;color:var(--sub);margin:10px 0 6px;text-align:center;">Share this link with your guests</p>' +
    '<div style="background:var(--mid);border-radius:8px;padding:8px 12px;font-size:11px;color:var(--accent2);word-break:break-all;margin-bottom:10px;" id="wp-invite-link-display">' + inviteUrl + '</div>' +
    '<div class="wp-invite-actions">' +
      '<button class="wp-invite-btn copy"     onclick="copyInviteLink()"><i class="fas fa-copy"></i> Copy Link</button>' +
      '<button class="wp-invite-btn whatsapp" onclick="shareInviteOnWhatsApp()"><i class="fab fa-whatsapp"></i> WhatsApp</button>' +
      '<button class="wp-invite-btn share"    onclick="shareInviteNative()"><i class="fas fa-share-alt"></i> Share</button>' +
    '</div>' +
    '<div style="margin-top:12px;">' +
      '<button class="wp-submit-btn" style="background:#444;" onclick="shareEventToStatus()"><i class="fas fa-circle-dot"></i> Share to Weddings Status</button>' +
    '</div>';
}

// ── Share invite link ──────────────────────────────────────────────
function copyInviteLink() {
  if (!State.wp.activeInviteUrl) return;
  navigator.clipboard.writeText(State.wp.activeInviteUrl)
    .then(function() { toast('Copied!', 'Invite link copied to clipboard.'); })
    .catch(function() { toast('Copy failed', 'Please copy the link manually.'); });
}

function shareInviteOnWhatsApp() {
  if (!State.wp.activeInviteUrl) return;
  var title = (document.getElementById('wp-title') || {}).value || 'our event';
  var text  = 'You are invited to ' + title + '! 🎉💍\n\nTap the link to RSVP and see details:\n' + State.wp.activeInviteUrl;
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

async function shareInviteNative() {
  if (!State.wp.activeInviteUrl) return;
  var title = (document.getElementById('wp-title') || {}).value || 'an event';
  if (navigator.share) {
    try { await navigator.share({ title: 'Invitation: ' + title, text: 'You\'re invited! See details and RSVP here:', url: State.wp.activeInviteUrl }); return; }
    catch(e) { /* cancelled */ }
  }
  copyInviteLink();
}

// ── Share event to status ──────────────────────────────────────────
async function shareEventToStatus() {
  if (!State.wp.activeEventId) { toast('No event yet', 'Create an event first, then share it.'); return; }
  var btn = document.querySelector('#wp-invite-card-wrap button[onclick="shareEventToStatus()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Sharing…'; }
  try {
    var res = await API.shareEventToStatus(State.wp.activeEventId);
    if (res.ok) {
      toast('Posted! 💍', res.data.message || 'Event posted to your Weddings status for 24 hours.');
      if (btn) btn.textContent = '✅ Shared to Weddings Status';
    } else {
      toast('Cannot share', res.data.error || 'Could not share to status.');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-circle-dot"></i> Share to Weddings Status'; }
    }
  } catch(e) {
    toast('Error', 'Network error — could not share to status.');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-circle-dot"></i> Share to Weddings Status'; }
  }
}

// ── Guest list ──────────────────────────────────────────────────────
async function inviteToWeddingEvent() {
  if (!State.wp.activeEventId) { toast('No event', 'Create an event first.'); return; }
  var inp  = document.getElementById('wp-invite-username');
  var stat = document.getElementById('wp-invite-status');
  var username = inp.value.trim();
  if (!username) return;
  try {
    var res = await API.inviteToEvent(State.wp.activeEventId, [username]);
    var d   = res.data;
    if (res.ok && d.added && d.added.length) {
      stat.textContent = '✅ ' + username + ' invited.'; stat.className = 'modal-status ok';
      inp.value = ''; loadWeddingGuests();
    } else if (d.already_invited && d.already_invited.length) {
      stat.textContent = username + ' is already invited.'; stat.className = 'modal-status';
    } else if (d.not_found && d.not_found.length) {
      stat.textContent = username + ' is not on Asterix yet.'; stat.className = 'modal-status err';
    }
  } catch(e) { stat.textContent = 'Network error.'; stat.className = 'modal-status err'; }
}

async function loadWeddingGuests(silent) {
  if (!State.wp.activeEventId) return;
  var wrap = document.getElementById('wp-guest-list');
  if (!silent) {
    wrap.innerHTML = '<p style="font-size:12px;color:var(--sub);">Loading…</p>';
  }
  try {
    var res = await API.getEventGuests(State.wp.activeEventId);
    var d   = res.data;
    if (!res.ok) { wrap.innerHTML = '<p style="font-size:12px;color:#f15c6d;">' + d.error + '</p>'; return; }
    var rsvpClass = { accepted:'rsvp-accepted', declined:'rsvp-declined', maybe:'rsvp-maybe', pending:'rsvp-pending' };
    var rsvpIcon  = { accepted:'✅', declined:'❌', maybe:'🤔', pending:'⏳' };
    var statsHtml = '<div style="display:flex;gap:12px;margin-bottom:12px;font-size:12px;color:var(--sub);">' +
        '<span>✅ ' + d.accepted + ' Attending</span>' +
        '<span>❌ ' + d.declined + ' Declined</span>' +
        '<span>🤔 ' + d.maybe   + ' Maybe</span>' +
        '<span>⏳ ' + d.pending + ' Pending</span>' +
      '</div>';
      
    var listHtml = d.guests.map(function(g) {
        return '<div class="wp-guest-item">' +
          '<img class="wp-guest-avatar" src="' + (g.profile_picture || window.ASTERIX.DEFAULT_AVATAR) + '" alt="' + g.username + '">' +
          '<div class="wp-guest-info"><div class="wp-guest-name">' + g.username + '</div></div>' +
          '<span class="wp-rsvp-badge ' + (rsvpClass[g.rsvp] || '') + '">' + (rsvpIcon[g.rsvp] || '') + ' ' + g.rsvp + '</span>' +
        '</div>';
      }).join('');
      
    wrap.innerHTML = statsHtml + listHtml;
  } catch(e) { 
      if (!silent) wrap.innerHTML = '<p style="font-size:12px;color:#f15c6d;">Could not load guests.</p>'; 
  }
}

// ── My Events ───────────────────────────────────────────────────────
async function loadMyEvents() {
  var guestsTab = document.getElementById('wp-tab-guests');
  var myEventsTab = document.getElementById('wp-tab-myevents');
  if (guestsTab) guestsTab.style.display = 'block';
  if (myEventsTab) myEventsTab.style.display = 'block';
  
  var container = document.getElementById('wp-myevents-list');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--sub);">Loading...</p>';
  try {
    var res = await fetch('/api/events/my/');
    var data = await res.json();
    if (!data.events || !data.events.length) {
      container.innerHTML = '<p style="color:var(--sub);">You haven\'t created any events yet.</p>';
      return;
    }
    container.innerHTML = data.events.map(function(e) {
      var cover = e.cover_photo || 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg';
      var date = e.event_date ? new Date(e.event_date).toLocaleDateString() : '';
      return '<div class="wp-my-event-item" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">' +
        '<img src="' + cover + '" style="width:50px;height:50px;border-radius:8px;object-fit:cover;">' +
        '<div style="flex:1;">' +
          '<div style="font-weight:600;color:var(--text);">' + e.title + '</div>' +
          '<div style="font-size:12px;color:var(--sub);">' + date + ' · ' + e.visibility + '</div>' +
        '</div>' +
        '<a href="' + e.invite_url + '" target="_blank" style="color:var(--accent2);font-size:13px;text-decoration:none;">Share</a>' +
      '</div>';
    }).join('');
  } catch(e) {
    container.innerHTML = '<p style="color:#f15c6d;">Could not load events.</p>';
  }
}

// ── Expose functions to global scope ───────────────────────────────
window.openWeddingPanel = openWeddingPanel;
window.closeWeddingPanel = closeWeddingPanel;
window.selectVisibility = selectVisibility;
window.switchWpTab = switchWpTab;
window.createWeddingEvent = createWeddingEvent;
window.renderInviteCard = renderInviteCard;
window.copyInviteLink = copyInviteLink;
window.shareInviteOnWhatsApp = shareInviteOnWhatsApp;
window.shareInviteNative = shareInviteNative;
window.shareEventToStatus = shareEventToStatus;
window.inviteToWeddingEvent = inviteToWeddingEvent;
window.loadWeddingGuests = loadWeddingGuests;
window.loadMyEvents = loadMyEvents;

// Expose openGuests so status.js can trigger it
window.Asterix = window.Asterix || {};
window.Asterix.wedding = window.Asterix.wedding || {};
window.Asterix.wedding.openGuests = function(eventId) {
    State.wp.activeEventId = eventId;
    // Show host-only tabs
    var guestsTab = document.getElementById('wp-tab-guests');
    var myEventsTab = document.getElementById('wp-tab-myevents');
    if (guestsTab) guestsTab.style.display = 'block';
    if (myEventsTab) myEventsTab.style.display = 'block';
    
    openWeddingPanel();
    setTimeout(function() {
        switchWpTab('guests');
    }, 300);
};