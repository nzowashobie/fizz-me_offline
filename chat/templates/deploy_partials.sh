#!/bin/bash
# ============================================================
# Asterix Chat — Simple Partials Deploy Script
# Run from:
#   cd /home/fizzme/fizzme/projec/chat/templates
#   bash deploy_partials.sh
# ============================================================

set -e

echo "============================================"
echo "  Asterix Partials Deploy"
echo "============================================"

# Current directory (where this script is running from)
CURRENT_DIR="$(pwd)"

# Create directories if they don't exist
mkdir -p partials/modals

echo ""
echo "📁 Creating template files..."

# ── Create all partial files ──────────────────────────────────────

# _sidebar.html
cat > partials/_sidebar.html << 'EOF'
{% load static %}
<!-- Sidebar -->
<div id="sidebar">
  <div class="sidebar-header">
    <img src="{{ request.user.profile.profile_picture.url }}" alt="me" id="my-avatar">
    <span class="app-name">Asterix</span>
    <button class="hdr-icon" id="gear-sidebar-btn" title="Settings" aria-label="Settings"><i class="fas fa-ellipsis-v"></i></button>
  </div>

  <div class="status-hub" id="status-hub">
    <div class="status-cat" id="open-my-status-btn" title="My Status">
      <div class="status-ring own"><i class="fas fa-plus"></i></div>
      <span>My Status</span>
    </div>
    <div class="status-cat" data-category="General">
      <div class="status-ring unread" id="ring-General"><i class="fas fa-globe"></i><span class="badge" id="badge-General"></span></div>
      <span>General</span>
    </div>
    <div class="status-cat" data-category="Funerals">
      <div class="status-ring" id="ring-Funerals"><i class="fas fa-dove"></i><span class="badge" id="badge-Funerals"></span></div>
      <span>Funerals</span>
    </div>
    <div class="status-cat" data-category="Weddings">
      <div class="status-ring" id="ring-Weddings"><i class="fas fa-ring"></i><span class="badge" id="badge-Weddings"></span></div>
      <span>Weddings</span>
    </div>
    <div class="status-cat" data-category="Market">
      <div class="status-ring" id="ring-Market"><i class="fas fa-store"></i><span class="badge" id="badge-Market"></span></div>
      <span>Market</span>
    </div>
    <div class="status-cat" data-category="Church">
      <div class="status-ring" id="ring-Church"><i class="fas fa-church"></i><span class="badge" id="badge-Church"></span></div>
      <span>Church</span>
    </div>
  </div>

  <div class="contact-search-wrap">
    <input type="text" id="contact-search" placeholder="🔍  Search or start new chat">
  </div>

  <div class="conversation-list" id="conversation-list">
    {% for user in users %}
      <div class="conversation-item" data-recipient="{{ user.username }}">
        <img class="conv-avatar" src="{{ user.profile.profile_picture.url }}" alt="{{ user.username }}">
        <div class="conv-body">
          <div class="conv-name">{{ user.username }}</div>
          <div class="conv-preview" id="preview-{{ user.username }}">Tap to open chat</div>
        </div>
        <span class="unread-badge" id="unread-{{ user.username }}"></span>
      </div>
    {% endfor %}
  </div>

  <!-- My Status slide-up overlay -->
  <div id="my-status-overlay"></div>
  <div id="my-status-panel">
    <div class="msp-header">
      <h3><i class="fas fa-circle-dot" style="margin-right:7px;"></i>My Status</h3>
      <button id="close-my-status" aria-label="Close my status panel">&times;</button>
    </div>
    <div class="msp-form">
      <label for="status-cat-sel">Category</label>
      <select id="status-cat-sel">
        <option value="General">🌐 General</option>
        <option value="Funerals">🕊️ Funerals</option>
        <option value="Weddings">💍 Weddings</option>
        <option value="Market">🛒 Market</option>
        <option value="Church">⛪ Church</option>
      </select>

      <div class="market-link-wrap" id="market-link-wrap">
        <label><i class="fas fa-link"></i> Shop / Product Link</label>
        <input type="url" id="status-mkt-link" placeholder="https://yourshop.com/product">
      </div>

      <label for="status-caption-input">Caption (optional)</label>
      <textarea id="status-caption-input" placeholder="What are you sharing?"></textarea>

      <label style="margin-bottom:4px;">Emoji (tap to add to caption)</label>
      <div class="status-emoji-row" id="status-upload-emojis"></div>

      <label>Photo or Video</label>
      <div class="file-drop-zone" id="status-drop-zone">
        <i class="fas fa-cloud-upload-alt"></i>
        <span>Tap to choose or drag a file here</span>
      </div>
      <input type="file" id="status-file-input" accept="image/*,video/*" style="display:none;">
      <img class="status-preview" id="status-prev-img" alt="">
      <video class="status-preview" id="status-prev-vid" muted playsinline></video>

      <button id="upload-status-btn" disabled><i class="fas fa-paper-plane"></i>&nbsp; Publish Status</button>
      <p class="upload-msg" id="upload-msg"></p>
    </div>
    <div class="my-statuses-list" id="my-statuses-list">
      <h4>Your active statuses</h4>
      <p id="my-statuses-empty" style="font-size:13px;color:var(--sub);">Loading…</p>
    </div>
  </div>

  <!-- Status Views Sub-Panel -->
  <div id="status-views-panel">
    <div class="vp-header">
      <h3><i class="fas fa-eye" style="margin-right:7px;"></i>Viewed By</h3>
      <button id="close-views-panel" style="background:none; border:none; color:var(--sub); font-size:22px; cursor:pointer;">&times;</button>
    </div>
    <div class="vp-list" id="vp-list-container"></div>
  </div>
