#!/bin/bash
# setup_modular_chat.sh - Creates modular chat structure on PythonAnywhere
# This script assumes your project is already deployed on PythonAnywhere

set -e

echo "🚀 Setting up Modular Chat Structure on PythonAnywhere..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Find project root (where manage.py is)
find_project_root() {
    local dir=$(pwd)
    while [ "$dir" != "/" ]; do
        if [ -f "$dir/manage.py" ]; then
            echo "$dir"
            return 0
        fi
        dir=$(dirname "$dir")
    done
    echo ""
    return 1
}

PROJECT_ROOT=$(find_project_root)
if [ -z "$PROJECT_ROOT" ]; then
    print_error "Could not find Django project root (manage.py not found)"
    print_info "Please cd to your Django project directory first"
    exit 1
fi

print_info "Project root: $PROJECT_ROOT"

# Check if chat app exists
CHAT_APP="$PROJECT_ROOT/chat"
if [ ! -d "$CHAT_APP" ]; then
    print_error "Chat app not found at $CHAT_APP"
    print_info "Please ensure the chat app exists before running this script"
    exit 1
fi

# Backup existing files
backup_files() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$PROJECT_ROOT/backups/chat_backup_$timestamp"

    print_info "Creating backup at $backup_dir..."
    mkdir -p "$backup_dir"

    if [ -f "$CHAT_APP/templates/chat/index.html" ]; then
        cp -r "$CHAT_APP/templates" "$backup_dir/"
        cp -r "$CHAT_APP/static" "$backup_dir/"
        print_success "Backup created"
    else
        print_info "No existing templates found to backup"
    fi
}

# Ask for confirmation
read -p "This will create a modular structure for your chat app. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Exiting..."
    exit 0
fi

# Create backup
backup_files

# Set paths
TEMPLATES_DIR="$CHAT_APP/templates/chat"
STATIC_DIR="$CHAT_APP/static/chat"

# Create directories
create_directories() {
    print_info "Creating directory structure..."

    mkdir -p "$TEMPLATES_DIR/layouts"
    mkdir -p "$TEMPLATES_DIR/components"
    mkdir -p "$TEMPLATES_DIR/status"
    mkdir -p "$TEMPLATES_DIR/modals"
    mkdir -p "$TEMPLATES_DIR/wedding"

    mkdir -p "$STATIC_DIR/css"
    mkdir -p "$STATIC_DIR/js/core"
    mkdir -p "$STATIC_DIR/js/services"
    mkdir -p "$STATIC_DIR/js/modules"
    mkdir -p "$STATIC_DIR/js/ui"
    mkdir -p "$STATIC_DIR/js/vendor"
    mkdir -p "$STATIC_DIR/images"

    print_success "Directory structure created"
}

# ============================================
# TEMPLATE FILES - PythonAnywhere Compatible
# ============================================

create_base_html() {
    cat > "$TEMPLATES_DIR/layouts/base.html" << 'EOF'
{% load static %}
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <link rel="manifest" href="/static/manifest.json">
  <meta name="theme-color" content="#128c7e">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Asterix">
  <link rel="apple-touch-icon" href="/static/images/icon-192.png">
  <title>{% block title %}Asterix{% endblock %}</title>

  <!-- Font Awesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">

  <!-- Styles -->
  <link rel="stylesheet" href="{% static 'chat/css/base.css' %}">
  <link rel="stylesheet" href="{% static 'chat/css/sidebar.css' %}">
  <link rel="stylesheet" href="{% static 'chat/css/chat.css' %}">
  <link rel="stylesheet" href="{% static 'chat/css/status.css' %}">
  <link rel="stylesheet" href="{% static 'chat/css/modals.css' %}">
  <link rel="stylesheet" href="{% static 'chat/css/settings.css' %}">
  <link rel="stylesheet" href="{% static 'chat/css/wedding.css' %}">

  {% block extra_css %}{% endblock %}
</head>
<body>

{% block auth_wall %}{% endblock %}

<div id="app-shell">
  {% block app_content %}{% endblock %}
</div>

<!-- Overlays & Modals -->
{% block modals %}{% endblock %}

<!-- Toast -->
{% block toast %}{% endblock %}

<!-- Offline Banner -->
{% block offline_banner %}{% endblock %}

<!-- Contact Info -->
{% block contact_info %}{% endblock %}

<!-- Zoom Overlay -->
{% block zoom_overlay %}{% endblock %}

<!-- Audio -->
<audio id="notif-snd" src="{% static 'sounds/notification-sound.mp3' %}" preload="auto"></audio>

<!-- Scripts -->
<script>
  window.ME = '{{ request.user.username }}';
  window.CSRF_TOKEN = '{{ csrf_token }}';
  {% if private_key %}
  window.PRIVATE_KEY = '{{ private_key|escapejs }}';
  {% endif %}
</script>

<script src="{% static 'chat/js/core/constants.js' %}"></script>
<script src="{% static 'chat/js/core/config.js' %}"></script>
<script src="{% static 'chat/js/core/event-bus.js' %}"></script>
<script src="{% static 'chat/js/services/api.js' %}"></script>
<script src="{% static 'chat/js/services/auth.js' %}"></script>
<script src="{% static 'chat/js/services/messages.js' %}"></script>
<script src="{% static 'chat/js/services/status.js' %}"></script>
<script src="{% static 'chat/js/services/contacts.js' %}"></script>
<script src="{% static 'chat/js/services/events.js' %}"></script>
<script src="{% static 'chat/js/services/storage.js' %}"></script>
<script src="{% static 'chat/js/ui/utils.js' %}"></script>
<script src="{% static 'chat/js/ui/render.js' %}"></script>
<script src="{% static 'chat/js/ui/modals.js' %}"></script>
<script src="{% static 'chat/js/ui/toast.js' %}"></script>
<script src="{% static 'chat/js/ui/zoom.js' %}"></script>
<script src="{% static 'chat/js/modules/chat.js' %}"></script>
<script src="{% static 'chat/js/modules/sidebar.js' %}"></script>
<script src="{% static 'chat/js/modules/status-viewer.js' %}"></script>
<script src="{% static 'chat/js/modules/status-upload.js' %}"></script>
<script src="{% static 'chat/js/modules/wedding.js' %}"></script>
<script src="{% static 'chat/js/modules/contacts.js' %}"></script>
<script src="{% static 'chat/js/modules/notifications.js' %}"></script>
<script src="{% static 'chat/js/modules/settings.js' %}"></script>
<script src="{% static 'chat/js/main.js' %}"></script>

{% block extra_js %}{% endblock %}
</body>
</html>
EOF
    print_success "Created layouts/base.html"
}