</div>
EOF
echo "  ✅ partials/_sidebar.html"

# _chat_area.html
cat > partials/_chat_area.html << 'EOF'
<!-- Chat Area -->
<div id="chat-area">
  <div id="chat-header">
    <button id="back-btn" title="Back" aria-label="Go back to conversation list"><i class="fas fa-arrow-left"></i></button>
    <img id="chat-header-avatar" src="{{ request.user.profile.profile_picture.url }}" alt="Contact profile picture" style="display:none;">
    <div class="chat-header-info" id="chat-header-info">
      <div class="no-chat-hint">Select a conversation to start chatting</div>
    </div>
    <button id="gear-btn" title="Chat options" aria-label="Chat options"><i class="fas fa-ellipsis-v"></i></button>
  </div>

  <div id="id_chat_item_container" aria-live="polite" aria-label="Conversation messages" role="log"></div>

  <div id="chat-input-bar" style="position:relative;">
    <div id="emoji-picker-wrap"></div>
    <div id="attachment-preview"></div>
    <div class="input-row">
      <button class="icon-btn" id="emoji-toggle-btn" title="Emoji" aria-label="Emoji"><i class="fas fa-smile"></i></button>
      <button class="icon-btn" id="attach-btn" title="Attach file" aria-label="Attach file"><i class="fas fa-paperclip"></i></button>
      <textarea id="msg-input" placeholder="Type a message…" rows="1"></textarea>
      <label for="file-input" class="sr-only">Attach files</label><input type="file" id="file-input" multiple style="display:none;" aria-label="Attach files">
      <button id="send-btn" title="Send message" aria-label="Send message"><i class="fas fa-paper-plane"></i></button>
    </div>
  </div>
</div>
EOF
echo "  ✅ partials/_chat_area.html"

# _status_viewer.html
cat > partials/_status_viewer.html << 'EOF'
{% load static %}
<!-- Status Viewer -->
<div id="status-viewer-modal">
  <div class="sv-segments" id="sv-segments"></div>

  <div class="sv-header">
    <img id="sv-avatar" src="{% static 'images/default_profile_picture.webp' %}" alt="">
    <div class="sv-user">
      <strong id="sv-username"></strong>
      <small id="sv-time"></small>
    </div>
    <span class="sv-cat-badge" id="sv-cat"></span>
    <button id="sv-share-wedding-btn" class="sv-share-icon" title="Share to Wedding Status" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:4px 8px;margin-right:5px;transition:transform 0.2s;">
      <i class="fas fa-ring" style="color:#ff4081;"></i>
    </button>
    <button id="sv-share-btn" aria-label="Share status"><i class="fas fa-share-alt"></i></button>
    <button id="sv-close" aria-label="Close status viewer"><i class="fas fa-times"></i></button>
  </div>

  <div class="sv-media-wrap">
    <img id="sv-img" src="" alt="">
    <video id="sv-vid" src="" playsinline></video>
  </div>

  <div id="sv-caption"></div>

  <button id="sv-ad-bar">
    <span id="sv-ad-badge">AD</span>
    <span id="sv-ad-label"></span>
    <i class="fas fa-external-link-alt"></i>
  </button>

  <div class="sv-tap" id="sv-tap-left"></div>
  <div class="sv-tap" id="sv-tap-right"></div>

  <!-- Share Sheet Overlay -->
  <div id="sv-share-overlay" class="sv-share-overlay">
    <div class="sv-share-sheet">
      <div class="sv-share-title">Share to</div>
      <div class="sv-share-icons">
        <button class="sv-share-icon" id="share-wa"><i class="fab fa-whatsapp bg-wa"></i>WhatsApp</button>
        <button class="sv-share-icon" id="share-fb"><i class="fab fa-facebook-f bg-fb"></i>Facebook</button>
        <button class="sv-share-icon" id="share-tk"><i class="fab fa-tiktok bg-tk"></i>TikTok</button>
      </div>
      <button class="sv-share-close" id="sv-share-close">Cancel</button>
    </div>
  </div>

  <!-- End-of-category banner -->
  <div id="sv-cat-end">
    <div class="sv-cat-end-icon" id="sv-cat-end-icon">✅</div>
    <div class="sv-cat-end-title" id="sv-cat-end-title">All caught up!</div>
    <div class="sv-cat-end-sub" id="sv-cat-end-sub">You've seen all statuses in this category.</div>
    <div class="sv-cat-end-btns">
      <button class="sv-cat-end-btn next" id="sv-cat-next-btn" style="display:none;">Next Category <i class="fas fa-arrow-right"></i></button>
      <button class="sv-cat-end-btn close" id="sv-cat-close-btn" onclick="svClose()"><i class="fas fa-times"></i> Close</button>
    </div>
  </div>

  <!-- Category Transition Screen -->
  <div id="sv-category-transition">
    <div class="sv-ct-icon" id="sv-ct-icon">🌐</div>
    <div class="sv-ct-label">Now entering</div>
    <div class="sv-ct-name" id="sv-ct-name">General</div>
    <div class="sv-ct-bar"><div class="sv-ct-bar-fill"></div></div>
  </div>

  <!-- Emoji Reaction + Reply Bar -->
  <div id="sv-reaction-bar">
    <div class="sv-emoji-row" id="sv-emoji-row"></div>
    <div class="sv-reply-row">
      <input class="sv-reply-input" id="sv-reply-input" type="text" placeholder="Reply to this status…" maxlength="200">
      <button class="sv-reply-send" id="sv-reply-send" aria-label="Send reply"><i class="fas fa-paper-plane"></i></button>
    </div>
  </div>
</div>
EOF
echo "  ✅ partials/_status_viewer.html"

# _toasts_overlays.html
cat > partials/_toasts_overlays.html << 'EOF'
{% load static %}
<!-- Toast -->
<div id="toast" role="alert" aria-live="assertive" aria-atomic="true">
  <img src="{{ request.user.profile.profile_picture.url }}" alt="" id="toast-img">
  <div class="toast-body">
    <strong id="toast-title"></strong>
    <span id="toast-body"></span>
  </div>
</div>

<!-- Zoom Overlay -->
<div id="zoom-overlay">
  <button id="zoom-close" aria-label="Close zoom"><i class="fas fa-times"></i></button>
  <div id="zoom-content"></div>
</div>