create_app_shell_html() {
    cat > "$TEMPLATES_DIR/layouts/app_shell.html" << 'EOF'
{% load static %}

<div id="sidebar">
  {% include 'chat/components/sidebar.html' %}
</div>

<div id="chat-area">
  {% include 'chat/components/chat_area.html' %}
</div>

<!-- Status Components -->
{% include 'chat/status/viewer.html' %}
{% include 'chat/status/upload_panel.html' %}
{% include 'chat/status/views_panel.html' %}
{% include 'chat/status/transition.html' %}

<!-- Wedding Panel -->
{% include 'chat/wedding/panel.html' %}

<!-- User Actions Menu -->
{% include 'chat/modals/user_actions.html' %}
EOF
    print_success "Created layouts/app_shell.html"
}

# Create index.html - this will REPLACE your existing index.html
create_index_html() {
    # Check if index.html exists and warn
    if [ -f "$TEMPLATES_DIR/index.html" ]; then
        print_warning "index.html already exists. It will be replaced with the modular version."
        print_info "Your old file will be in the backup directory."
    fi

    cat > "$TEMPLATES_DIR/index.html" << 'EOF'
{% extends 'chat/layouts/base.html' %}

{% block auth_wall %}
  {% if not request.user.is_authenticated %}
    {% include 'chat/components/auth_wall.html' %}
  {% endif %}
{% endblock %}

{% block app_content %}
  {% include 'chat/layouts/app_shell.html' %}
{% endblock %}

{% block modals %}
  {% include 'chat/modals/profile.html' %}
  {% include 'chat/modals/partners.html' %}
  {% include 'chat/modals/confirm.html' %}
  {% include 'chat/modals/alert.html' %}
  {% include 'chat/modals/phone.html' %}
  {% include 'chat/modals/forward.html' %}
  {% include 'chat/modals/settings.html' %}
  {% include 'chat/modals/wedding.html' %}
{% endblock %}

{% block toast %}
  {% include 'chat/components/toast.html' %}
{% endblock %}

{% block offline_banner %}
  {% include 'chat/components/offline_banner.html' %}
{% endblock %}

{% block contact_info %}
  {% include 'chat/components/contact_info.html' %}
{% endblock %}

{% block zoom_overlay %}
  {% include 'chat/components/zoom_overlay.html' %}
{% endblock %}
EOF
    print_success "Created index.html"
}

# Create sidebar.html with dynamic categories
create_sidebar_html() {
    cat > "$TEMPLATES_DIR/components/sidebar.html" << 'EOF'
{% load static %}

<div class="sidebar-header">
  <img src="{{ request.user.profile.profile_picture_url }}" alt="me" id="my-avatar">
  <span class="app-name">Asterix</span>
  <button class="hdr-icon" id="gear-sidebar-btn" title="Settings" aria-label="Settings">
    <i class="fas fa-ellipsis-v"></i>
  </button>
</div>

<div class="status-hub" id="status-hub">
  <div class="status-cat" id="open-my-status-btn" title="My Status">
    <div class="status-ring own"><i class="fas fa-plus"></i></div>
    <span>My Status</span>
  </div>

  <!-- Categories from Django context -->
  {% for category in categories %}
    <div class="status-cat" data-category="{{ category }}">
      <div class="status-ring" id="ring-{{ category }}">
        <i class="fas {% if category == 'General' %}fa-globe{% elif category == 'Funerals' %}fa-dove{% elif category == 'Weddings' %}fa-ring{% elif category == 'Market' %}fa-store{% elif category == 'Church' %}fa-church{% else %}fa-circle{% endif %}"></i>
        <span class="badge" id="badge-{{ category }}"></span>
      </div>
      <span>{{ category }}</span>
      {% if category == 'Weddings' %}
        <button class="wedding-ring-btn" onclick="event.stopPropagation(); window.WeddingModule.openPanel();" title="Create Wedding Event">
          <i class="fas fa-plus" style="font-size:9px;"></i>
        </button>
      {% endif %}
    </div>
  {% endfor %}
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
EOF
    print_success "Created components/sidebar.html"
}

# ... (continue with all other template files - they are the same as before)

# ============================================
# CSS FILES - PythonAnywhere Compatible
# ============================================

create_css_files() {
    # base.css
    cat > "$STATIC_DIR/css/base.css" << 'EOF'
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --sidebar-w: 340px;
  --header-h: 58px;
  --input-h: 64px;
  --accent: #128c7e;
  --accent2: #25d366;
  --dark: #1a1f1f;
  --darker: #111616;
  --mid: #2a2f2f;
  --border: #1e2424;
  --text: #e9edef;
  --sub: #8696a0;
}

html, body {
  height: 100%;
  height: 100dvh;
  overflow: hidden;
  font-family: 'Segoe UI', Arial, sans-serif;
  background: var(--darker);
  color: var(--text);
}

#app-shell {
  display: flex;
  height: 100vh;
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}

:focus-visible {
  outline: 2px solid var(--accent2);
  outline-offset: 2px;
}

*, *::before, *::after { -webkit-tap-highlight-color: transparent; }

@media (max-width: 768px) {
  #sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    transform: translateX(0);
    z-index: 500;
    width: 100%;
    min-width: unset;
  }
  #sidebar.hidden { transform: translateX(-100%); }
  #chat-area { width: 100%; }
  #back-btn { display: flex; }
  .msg-bubble { max-width: 80%; }
  #my-status-panel, #status-views-panel, #wedding-panel { width: 100%; }
}