<!-- Contact Info Panel -->
<div id="contact-info-overlay"></div>
<div id="contact-info-panel">
  <button class="cip-close" id="close-contact-info" aria-label="Close contact info">&times;</button>
  <img id="cip-avatar" src="{% static 'images/default_profile_picture.webp' %}" alt="Contact photo">
  <div id="cip-username"></div>
  <div id="cip-phone"><i class="fas fa-phone"></i> <span id="cip-phone-text"></span></div>
</div>

<!-- User Actions Context Menu -->
<div id="user-actions-context-menu">
  <div class="ua-item" id="ua-profile-modal-btn"><i class="fas fa-user-circle"></i> Profile</div>
  <div class="ua-item" id="ua-clear"><i class="fas fa-broom"></i> Clear Chat</div>
  <div class="ua-item" id="ua-toggle-sound"><i class="fas fa-bell"></i> <span id="ua-sound-text">Mute Notifications</span></div>
  <div class="ua-item danger" id="ua-block"><i class="fas fa-ban"></i> Block User</div>
  <div class="ua-item danger" id="ua-remove-contact"><i class="fas fa-user-minus"></i> Remove Contact</div>
  <div class="ua-item" id="ua-add-contact"><i class="fas fa-user-plus"></i> Add / Invite Contact</div>
  <div class="ua-item" id="ua-partners-modal-btn"><i class="fas fa-handshake"></i> Partners</div>
  <div class="ua-item" id="ua-settings"><i class="fas fa-cog"></i> Settings</div>
  <a href="{% url 'logout-user' %}" class="ua-item" id="ua-logout" style="text-decoration:none;color:inherit;"><i class="fas fa-sign-out-alt"></i> Logout</a>
</div>

<!-- Offline Banner -->
<div id="offline-banner"><i class="fas fa-wifi-slash" style="margin-right:6px;"></i> You're offline — messages will send when reconnected.</div>

<!-- Notification Sound -->
<audio id="notif-snd" src="{% static 'sounds/notification-sound.mp3' %}" preload="auto"></audio>

<!-- Hidden File Inputs -->
<input type="file" id="profile-pic-input" accept="image/*" style="display:none;">
<input type="file" id="bg-custom-input" accept="image/*" style="display:none;">
<input type="file" id="ringtone-input" accept="audio/*" style="display:none;">
EOF
echo "  ✅ partials/_toasts_overlays.html"

# ── Create modal files ──────────────────────────────────────────────

echo ""
echo "📁 Creating modal files..."

# _profile_modal.html
cat > partials/modals/_profile_modal.html << 'EOF'
{% load static %}
<!-- Profile Modal -->
<div id="profile-modal-overlay" class="modal-overlay custom-modal-overlay" onclick="if(event.target===this){this.classList.remove('open');this.style.display='none';}">
  <div class="modal-card" style="width:340px;" onclick="event.stopPropagation()">
    <div class="modal-header">
      <i class="fas fa-user-circle"></i>
      <h3>My Profile</h3>
      <button class="modal-close" onclick="document.getElementById('profile-modal-overlay').classList.remove('open');document.getElementById('profile-modal-overlay').style.display='none';">&times;</button>
    </div>
    <div class="modal-body" style="text-align:center;">
      <div style="position:relative;width:100px;margin:0 auto 16px;">
        <img src="{{ request.user.profile.profile_picture.url }}" id="profile-modal-img" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid var(--accent2);">
        <button id="btn-change-pic" style="position:absolute;bottom:0;right:0;width:30px;height:30px;border-radius:50%;background:var(--accent2);border:none;color:#fff;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Change picture"><i class="fas fa-camera"></i></button>
      </div>
      <div id="pp-modal-username" style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:4px;">{{ request.user.username }}</div>
      <div id="pp-modal-phone" style="font-size:13px;color:var(--sub);margin-bottom:18px;"><i class="fas fa-phone" style="color:var(--accent2);margin-right:6px;"></i>{{ request.user.phone_number }}</div>
      <div class="modal-divider"></div>
      <div class="modal-field" style="text-align:left;">
        <label>Display Name</label>
        <input type="text" id="pp-edit-username" placeholder="{{ request.user.username }}" value="{{ request.user.username }}">
      </div>
      <div class="modal-field" style="text-align:left;">
        <label>Phone Number</label>
        <input type="text" id="pp-edit-phone" placeholder="{{ request.user.phone_number }}" value="{{ request.user.phone_number }}" readonly style="color:var(--sub);cursor:not-allowed;">
        <span class="modal-hint">Phone number cannot be changed after registration.</span>
      </div>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="document.getElementById('profile-modal-overlay').classList.remove('open');document.getElementById('profile-modal-overlay').style.display='none';">Cancel</button>
        <button class="modal-btn primary" id="pp-save-btn" onclick="saveProfileUsername()">Save Changes</button>
      </div>
      <div class="modal-status" id="pp-save-status"></div>
    </div>
  </div>
</div>
EOF
echo "  ✅ partials/modals/_profile_modal.html"

# _partners_modal.html
cat > partials/modals/_partners_modal.html << 'EOF'
<!-- Partners / Channels Modal -->
<div id="partners-modal-overlay" class="modal-overlay custom-modal-overlay" onclick="if(event.target===this){this.classList.remove('open');this.style.display='none';}">
  <div class="modal-card" style="width:360px;" onclick="event.stopPropagation()">
    <div class="modal-header">
      <i class="fas fa-satellite-dish"></i>
      <h3>Partners &amp; Channels</h3>
      <button class="modal-close" onclick="document.getElementById('partners-modal-overlay').classList.remove('open');document.getElementById('partners-modal-overlay').style.display='none';">&times;</button>
    </div>
    <div class="modal-body">
      <p style="font-size:12px;color:var(--sub);margin-bottom:16px;line-height:1.55;">Explore our partner platforms and community channels.</p>
      <a href="https://hitfizz.pythonanywhere.com" target="_blank" rel="noopener" class="prtn-item">
        <div class="prtn-icon-wrap">🎵</div>
        <div class="prtn-meta">
          <div class="prtn-name">HitFizz</div>
          <div class="prtn-sub">Zambian music &amp; entertainment hub</div>
        </div>
        <i class="fas fa-external-link-alt prtn-arrow"></i>
      </a>
      <a href="#" class="prtn-item">
        <div class="prtn-icon-wrap ph" style="font-size:22px;color:var(--sub);">📢</div>
        <div class="prtn-meta">
          <div class="prtn-name">Community News</div>
          <div class="prtn-sub">Coming soon — stay tuned</div>
        </div>
        <span style="font-size:11px;background:var(--accent);color:#fff;padding:3px 8px;border-radius:8px;font-weight:600;">Soon</span>
      </a>
      <a href="#" class="prtn-item">
        <div class="prtn-icon-wrap ph" style="font-size:22px;color:var(--sub);">🛒</div>
        <div class="prtn-meta">
          <div class="prtn-name">Asterix Market</div>
          <div class="prtn-sub">Coming soon — buy &amp; sell locally</div>
        </div>
        <span style="font-size:11px;background:var(--accent);color:#fff;padding:3px 8px;border-radius:8px;font-weight:600;">Soon</span>
      </a>
    </div>
  </div>
</div>
EOF
echo "  ✅ partials/modals/_partners_modal.html"

# _confirm_modal.html
cat > partials/modals/_confirm_modal.html << 'EOF'
<!-- Universal Confirm Dialog -->
<div id="confirm-modal" class="modal-overlay" onclick="if(event.target===this)_confirmResolve(false)">
  <div class="modal-card" onclick="event.stopPropagation()">
    <div class="modal-body" style="padding:26px 24px 20px;">
      <div class="confirm-icon" id="confirm-icon">⚠️</div>
      <div class="confirm-title" id="confirm-title">Are you sure?</div>
      <div class="confirm-body" id="confirm-body"></div>
      <div class="modal-actions" style="margin-top:20px;">
        <button class="modal-btn secondary" onclick="_confirmResolve(false)">Cancel</button>
        <button class="modal-btn danger" id="confirm-ok-btn" onclick="_confirmResolve(true)">Confirm</button>
      </div>
    </div>
  </div>