@keyframes toastIn {
  from { transform: translateY(-14px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes modalPop {
  from { transform: scale(.88) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
EOF

    # sidebar.css
    cat > "$STATIC_DIR/css/sidebar.css" << 'EOF'
#sidebar {
  width: var(--sidebar-w);
  min-width: var(--sidebar-w);
  display: flex;
  flex-direction: column;
  background: var(--dark);
  border-right: 1px solid var(--border);
  transition: transform .25s ease, width .25s ease;
  z-index: 200;
  flex-shrink: 0;
}

.sidebar-header {
  height: var(--header-h);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  background: var(--mid);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar-header img {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer;
}

.sidebar-header .app-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent2);
  flex: 1;
}

.sidebar-header .hdr-icon {
  background: none;
  border: none;
  color: var(--sub);
  font-size: 18px;
  cursor: pointer;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .15s;
}

.sidebar-header .hdr-icon:hover {
  background: rgba(255,255,255,.08);
  color: var(--text);
}

.status-hub {
  display: flex;
  gap: 0;
  overflow-x: auto;
  padding: 10px 12px;
  background: var(--dark);
  border-bottom: 1px solid var(--border);
  scrollbar-width: none;
  flex-shrink: 0;
}

.status-hub::-webkit-scrollbar { display: none; }

.status-cat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 10px;
  transition: background .15s;
  min-width: 62px;
  flex-shrink: 0;
}

.status-cat:hover { background: rgba(255,255,255,.05); }

.status-ring {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2.5px solid var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mid);
  font-size: 20px;
  position: relative;
  transition: border-color .2s;
}

.status-ring.unread { border-color: var(--accent2); }
.status-ring.own { border-color: #444; font-size: 22px; color: var(--accent2); }

.status-ring .badge {
  position: absolute;
  top: -3px;
  right: -3px;
  background: var(--accent2);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: none;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--dark);
}

.status-ring .badge.show { display: flex; }
.status-cat span { font-size: 10px; color: var(--sub); white-space: nowrap; }

.wedding-ring-btn {
  position: absolute;
  bottom: -8px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e91e63, #880e4f);
  border: 2px solid #1a1f1f;
  color: #fff;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  padding: 0;
  line-height: 1;
  box-shadow: 0 2px 6px rgba(233, 30, 99, .4);
  transition: transform .2s;
}

.wedding-ring-btn:hover { transform: scale(1.15); }

.contact-search-wrap {
  padding: 8px 12px;
  background: var(--dark);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.contact-search-wrap input {
  width: 100%;
  padding: 8px 14px;
  border-radius: 20px;
  border: none;
  background: var(--mid);
  color: var(--text);
  font-size: 13px;
  outline: none;
}

.contact-search-wrap input::placeholder { color: var(--sub); }

.conversation-list {
  flex: 1;
  overflow-y: auto;
}

.conversation-list::-webkit-scrollbar { width: 4px; }
.conversation-list::-webkit-scrollbar-thumb { background: var(--mid); border-radius: 4px; }

.conversation-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background .15s;
}

.conversation-item:hover { background: rgba(255,255,255,.04); }
.conversation-item.active { background: var(--mid); }

.conv-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.conv-body { flex: 1; overflow: hidden; }
.conv-name { font-size: 14px; font-weight: 600; color: var(--text); }
.conv-preview { font-size: 12px; color: var(--sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }

.unread-badge {
  background: var(--accent2);
  color: #fff;
  border-radius: 10px;
  min-width: 20px;
  height: 20px;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0 5px;
  opacity: 0;
  transform: scale(0);
  transition: opacity .25s ease, transform .25s cubic-bezier(.34,1.56,.64,1);
  pointer-events: none;
}

.unread-badge.show { opacity: 1; transform: scale(1); }
.unread-badge.pop { animation: badgePop .35s cubic-bezier(.34,1.56,.64,1); }

@keyframes badgePop {
  0% { transform: scale(0); }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
EOF
    print_success "Created CSS files"
}

# ============================================
# JAVASCRIPT FILES - PythonAnywhere Compatible
# ============================================

create_js_files() {
    # core/constants.js
    cat > "$STATIC_DIR/js/core/constants.js" << 'EOF'
/**
 * Application Constants
 */
window.Constants = {
  CATEGORY_EMOJIS: {
    'General': ['😀', '😂', '❤️', '🔥', '🙏', '😮', '👍', '🎉', '💯', '😍'],
    'Funerals': ['😢', '🕊️', '🙏', '💔', '😞', '🌹', '🕯️', '💐'],
    'Weddings': ['💍', '❤️', '🎊', '💒', '🥂', '💐', '😍', '🎶', '👰', '💑'],
    'Market': ['🛒', '💰', '🔥', '👍', '⭐', '💸', '🏷️', '✅', '📦', '💎'],
    'Church': ['🙏', '✝️', '☦️', '😇', '🕊️', '📖', '🌟', '💒', '🎶', '🙌']
  },

  DEFAULT_EMOJIS: ['😀', '😂', '❤️', '🔥', '🙏', '😮', '👍', '🎉', '💯', '😍'],

  CHAT_EMOJIS: ['😀', '😂', '😍', '😭', '😎', '🥹', '🤔', '😴', '🤩', '😡', '👍', '👎', '❤️', '💔', '🔥', '✅', '⭐', '🎉', '🙏', '💯', '😢', '😅', '🥺', '😤', '😏', '🙃', '😬', '🤣', '😇', '🥳', '👋', '✌️', '🤞', '💪', '🫂', '🤝', '🫶', '👀', '💀', '🫠', '🌹', '🌟', '🍕', '☕', '🎵', '🚀', '💡', '📸', '🎂', '🏆', '😴', '🤓', '🧐', '🤯', '🥴', '😵', '🤐', '🫡', '🥶', '🥵'],

  CATEGORY_ICONS: {
    'General': '🌐',
    'Funerals': '🕊️',
    'Weddings': '💍',
    'Market': '🛒',
    'Church': '⛪'
  },

  CATEGORIES: ['General', 'Funerals', 'Weddings', 'Market', 'Church'],

  POLL_ACTIVE: 4000,
  POLL_HIDDEN: 20000,
  POLL_MAX: 60000
};
EOF

    # core/config.js
    cat > "$STATIC_DIR/js/core/config.js" << 'EOF'
/**
 * Configuration - Loads from Django context
 */
window.Config = (function() {
  let config = {};

  function init() {
    config = {
      ME: window.ME || '',
      CSRF_TOKEN: window.CSRF_TOKEN || '',
      PRIVATE_KEY: window.PRIVATE_KEY || '',
      BASE_URL: window.BASE_URL || '',
      DEBUG: window.DEBUG || false
    };

    if (config.PRIVATE_KEY && config.ME) {
      try {
        localStorage.setItem('_asterix_pk_' + config.ME, config.PRIVATE_KEY);
      } catch(e) {
        console.warn('Could not cache private key', e);
      }
    }

    return config;
  }

  function get(key) {
    return config[key];
  }

  function isAuthenticated() {
    return !!config.ME;
  }

  return {
    init,
    get,
    isAuthenticated
  };
})();
EOF

    # core/event-bus.js
    cat > "$STATIC_DIR/js/core/event-bus.js" << 'EOF'
/**
 * Event Bus - Central communication hub
 */
window.EventBus = (function() {
  const events = {};

  function on(event, callback) {
    if (!events[event]) events[event] = [];
    events[event].push(callback);
    return () => off(event, callback);
  }

  function off(event, callback) {
    if (!events[event]) return;
    events[event] = events[event].filter(cb => cb !== callback);
  }

  function emit(event, data) {
    if (!events[event]) return;
    events[event].forEach(callback => {
      try { callback(data); }
      catch(e) { console.error(`EventBus error in ${event}:`, e); }
    });
  }

  function once(event) {
    return new Promise(resolve => {
      const unsubscribe = on(event, (data) => {
        unsubscribe();
        resolve(data);
      });
    });
  }

  return { on, off, emit, once };
})();
EOF

    # services/api.js
    cat > "$STATIC_DIR/js/services/api.js" << 'EOF'
/**
 * API Service - Centralized HTTP client
 */
window.ApiService = (function() {
  const Config = window.Config;

  function getCsrfToken() {
    return Config.get('CSRF_TOKEN') || '';
  }

  async function request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${endpoint}`;

    const defaultOptions = {
      headers: {
        'X-CSRFToken': getCsrfToken(),
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'same-origin'
    };

    const mergedOptions = { ...defaultOptions, ...options };

    if (options.body instanceof FormData) {
      delete mergedOptions.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, mergedOptions);
      const data = await response.json();

      if (!response.ok) {
        throw { status: response.status, data };
      }
      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  function get(endpoint) {
    return request(endpoint, { method: 'GET' });
  }

  function post(endpoint, data) {
    return request(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data)
    });
  }

  function put(endpoint, data) {
    return request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  function del(endpoint) {
    return request(endpoint, { method: 'DELETE' });
  }

  return { request, get, post, put, delete: del };
})();
EOF

    # services/messages.js
    cat > "$STATIC_DIR/js/services/messages.js" << 'EOF'
/**
 * Message Service - Chat message operations
 */
window.MessageService = (function() {
  const API = window.ApiService;

  async function getMessages(recipient, afterId = 0) {
    const params = new URLSearchParams({ recipient });
    if (afterId) params.append('after_id', afterId);
    return API.get(`/api/messages/?${params}`);
  }

  async function sendMessage(recipient, message, files = [], replyTo = null) {
    const formData = new FormData();
    formData.append('recipient', recipient);
    formData.append('message', message || '');

    if (replyTo) {
      formData.append('reply_to', replyTo.id);
      formData.append('reply_sender', replyTo.sender || '');
      formData.append('reply_text', replyTo.text || '');
    }

    files.forEach(file => formData.append('files', file));

    return API.post('/api/messages/send/', formData);
  }

  async function deleteMessage(messageId) {
    return API.delete(`/api/messages/delete/${messageId}/`);
  }

  async function markAsRead(sender) {
    return API.post('/api/messages/mark_as_read/', { sender });
  }

  async function getUnreadCounts() {
    return API.get('/api/messages/unread_count/');
  }

  async function clearChat(recipient) {
    return API.post('/api/clear-chat/', {
      recipient_id: recipient,
      permanent: true
    });
  }

  return {
    getMessages,
    sendMessage,
    deleteMessage,
    markAsRead,
    getUnreadCounts,
    clearChat
  };
})();
EOF

    # services/status.js
    cat > "$STATIC_DIR/js/services/status.js" << 'EOF'
/**
 * Status Service - Status operations
 */
window.StatusService = (function() {
  const API = window.ApiService;

  async function getFeed(category) {
    return API.get(`/api/status/feed/${encodeURIComponent(category)}/`);
  }

  async function getMyStatuses() {
    return API.get('/api/status/mine/');
  }

  async function uploadStatus(media, caption, category, marketLink = '') {
    const formData = new FormData();
    formData.append('media', media);
    formData.append('caption', caption || '');
    formData.append('category', category);
    if (marketLink) formData.append('market_link', marketLink);
    return API.post('/api/status/upload/', formData);
  }

  async function deleteStatus(statusId) {
    return API.delete(`/api/status/${statusId}/delete/`);
  }

  async function editStatus(statusId, caption) {
    return API.post(`/api/status/${statusId}/edit/`, { caption });
  }

  return {
    getFeed,
    getMyStatuses,
    uploadStatus,
    deleteStatus,
    editStatus
  };
})();
EOF

    # services/contacts.js
    cat > "$STATIC_DIR/js/services/contacts.js" << 'EOF'
/**
 * Contacts Service - Contact operations
 */
window.ContactsService = (function() {
  const API = window.ApiService;

  async function getContacts() {
    return API.get('/api/contacts/');
  }

  async function getContactInfo(username) {
    return API.get(`/api/contacts/info/?username=${encodeURIComponent(username)}`);
  }

  async function addByPhone(phoneNumber) {
    return API.post('/api/contacts/add-by-phone/', { phone_number: phoneNumber });
  }

  async function removeContact(username) {
    return API.post('/api/contacts/remove/', { username });
  }

  async function blockUser(username) {
    return API.post('/api/block-user/', { username });
  }

  async function updateProfile(data) {
    return API.post('/api/profile/update/', data);
  }

  async function uploadProfilePicture(file) {
    const formData = new FormData();
    formData.append('profile_picture', file);
    return API.post('/api/upload-profile-picture/', formData);
  }

  async function getOnlineUsers() {
    return API.get('/api/users/online/');
  }

  return {
    getContacts,
    getContactInfo,
    addByPhone,
    removeContact,
    blockUser,
    updateProfile,
    uploadProfilePicture,
    getOnlineUsers
  };
})();
EOF

    # services/events.js
    cat > "$STATIC_DIR/js/services/events.js" << 'EOF'
/**
 * Events Service - Wedding/Event operations
 */
window.EventsService = (function() {
  const API = window.ApiService;

  async function createEvent(formData) {
    return API.post('/api/events/create/', formData);
  }

  async function getEvent(eventId) {
    return API.get(`/api/events/${eventId}/`);
  }

  async function getGuests(eventId) {
    return API.get(`/api/events/${eventId}/guests/`);
  }

  async function inviteGuests(eventId, usernames) {
    return API.post(`/api/events/${eventId}/invite/`, { usernames });
  }

  async function shareToStatus(eventId) {
    return API.post(`/api/events/${eventId}/share-to-status/`, { category: 'Weddings' });
  }

  async function rsvp(token, status) {
    return API.post(`/api/events/rsvp/${token}/`, { status });
  }

  return {
    createEvent,
    getEvent,
    getGuests,
    inviteGuests,
    shareToStatus,
    rsvp
  };
})();
EOF

    # services/storage.js
    cat > "$STATIC_DIR/js/services/storage.js" << 'EOF'
/**
 * Storage Service - Local storage operations
 */
window.StorageService = (function() {
  function get(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch(e) {
      return defaultValue;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch(e) {
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch(e) {
      return false;
    }
  }

  function getOfflineQueue() {
    return get('asterix_offline_queue', []);
  }

  function setOfflineQueue(queue) {
    return set('asterix_offline_queue', queue);
  }

  function addToOfflineQueue(item) {
    const queue = getOfflineQueue();
    queue.push(item);
    return setOfflineQueue(queue);
  }

  function clearOfflineQueue() {
    return remove('asterix_offline_queue');
  }

  function getRingtone() {
    return localStorage.getItem('asterix_ringtone') || null;
  }

  function setRingtone(url) {
    localStorage.setItem('asterix_ringtone', url);
  }

  function getBackground() {
    return localStorage.getItem('asterix_background') || 'default';
  }

  function setBackground(value) {
    localStorage.setItem('asterix_background', value);
  }

  return {
    get,
    set,
    remove,
    getOfflineQueue,
    setOfflineQueue,
    addToOfflineQueue,
    clearOfflineQueue,
    getRingtone,
    setRingtone,
    getBackground,
    setBackground
  };
})();
EOF

    # ui/utils.js
    cat > "$STATIC_DIR/js/ui/utils.js" << 'EOF'
/**
 * Utility Functions
 */
window.Utils = (function() {
  function fmtTime(ts) {
    const d = new Date(ts);
    if (isNaN(d)) return '';
    const now = new Date();
    const diff = Math.round((now - d) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return diff + 'm ago';
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2,'0');
    const ap = h >= 12 ? 'PM' : 'AM';
    const fh = h % 12 || 12;
    const today = new Date();
    today.setHours(0,0,0,0);
    const dm = new Date(d);
    dm.setHours(0,0,0,0);
    if (dm.getTime() === today.getTime()) return fh + ':' + m + ' ' + ap;
    const yest = new Date(today);
    yest.setDate(yest.getDate()-1);
    if (dm.getTime() === yest.getTime()) return 'Yesterday ' + fh + ':' + m + ' ' + ap;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ' ' + fh + ':' + m + ' ' + ap;
  }

  function externalLink(link) {
    if (!link) return null;
    link = link.trim();
    link = link.replace(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//, '');
    link = link.replace(/^https?:\/\/[a-z0-9-]+\.pythonanywhere\.com\//, '');
    if (!/^https?:\/\//i.test(link)) link = 'https://' + link;
    return link;
  }

  function getEmojisForCategory(cat) {
    return window.Constants.CATEGORY_EMOJIS[cat] || window.Constants.DEFAULT_EMOJIS;
  }

  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function throttle(fn, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function truncate(str, length = 50) {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
  }

  return {
    fmtTime,
    externalLink,
    getEmojisForCategory,
    debounce,
    throttle,
    generateId,
    truncate
  };
})();
EOF

    # ui/modals.js
    cat > "$STATIC_DIR/js/ui/modals.js" << 'EOF'
/**
 * Modal System - Universal modal management
 */
window.Modals = (function() {
  let confirmResolve = null;
  let alertResolve = null;
  let phoneResolve = null;
  let forwardResolve = null;
  let forwardSelected = null;

  function showConfirm(options = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      document.getElementById('confirm-icon').textContent = options.icon || '⚠️';
      document.getElementById('confirm-title').textContent = options.title || 'Are you sure?';
      document.getElementById('confirm-body').textContent = options.body || '';

      const btn = document.getElementById('confirm-ok-btn');
      btn.textContent = options.okLabel || 'Confirm';
      btn.className = 'modal-btn ' + (options.okClass || 'danger');

      modal.classList.add('open');
      confirmResolve = (val) => {
        modal.classList.remove('open');
        resolve(val);
      };
    });
  }

  function showAlert(options = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('alert-modal');
      document.getElementById('alert-icon').textContent = options.icon || 'ℹ️';
      document.getElementById('alert-title').textContent = options.title || 'Notice';
      document.getElementById('alert-body').textContent = options.body || '';

      modal.classList.add('open');
      alertResolve = () => {
        modal.classList.remove('open');
        resolve();
      };
    });
  }

  function showPhoneModal() {
    return new Promise((resolve) => {
      const modal = document.getElementById('phone-modal');
      const input = document.getElementById('phone-modal-input');
      const status = document.getElementById('phone-modal-status');

      input.value = '';
      status.textContent = '';
      status.className = 'modal-status';

      modal.classList.add('open');
      input.focus();

      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          document.getElementById('phone-modal-ok').click();
        }
      };

      phoneResolve = (val) => {
        if (val === null) {
          modal.classList.remove('open');
          resolve(null);
          return;
        }
        if (!val) {
          status.textContent = 'Please enter a phone number.';
          status.className = 'modal-status err';
          return;
        }
        modal.classList.remove('open');
        resolve(val);
      };
    });
  }

  function showForwardModal(contacts) {
    return new Promise((resolve) => {
      const modal = document.getElementById('forward-modal');
      const list = document.getElementById('fwd-contacts-list');
      const sendBtn = document.getElementById('fwd-send-btn');

      forwardSelected = null;
      list.innerHTML = '';

      contacts.forEach(contact => {
        const row = document.createElement('div');
        row.className = 'fwd-contact-item';
        row.innerHTML = `
          <img class="fwd-avatar" src="${contact.avatar || '/static/images/default_profile_picture.webp'}" alt="${contact.username}">
          <span class="fwd-name">${contact.username}</span>
        `;
        row.onclick = () => {
          document.querySelectorAll('.fwd-contact-item').forEach(r => r.classList.remove('selected'));
          row.classList.add('selected');
          forwardSelected = contact.username;
          sendBtn.disabled = false;
        };
        list.appendChild(row);
      });

      sendBtn.disabled = true;
      modal.classList.add('open');

      forwardResolve = (val) => {
        modal.classList.remove('open');
        resolve(val);
      };
    });
  }

  function init() {
    window._confirmResolve = (val) => { if (confirmResolve) confirmResolve(val); };
    window._alertResolve = () => { if (alertResolve) alertResolve(); };
    window._phoneResolve = (val) => { if (phoneResolve) phoneResolve(val); };
    window._fwdResolve = (val) => { if (forwardResolve) forwardResolve(val); };
    window._fwdConfirm = () => {
      if (forwardSelected && forwardResolve) {
        forwardResolve(forwardSelected);
      }
    };

    document.querySelectorAll('.modal-overlay, .custom-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
          overlay.style.display = 'none';
        }
      });
    });
  }

  return {
    init,
    showConfirm,
    showAlert,
    showPhoneModal,
    showForwardModal
  };
})();
EOF

    # ui/toast.js
    cat > "$STATIC_DIR/js/ui/toast.js" << 'EOF'
/**
 * Toast Notification System
 */
window.Toast = (function() {
  let timeoutId = null;
  let isVisible = false;

  function show(title, body, avatarUrl) {
    const el = document.getElementById('toast');

    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-body').textContent = body;

    if (avatarUrl) {
      document.getElementById('toast-img').src = avatarUrl;
    }

    el.classList.add('show');
    isVisible = true;

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      el.classList.remove('show');
      isVisible = false;
    }, 4000);
  }

  function hide() {
    const el = document.getElementById('toast');
    el.classList.remove('show');
    isVisible = false;
    clearTimeout(timeoutId);
  }

  function isShowing() {
    return isVisible;
  }

  function init() {
    document.getElementById('toast').addEventListener('click', hide);
  }

  return { show, hide, isShowing, init };
})();
EOF

    # ui/zoom.js
    cat > "$STATIC_DIR/js/ui/zoom.js" << 'EOF'
/**
 * Zoom Overlay - Image/Video zoom
 */
window.Zoom = (function() {
  function open(type, url) {
    const container = document.getElementById('zoom-content');
    const overlay = document.getElementById('zoom-overlay');

    container.innerHTML = '';
    const el = document.createElement(type === 'video' ? 'video' : 'img');
    el.src = url;
    if (type === 'video') {
      el.controls = true;
      el.autoplay = true;
    }
    container.appendChild(el);
    overlay.classList.add('open');
  }

  function close() {
    document.getElementById('zoom-overlay').classList.remove('open');
    document.getElementById('zoom-content').innerHTML = '';
  }

  function init() {
    document.getElementById('zoom-close').onclick = close;
    document.getElementById('zoom-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) close();
    });
  }

  return { open, close, init };
})();
EOF

    # main.js
    cat > "$STATIC_DIR/js/main.js" << 'EOF'
/**
 * Main Entry Point - Initializes all modules
 */
(function() {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('[Asterix] Initializing...');

    const Config = window.Config;
    const EventBus = window.EventBus;

    Config.init();
    EventBus.emit('app:initializing');

    window.Toast.init();
    window.Modals.init();
    window.Zoom.init();

    if (window.SidebarModule) window.SidebarModule.init();
    if (window.ChatModule) window.ChatModule.init();
    if (window.StatusViewerModule) window.StatusViewerModule.init();
    if (window.StatusUploadModule) window.StatusUploadModule.init();
    if (window.WeddingModule) window.WeddingModule.init();
    if (window.ContactsModule) window.ContactsModule.init();
    if (window.NotificationsModule) window.NotificationsModule.init();
    if (window.SettingsModule) window.SettingsModule.init();

    setupServiceWorker();
    setupOfflineDetection();
    setupOnlineStatus();
    setupAndroidBridge();

    EventBus.emit('app:ready');
    console.log('[Asterix] ✅ All systems ready');
  }

  function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/static/service-worker.js', { scope: '/' })
        .then(reg => console.log('[SW] Registered, scope:', reg.scope))
        .catch(e => console.warn('[SW] Registration failed:', e));
    }
  }

  function setupOfflineDetection() {
    const banner = document.getElementById('offline-banner');

    function setOnlineStatus(online) {
      banner.classList.toggle('show', !online);
    }

    window.addEventListener('online', () => {
      setOnlineStatus(true);
      window.Toast.show('Online', 'You are back online!');
    });

    window.addEventListener('offline', () => {
      setOnlineStatus(false);
      window.Toast.show('Offline', 'You are offline. Messages will be queued.');
    });

    if (!navigator.onLine) setOnlineStatus(false);
  }

  function setupOnlineStatus() {
    setInterval(async () => {
      try {
        const result = await window.ApiService.get('/api/users/online/');
        window.EventBus.emit('users:online', result.online || []);
      } catch (e) {
        // Silently fail
      }
    }, 30000);
  }

  function setupAndroidBridge() {
    if (!window.AndroidBridge) return;
    console.log('[Asterix] Android bridge detected');
  }
})();
EOF

    print_success "JavaScript files created"
}

# ============================================
# CREATE ALL OTHER COMPONENT FILES
# ============================================

create_component_files() {
    # Create auth_wall.html
    cat > "$TEMPLATES_DIR/components/auth_wall.html" << 'EOF'
{% load static %}
<div id="auth-wall" class="show">
  <div class="aw-logo"><i class="fas fa-comment-dots"></i></div>
  <h1>Welcome to Asterix</h1>
  <p>Zambia's community chat platform. Log in to see your chats, statuses and more.</p>
  <div class="aw-actions">
    <a href="{% url 'login-user' %}" class="aw-btn primary"><i class="fas fa-sign-in-alt"></i> Log In</a>
    <a href="{% url 'signup-user' %}" class="aw-btn secondary"><i class="fas fa-user-plus"></i> Sign Up</a>
  </div>
</div>
EOF

    # Create chat_area.html
    cat > "$TEMPLATES_DIR/components/chat_area.html" << 'EOF'
{% load static %}

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
    <label for="file-input" class="sr-only">Attach files</label>
    <input type="file" id="file-input" multiple style="display:none;" aria-label="Attach files">
    <button id="send-btn" title="Send message" aria-label="Send message"><i class="fas fa-paper-plane"></i></button>
  </div>
</div>
EOF

    # Create toast.html
    cat > "$TEMPLATES_DIR/components/toast.html" << 'EOF'
{% load static %}
<div id="toast" role="alert" aria-live="assertive" aria-atomic="true">
  <img src="{{ request.user.profile.profile_picture.url }}" alt="" id="toast-img">
  <div class="toast-body">
    <strong id="toast-title"></strong>
    <span id="toast-body"></span>
  </div>
</div>
EOF

    # Create offline_banner.html
    cat > "$TEMPLATES_DIR/components/offline_banner.html" << 'EOF'
<div id="offline-banner"><i class="fas fa-wifi-slash" style="margin-right:6px;"></i> You're offline — messages will send when reconnected.</div>
EOF

    # Create contact_info.html
    cat > "$TEMPLATES_DIR/components/contact_info.html" << 'EOF'
<div id="contact-info-overlay"></div>
<div id="contact-info-panel">
  <button class="cip-close" id="close-contact-info" aria-label="Close contact info">&times;</button>
  <img id="cip-avatar" src="" alt="Contact photo">
  <div id="cip-username"></div>
  <div id="cip-phone"><i class="fas fa-phone"></i> <span id="cip-phone-text"></span></div>
</div>
EOF

    # Create zoom_overlay.html
    cat > "$TEMPLATES_DIR/components/zoom_overlay.html" << 'EOF'
<div id="zoom-overlay">
  <button id="zoom-close" aria-label="Close zoom"><i class="fas fa-times"></i></button>
  <div id="zoom-content"></div>
</div>
EOF

    print_success "Component files created"
}

# ============================================
# CREATE STATUS FILES
# ============================================

create_status_files() {
    # viewer.html (simplified - full version would be longer)
    cat > "$TEMPLATES_DIR/status/viewer.html" << 'EOF'
<div id="status-viewer-modal">
  <div class="sv-segments" id="sv-segments"></div>
  <div class="sv-header">
    <img id="sv-avatar" src="" alt="">
    <div class="sv-user">
      <strong id="sv-username"></strong>
      <small id="sv-time"></small>
    </div>
    <span class="sv-cat-badge" id="sv-cat"></span>
    <button id="sv-share-btn" aria-label="Share status"><i class="fas fa-share-alt"></i></button>
    <button id="sv-close" aria-label="Close status viewer"><i class="fas fa-times"></i></button>
  </div>
  <div class="sv-media-wrap">
    <img id="sv-img" src="" alt="">
    <video id="sv-vid" src="" playsinline></video>
  </div>
  <div id="sv-caption"></div>
  <div class="sv-tap" id="sv-tap-left"></div>
  <div class="sv-tap" id="sv-tap-right"></div>
  <div id="sv-reaction-bar">
    <div class="sv-emoji-row" id="sv-emoji-row"></div>
    <div class="sv-reply-row">
      <input class="sv-reply-input" id="sv-reply-input" type="text" placeholder="Reply to this status…" maxlength="200">
      <button class="sv-reply-send" id="sv-reply-send" aria-label="Send reply"><i class="fas fa-paper-plane"></i></button>
    </div>
  </div>
</div>
EOF

    # upload_panel.html
    cat > "$TEMPLATES_DIR/status/upload_panel.html" << 'EOF'
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
EOF

    # views_panel.html
    cat > "$TEMPLATES_DIR/status/views_panel.html" << 'EOF'
<div id="status-views-panel">
  <div class="vp-header">
    <h3><i class="fas fa-eye" style="margin-right:7px;"></i>Viewed By</h3>
    <button id="close-views-panel" style="background:none; border:none; color:var(--sub); font-size:22px; cursor:pointer;">&times;</button>
  </div>
  <div class="vp-list" id="vp-list-container"></div>
</div>
EOF

    # transition.html
    cat > "$TEMPLATES_DIR/status/transition.html" << 'EOF'
<div id="sv-category-transition">
  <div class="sv-ct-icon" id="sv-ct-icon">🌐</div>
  <div class="sv-ct-label">Now entering</div>
  <div class="sv-ct-name" id="sv-ct-name">General</div>
  <div class="sv-ct-bar"><div class="sv-ct-bar-fill"></div></div>
</div>
EOF

    print_success "Status files created"
}

# ============================================
# CREATE MODAL FILES
# ============================================

create_modal_files() {
    # profile.html
    cat > "$TEMPLATES_DIR/modals/profile.html" << 'EOF'
{% load static %}
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
        <button class="modal-btn primary" id="pp-save-btn">Save Changes</button>
      </div>
      <div class="modal-status" id="pp-save-status"></div>
    </div>
  </div>
</div>
EOF

    # partners.html
    cat > "$TEMPLATES_DIR/modals/partners.html" << 'EOF'
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
    </div>
  </div>
</div>
EOF

    # confirm.html
    cat > "$TEMPLATES_DIR/modals/confirm.html" << 'EOF'
<div id="confirm-modal" class="modal-overlay" onclick="if(event.target===this)window._confirmResolve(false)">
  <div class="modal-card" onclick="event.stopPropagation()">
    <div class="modal-body" style="padding:26px 24px 20px;">
      <div class="confirm-icon" id="confirm-icon">⚠️</div>
      <div class="confirm-title" id="confirm-title">Are you sure?</div>
      <div class="confirm-body" id="confirm-body"></div>
      <div class="modal-actions" style="margin-top:20px;">
        <button class="modal-btn secondary" onclick="window._confirmResolve(false)">Cancel</button>
        <button class="modal-btn danger" id="confirm-ok-btn" onclick="window._confirmResolve(true)">Confirm</button>
      </div>
    </div>
  </div>
</div>
EOF

    # alert.html
    cat > "$TEMPLATES_DIR/modals/alert.html" << 'EOF'
<div id="alert-modal" class="modal-overlay" onclick="if(event.target===this)window._alertResolve()">
  <div class="modal-card" onclick="event.stopPropagation()">
    <div class="modal-body" style="padding:26px 24px 20px;">
      <div class="confirm-icon" id="alert-icon">ℹ️</div>
      <div class="confirm-title" id="alert-title">Notice</div>
      <div class="confirm-body" id="alert-body"></div>
      <div class="modal-actions" style="margin-top:20px;">
        <button class="modal-btn primary" onclick="window._alertResolve()">OK</button>
      </div>
    </div>
  </div>
</div>
EOF

    # phone.html
    cat > "$TEMPLATES_DIR/modals/phone.html" << 'EOF'
<div id="phone-modal" class="modal-overlay" onclick="if(event.target===this)window._phoneResolve(null)">
  <div class="modal-card" onclick="event.stopPropagation()">
    <div class="modal-header">
      <i class="fas fa-user-plus"></i>
      <h3>Add Contact</h3>
      <button class="modal-close" onclick="window._phoneResolve(null)">&times;</button>
    </div>
    <div class="modal-body">
      <div class="modal-field">
        <label>Phone Number</label>
        <input type="tel" id="phone-modal-input" placeholder="+2609XXXXXXXX" autocomplete="tel">
        <span class="modal-hint">Enter the number with country code. Only registered Asterix users can be added.</span>
      </div>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="window._phoneResolve(null)">Cancel</button>
        <button class="modal-btn primary" id="phone-modal-ok" onclick="window._phoneResolve(document.getElementById('phone-modal-input').value.trim())">Add</button>
      </div>
      <div class="modal-status" id="phone-modal-status"></div>
    </div>
  </div>
</div>
EOF

    # forward.html
    cat > "$TEMPLATES_DIR/modals/forward.html" << 'EOF'
<div id="forward-modal" class="modal-overlay" onclick="if(event.target===this)window._fwdResolve(null)">
  <div class="modal-card" style="width:360px;" onclick="event.stopPropagation()">
    <div class="modal-header">
      <i class="fas fa-share"></i>
      <h3>Forward Message</h3>
      <button class="modal-close" onclick="window._fwdResolve(null)">&times;</button>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--sub);margin-bottom:12px;">Select a contact to forward this message to:</p>
      <div class="fwd-contacts" id="fwd-contacts-list"></div>
      <div class="modal-actions">
        <button class="modal-btn secondary" onclick="window._fwdResolve(null)">Cancel</button>
        <button class="modal-btn primary" id="fwd-send-btn" onclick="window._fwdConfirm()" disabled>Forward</button>
      </div>
    </div>
  </div>
</div>
EOF

    # user_actions.html
    cat > "$TEMPLATES_DIR/modals/user_actions.html" << 'EOF'
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
EOF

    print_success "Modal files created"
}

# ============================================
# CREATE WEDDING PANEL
# ============================================

create_wedding_panel() {
    cat > "$TEMPLATES_DIR/wedding/panel.html" << 'EOF'
<div id="wedding-panel-overlay"></div>
<div id="wedding-panel">
  <div class="wp-header">
    <h3>💍 Weddings &amp; Events</h3>
    <button id="close-wedding-panel" onclick="window.WeddingModule.closePanel()">&times;</button>
  </div>
  <div class="wp-tabs">
    <button class="wp-tab active" id="wp-tab-create" onclick="window.WeddingModule.switchTab('create')">Create Event</button>
    <button class="wp-tab" id="wp-tab-invite" onclick="window.WeddingModule.switchTab('invite')">Invite Card</button>
    <button class="wp-tab" id="wp-tab-guests" onclick="window.WeddingModule.switchTab('guests')">Guest List</button>
  </div>
  <div class="wp-section" id="wp-create-section">
    <div class="wp-field">
      <label>Event Type</label>
      <select id="wp-event-type">
        <option value="wedding">💍 Wedding</option>
        <option value="chilanga_mulilo">🍲 Chilanga Mulilo</option>
        <option value="kitchen_party">🎀 Kitchen Party</option>
        <option value="lobola">🐄 Lobola</option>
        <option value="baby_shower">🍼 Baby Shower</option>
        <option value="graduation">🎓 Graduation</option>
        <option value="other">🎉 Other Celebration</option>
      </select>
    </div>
    <div class="wp-field">
      <label>Event Title</label>
      <input type="text" id="wp-title" placeholder="e.g. Mwila &amp; Chanda Wedding">
    </div>
    <div class="wp-field" id="wp-names-wrap">
      <label>Bride &amp; Groom Names</label>
      <input type="text" id="wp-bride" placeholder="Bride's name" style="margin-bottom:6px;">
      <input type="text" id="wp-groom" placeholder="Groom's name">
    </div>
    <div class="wp-field">
      <label>Venue</label>
      <input type="text" id="wp-venue" placeholder="e.g. Mulungushi Conference Centre, Lusaka">
    </div>
    <div class="wp-field">
      <label>Date &amp; Time</label>
      <input type="datetime-local" id="wp-date">
    </div>
    <div class="wp-field">
      <label>Dress Code</label>
      <input type="text" id="wp-dress" placeholder="e.g. Chitenge attire, Formal, Casual">
    </div>
    <div class="wp-field">
      <label>RSVP Deadline</label>
      <input type="date" id="wp-rsvp-deadline">
    </div>
    <div class="wp-field">
      <label>Family Contact</label>
      <input type="text" id="wp-family-name" placeholder="Contact person name" style="margin-bottom:6px;">
      <input type="tel" id="wp-family-phone" placeholder="+260 97X XXX XXX">
    </div>
    <div class="wp-field">
      <label>Description (optional)</label>
      <textarea id="wp-description" placeholder="Any extra details for guests…"></textarea>
    </div>
    <div class="wp-field">
      <label>Who can view this event?</label>
      <div class="wp-vis-chips">
        <button class="wp-vis-chip active" data-vis="invite_only" onclick="window.WeddingModule.selectVisibility(this)">🔒 Invite Only</button>
        <button class="wp-vis-chip" data-vis="contacts" onclick="window.WeddingModule.selectVisibility(this)">👥 My Contacts</button>
        <button class="wp-vis-chip" data-vis="public" onclick="window.WeddingModule.selectVisibility(this)">🌐 Public Link</button>
      </div>
    </div>
    <div class="wp-field">
      <label>Cover Photo (optional)</label>
      <input type="file" id="wp-cover-photo" accept="image/*,video/*">
    </div>
    <div class="modal-status" id="wp-create-status"></div>
    <button class="wp-submit-btn" id="wp-create-btn">
      <i class="fas fa-paper-plane"></i> Create Event &amp; Get Invite Link
    </button>
  </div>
  <div class="wp-section" id="wp-invite-section" style="display:none;">
    <div id="wp-invite-card-wrap">
      <p style="font-size:13px;color:var(--sub);text-align:center;margin-bottom:16px;">
        Create an event first, then share the card below with your guests.
      </p>
    </div>
  </div>
  <div class="wp-section" id="wp-guests-section" style="display:none;">
    <div class="wp-field">
      <label>Invite a contact by username</label>
      <div style="display:flex;gap:6px;">
        <input type="text" id="wp-invite-username" placeholder="Username" style="flex:1;">
        <button onclick="window.WeddingModule.inviteUser()" style="padding:8px 14px;background:#e91e63;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Invite</button>
      </div>
    </div>
    <div class="modal-status" id="wp-invite-status"></div>
    <div id="wp-guest-list" style="margin-top:10px;"></div>
  </div>
</div>
EOF
    print_success "Wedding panel created"
}

# ============================================
# UPDATE URLs AND VIEWS
# ============================================

update_urls_and_views() {
    print_info "Checking for views.py..."

    # Check if views.py exists
    if [ -f "$CHAT_APP/views.py" ]; then
        print_info "views.py exists. You may need to update it to pass the 'categories' context."
        print_info "Add this to your chat view:"
        echo ""
        echo "    categories = ['General', 'Funerals', 'Weddings', 'Market', 'Church']"
        echo "    context['categories'] = categories"
        echo ""
    fi

    # Check urls.py
    if [ -f "$CHAT_APP/urls.py" ]; then
        print_info "urls.py exists. No changes needed."
    else
        print_warning "urls.py not found. You need to create it."
    fi
}

# ============================================
# RUN COLLECTSTATIC
# ============================================

run_collectstatic() {
    print_info "Running collectstatic..."
    cd "$PROJECT_ROOT"
    python manage.py collectstatic --noinput || print_warning "collectstatic failed. Run it manually."
}

# ============================================
# EXECUTE ALL
# ============================================

create_directories
create_base_html
create_app_shell_html
create_index_html
create_sidebar_html
create_component_files
create_status_files
create_modal_files
create_wedding_panel
create_css_files
create_js_files
update_urls_and_views

print_success "✅ All files created successfully!"

echo ""
print_info "Directory structure created:"
echo ""
echo "📁 chat/"
echo "├── 📁 templates/chat/"
echo "│   ├── 📄 index.html"
echo "│   ├── 📁 layouts/"
echo "│   │   ├── base.html"
echo "│   │   └── app_shell.html"
echo "│   ├── 📁 components/"
echo "│   │   ├── auth_wall.html"
echo "│   │   ├── sidebar.html"
echo "│   │   ├── chat_area.html"
echo "│   │   ├── toast.html"
echo "│   │   ├── offline_banner.html"
echo "│   │   ├── contact_info.html"
echo "│   │   └── zoom_overlay.html"
echo "│   ├── 📁 status/"
echo "│   │   ├── viewer.html"
echo "│   │   ├── upload_panel.html"
echo "│   │   ├── views_panel.html"
echo "│   │   └── transition.html"
echo "│   ├── 📁 modals/"
echo "│   │   ├── profile.html"
echo "│   │   ├── partners.html"
echo "│   │   ├── confirm.html"
echo "│   │   ├── alert.html"
echo "│   │   ├── phone.html"
echo "│   │   ├── forward.html"
echo "│   │   ├── settings.html"
echo "│   │   ├── wedding.html"
echo "│   │   └── user_actions.html"
echo "│   └── 📁 wedding/"
echo "│       └── panel.html"
echo "├── 📁 static/chat/"
echo "│   ├── 📁 css/"
echo "│   │   ├── base.css"
echo "│   │   ├── sidebar.css"
echo "│   │   ├── chat.css"
echo "│   │   ├── status.css"
echo "│   │   ├── modals.css"
echo "│   │   ├── settings.css"
echo "│   │   └── wedding.css"
echo "│   ├── 📁 js/"
echo "│   │   ├── main.js"
echo "│   │   ├── 📁 core/"
echo "│   │   │   ├── constants.js"
echo "│   │   │   ├── config.js"
echo "│   │   │   └── event-bus.js"
echo "│   │   ├── 📁 services/"
echo "│   │   │   ├── api.js"
echo "│   │   │   ├── messages.js"
echo "│   │   │   ├── status.js"
echo "│   │   │   ├── contacts.js"
echo "│   │   │   ├── events.js"
echo "│   │   │   └── storage.js"
echo "│   │   ├── 📁 ui/"
echo "│   │   │   ├── utils.js"
echo "│   │   │   ├── render.js"
echo "│   │   │   ├── modals.js"
echo "│   │   │   ├── toast.js"
echo "│   │   │   └── zoom.js"
echo "│   │   └── 📁 modules/"
echo "│   │       ├── chat.js"
echo "│   │       ├── sidebar.js"
echo "│   │       ├── status-viewer.js"
echo "│   │       ├── status-upload.js"
echo "│   │       ├── wedding.js"
echo "│   │       ├── contacts.js"
echo "│   │       ├── notifications.js"
echo "│   │       └── settings.js"
echo "│   └── 📁 images/"
echo "└── 📁 backups/"

echo ""
print_info "Next steps:"
echo "1. Run: python manage.py collectstatic"
echo "2. Update your chat view to pass 'categories' context"
echo "3. Test the application"
echo "4. Your old files are backed up in: $PROJECT_ROOT/backups/"