</div>
EOF
echo "  ✅ partials/modals/_confirm_modal.html"

# _alert_modal.html
cat > partials/modals/_alert_modal.html << 'EOF'
<!-- Universal Alert Dialog -->
<div id="alert-modal" class="modal-overlay" onclick="if(event.target===this)_alertResolve()">
  <div class="modal-card" onclick="event.stopPropagation()">
    <div class="modal-body" style="padding:26px 24px 20px;">
      <div class="confirm-icon" id="alert-icon">ℹ️</div>
      <div class="confirm-title" id="alert-title">Notice</div>
      <div class="confirm-body" id="alert-body"></div>
      <div class="modal-actions" style="margin-top:20px;">
        <button class="modal-btn primary" onclick="_alertResolve()">OK</button>
      </div>
    </div>
  </div>
</div>
EOF
echo "  ✅ partials/modals/_alert_modal.html"

# _phone_modal.html
cat > partials/modals/_phone_modal.html << 'EOF'
<!-- Phone-entry Modal -->
<div id="phone-modal" class="modal-overlay" onclick="if(event.target===this)_phoneResolve(null)">
  <div class="modal-card" onclick="event.stopPropagation()">
    <div class="modal-header">
      <i class="fas fa-user-plus"></i>
      <h3>Add Contact</h3>
      <button class="modal-close" onclick="_phoneResolve(null)">&times;</button>
    </div>
    <div class="modal-body">
      <div class="modal-field">
        <label>Phone Number</label>
        <input type="tel" id="phone-modal-input" placeholder="+2609XXXXXXXX" autocomplete="tel">
        <span class="modal-hint">Enter the number with country code. Only registered Asterix users can be added.</span>
      </div>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="_phoneResolve(null)">Cancel</button>
        <button class="modal-btn primary" id="phone-modal-ok" onclick="_phoneResolve(document.getElementById('phone-modal-input').value.trim())">Add</button>
      </div>
      <div class="modal-status" id="phone-modal-status"></div>
    </div>
  </div>
</div>
EOF
echo "  ✅ partials/modals/_phone_modal.html"

# _forward_modal.html
cat > partials/modals/_forward_modal.html << 'EOF'
<!-- Forward-to Modal -->
<div id="forward-modal" class="modal-overlay" onclick="if(event.target===this)_fwdResolve(null)">
  <div class="modal-card" style="width:360px;" onclick="event.stopPropagation()">
    <div class="modal-header">
      <i class="fas fa-share"></i>
      <h3>Forward Message</h3>
      <button class="modal-close" onclick="_fwdResolve(null)">&times;</button>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--sub);margin-bottom:12px;">Select a contact to forward this message to:</p>
      <div class="fwd-contacts" id="fwd-contacts-list"></div>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="_fwdResolve(null)">Cancel</button>
        <button class="modal-btn primary" id="fwd-send-btn" onclick="_fwdConfirm()" disabled>Forward</button>
      </div>
    </div>
  </div>
</div>
EOF
echo "  ✅ partials/modals/_forward_modal.html"

# _edit_status_modal.html
cat > partials/modals/_edit_status_modal.html << 'EOF'
<!-- Edit Status Modal -->
<div id="edit-status-overlay" class="modal-overlay" onclick="if(event.target===this)closeEditStatus()">
  <div class="modal-card" style="width:340px;" onclick="event.stopPropagation()">
    <div class="modal-header">
      <i class="fas fa-edit"></i>
      <h3>Edit Status Caption</h3>
      <button class="modal-close" onclick="closeEditStatus()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="modal-field">
        <label>Caption</label>
        <textarea id="edit-status-caption" rows="3" style="background:var(--mid);border:1px solid var(--border);border-radius:10px;color:var(--text);padding:10px 12px;font-size:13px;outline:none;width:100%;resize:none;" placeholder="Update your caption…"></textarea>
      </div>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="closeEditStatus()">Cancel</button>
        <button class="modal-btn primary" id="edit-status-save-btn" onclick="saveStatusEdit()">Save</button>
      </div>
      <div class="modal-status" id="edit-status-msg"></div>
    </div>
  </div>
</div>
EOF
echo "  ✅ partials/modals/_edit_status_modal.html"

# _settings_modal.html
cat > partials/modals/_settings_modal.html << 'EOF'
{% load static %}
<!-- Settings Modal -->
<div id="settings-modal-overlay" onclick="if(event.target===this)closeSettings()">
  <div id="settings-modal" onclick="event.stopPropagation()">
    <div class="settings-header">
      <i class="fas fa-cog"></i>
      <h2>Settings</h2>
      <button class="settings-close" onclick="closeSettings()"><i class="fas fa-times"></i></button>
    </div>

    <!-- Chat Background -->
    <div class="settings-section">
      <div class="settings-section-title"><i class="fas fa-image"></i> Chat Background</div>
      <div class="settings-row" onclick="toggleBgPanel()">
        <div class="sr-icon teal"><i class="fas fa-palette"></i></div>
        <div class="settings-row-info">
          <div class="settings-row-label">Change Background</div>
          <div class="settings-row-sub" id="current-bg-label">Default pattern</div>
        </div>
        <i class="fas fa-chevron-down sr-arrow" id="bg-chevron"></i>
      </div>
      <div id="bg-theme-panel">
        <div class="bg-theme-grid" id="bg-theme-grid"></div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <div class="bg-thumb-custom" id="bg-custom-btn" style="flex:1;" onclick="document.getElementById('bg-custom-input').click()">
            <i class="fas fa-upload"></i>
            <span>Custom Image</span>
          </div>
        </div>
        <input type="file" id="bg-custom-input" accept="image/*" style="display:none;">
      </div>
    </div>
    <div class="settings-divider"></div>

    <!-- Notifications -->
    <div class="settings-section">
      <div class="settings-section-title"><i class="fas fa-bell"></i> Notifications</div>
      <div class="settings-row">
        <div class="sr-icon purple"><i class="fas fa-bell"></i></div>
        <div class="settings-row-info">
          <div class="settings-row-label">Message Notifications</div>
          <div class="settings-row-sub">Show alerts for new messages</div>
        </div>
        <label class="settings-toggle">
          <input type="checkbox" id="tog-notifs" checked>
          <div class="tog-track"></div>
          <div class="tog-thumb"></div>
        </label>
      </div>
      <div class="settings-row">
        <div class="sr-icon orange"><i class="fas fa-volume-up"></i></div>
        <div class="settings-row-info">
          <div class="settings-row-label">Notification Sound</div>
          <div class="settings-row-sub" id="ringtone-label">Default tone</div>
        </div>
        <button class="settings-close" style="background:var(--mid);color:var(--text);font-size:12px;width:auto;padding:4px 10px;border-radius:8px;" onclick="document.getElementById('ringtone-input').click()"><i class="fas fa-upload" style="margin-right:4px;"></i>Change</button>
        <input type="file" id="ringtone-input" accept="audio/*" style="display:none;">
      </div>
      <div class="settings-row">
        <div class="sr-icon blue"><i class="fas fa-mobile-alt"></i></div>
        <div class="settings-row-info">
          <div class="settings-row-label">Vibration</div>
          <div class="settings-row-sub">Vibrate on new messages</div>
        </div>
        <label class="settings-toggle">
          <input type="checkbox" id="tog-vibrate" checked>
          <div class="tog-track"></div>
          <div class="tog-thumb"></div>
        </label>
      </div>
    </div>
    <div class="settings-divider"></div>

    <!-- Privacy -->
    <div class="settings-section">
      <div class="settings-section-title"><i class="fas fa-lock"></i> Privacy & Security</div>
      <div class="settings-row">
        <div class="sr-icon teal"><i class="fas fa-eye"></i></div>
        <div class="settings-row-info">
          <div class="settings-row-label">Read Receipts</div>
          <div class="settings-row-sub">Let others see when you've read their messages</div>
        </div>
        <label class="settings-toggle">
          <input type="checkbox" id="tog-read-receipts" checked>
          <div class="tog-track"></div>
          <div class="tog-thumb"></div>
        </label>
      </div>
      <div class="settings-row">
        <div class="sr-icon red"><i class="fas fa-user-secret"></i></div>
        <div class="settings-row-info">
          <div class="settings-row-label">Hide Online Status</div>
          <div class="settings-row-sub">Don't show when you're active</div>
        </div>
        <label class="settings-toggle">
          <input type="checkbox" id="tog-hide-online">
          <div class="tog-track"></div>
          <div class="tog-thumb"></div>
        </label>
      </div>
    </div>
    <div class="settings-divider"></div>

    <!-- Appearance -->
    <div class="settings-section" style="padding-bottom:20px;">
      <div class="settings-section-title"><i class="fas fa-magic"></i> Appearance</div>
      <div class="settings-row">
        <div class="sr-icon orange"><i class="fas fa-text-height"></i></div>
        <div class="settings-row-info">
          <div class="settings-row-label">Font Size</div>
          <div class="settings-row-sub" id="font-size-label">Medium (14px)</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button onclick="changeFontSize(-1)" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--mid);color:var(--text);cursor:pointer;font-size:14px;">−</button>
          <button onclick="changeFontSize(1)" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--mid);color:var(--text);cursor:pointer;font-size:14px;">+</button>
        </div>
      </div>
      <div class="settings-row">
        <div class="sr-icon blue"><i class="fas fa-compress-arrows-alt"></i></div>
        <div class="settings-row-info">
          <div class="settings-row-label">Compact Messages</div>
          <div class="settings-row-sub">Reduce spacing between messages</div>
        </div>
        <label class="settings-toggle">
          <input type="checkbox" id="tog-compact">
          <div class="tog-track"></div>
          <div class="tog-thumb"></div>
        </label>
      </div>
    </div>
  </div>
</div>
EOF
echo "  ✅ partials/modals/_settings_modal.html"

# _wedding_panel.html
cat > partials/modals/_wedding_panel.html << 'EOF'
<!-- Wedding Share Panel -->
<div id="wedding-share-overlay" class="sv-share-overlay" onclick="if(event.target===this)closeWeddingShare()">
  <div class="sv-share-sheet" style="background: linear-gradient(135deg, #1a0a1a 0%, #2d1b2d 100%); border: 2px solid #e91e63;">
    <div class="sv-share-title" style="color: #ff4081;">
      <i class="fas fa-ring" style="margin-right: 8px;"></i>
      Share to Wedding Status
    </div>
    <div style="margin: 12px 0 8px;">
      <button class="sv-btn primary" onclick="shareWeddingStatus()" style="padding: 12px 24px; font-size: 16px; background: #e91e63; color: #fff; border: none; border-radius: 25px; cursor: pointer;">
        <i class="fas fa-share-alt"></i> Share Now
      </button>
    </div>
    <div style="display: flex; gap: 10px; justify-content: center; margin: 12px 0;">
      <button class="sv-btn" onclick="shareWeddingWhatsApp()" style="background: #25d366; color: #fff; border: none; padding: 10px 16px; border-radius: 12px; cursor: pointer; font-weight: 600;">
        <i class="fab fa-whatsapp"></i> WhatsApp
      </button>
      <button class="sv-btn" onclick="shareWeddingFacebook()" style="background: #1877f2; color: #fff; border: none; padding: 10px 16px; border-radius: 12px; cursor: pointer; font-weight: 600;">
        <i class="fab fa-facebook-f"></i> Facebook
      </button>
    </div>
    <button class="sv-share-close" onclick="closeWeddingShare()" style="margin-top:15px; background:rgba(255,255,255,0.1); padding:10px; border-radius:20px; color:#fff; font-size:13px; cursor:pointer; border:none; width:100%; transition:background 0.2s;">Cancel</button>
  </div>
</div>
EOF
echo "  ✅ partials/modals/_wedding_panel.html"

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  ✅ All files deployed successfully!"
echo "  📁 Location: $CURRENT_DIR/partials/"
echo "============================================"
ls -la partials/
echo ""
ls -la partials/modals/
EOF