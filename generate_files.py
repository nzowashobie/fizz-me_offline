#!/usr/bin/env python3
"""
Asterix Modular File Generator - Based on Template
Run this script to create all modular files matching the template design.
"""

import os
import json
from pathlib import Path

# Base directories
BASE_DIR = Path('.')
STATIC_DIR = BASE_DIR / 'static'
CSS_DIR = STATIC_DIR / 'css'
JS_DIR = STATIC_DIR / 'js'
IMAGES_DIR = STATIC_DIR / 'images'
TEMPLATES_DIR = BASE_DIR / 'templates'
PARTIALS_DIR = TEMPLATES_DIR / 'partials'
MODALS_DIR = PARTIALS_DIR / 'modals'

def create_directories():
    """Create all necessary directories"""
    directories = [
        STATIC_DIR,
        CSS_DIR,
        JS_DIR,
        IMAGES_DIR,
        TEMPLATES_DIR,
        PARTIALS_DIR,
        MODALS_DIR,
    ]
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
        print(f"Created directory: {directory}")

# ==================== CSS FILES ====================

def create_base_css():
    """Create base.css"""
    content = """/* Base styles and variables - Matching Template */
:root {
  --primary-color: #128c7e;
  --primary-dark: #075e54;
  --primary-light: #25d366;
  --secondary-color: #34b7f1;
  --background-light: #f0f2f5;
  --background-dark: #1a1a1a;
  --text-primary: #333333;
  --text-secondary: #666666;
  --text-light: #ffffff;
  --border-color: #e9edef;
  --shadow-color: rgba(0, 0, 0, 0.1);
  --shadow-hover: rgba(0, 0, 0, 0.15);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --transition-fast: 0.2s ease;
  --transition-medium: 0.3s ease;
  --transition-slow: 0.5s ease;
  --sidebar-width: 320px;
  --header-height: 60px;
  --footer-height: 62px;
  --online-color: #31a24c;
  --offline-color: #9aa2ab;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: var(--background-light);
  color: var(--text-primary);
  height: 100vh;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

#app-shell {
  display: flex;
  height: 100vh;
  background: var(--background-light);
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #c1c7cd;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a0a8b0;
}

/* Utility classes */
.hidden {
  display: none !important;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gap-1 { gap: 8px; }
.gap-2 { gap: 16px; }
.gap-3 { gap: 24px; }

.text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Loading spinner */
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Toast container */
#toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  max-width: 400px;
}

.toast {
  background: white;
  padding: 16px 20px;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px var(--shadow-color);
  margin-bottom: 12px;
  animation: slideIn 0.3s ease;
  border-left: 4px solid var(--primary-color);
  display: flex;
  align-items: center;
  gap: 12px;
}

.toast.error {
  border-left-color: #dc3545;
}

.toast.success {
  border-left-color: var(--primary-light);
}

.toast.warning {
  border-left-color: #ffc107;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Dark theme */
[data-theme="dark"] {
  --background-light: #1a1a1a;
  --text-primary: #e9edef;
  --text-secondary: #9aa2ab;
  --border-color: #2d2d2d;
  --shadow-color: rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] body {
  background: #1a1a1a;
}

[data-theme="dark"] .toast {
  background: #2d2d2d;
  color: #e9edef;
}

/* Responsive */
@media (max-width: 768px) {
  #app-shell {
    flex-direction: column;
  }

  #toast-container {
    top: 10px;
    right: 10px;
    max-width: 90%;
  }
}

/* Offline banner */
.offline-banner {
  background: #dc3545;
  color: white;
  padding: 8px 16px;
  text-align: center;
  font-size: 13px;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: none;
}

.offline-banner.show {
  display: block;
}
"""
    file_path = CSS_DIR / 'base.css'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_sidebar_css():
    """Create sidebar.css - Matching Template Navigation"""
    content = """/* Sidebar styles - Matching Template */
#sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  height: 100vh;
  background: white;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: transform var(--transition-medium);
  z-index: 100;
}

[data-theme="dark"] #sidebar {
  background: #1a1a1a;
}

/* Sidebar header with navigation */
.sidebar-header {
  padding: 16px 20px;
  background: var(--primary-dark);
  color: white;
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.sidebar-header .app-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.sidebar-header .header-actions {
  display: flex;
  gap: 8px;
}

.sidebar-header .header-actions button {
  background: transparent;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.sidebar-header .header-actions button:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Navigation tabs - My Status, General, Funerals, Weddings, Market, Ch */
.nav-tabs {
  display: flex;
  padding: 8px 12px;
  gap: 4px;
  background: var(--background-light);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
  flex-shrink: 0;
}

[data-theme="dark"] .nav-tabs {
  background: #1a1a1a;
}

.nav-tabs .nav-item {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  background: transparent;
  border: none;
}

.nav-tabs .nav-item:hover {
  background: rgba(18, 140, 126, 0.1);
  color: var(--primary-color);
}

.nav-tabs .nav-item.active {
  background: var(--primary-color);
  color: white;
}

.nav-tabs .nav-item .badge {
  background: var(--primary-light);
  color: white;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  margin-left: 4px;
}

/* Search bar */
.search-bar {
  padding: 8px 12px;
  background: var(--background-light);
  flex-shrink: 0;
}

[data-theme="dark"] .search-bar {
  background: #1a1a1a;
}

.search-bar .search-container {
  display: flex;
  align-items: center;
  background: white;
  border-radius: var(--radius-md);
  padding: 4px 12px;
  box-shadow: 0 1px 3px var(--shadow-color);
}

[data-theme="dark"] .search-bar .search-container {
  background: #2d2d2d;
}

.search-bar .search-container i {
  color: var(--text-secondary);
  margin-right: 8px;
  font-size: 14px;
}

.search-bar .search-container input {
  border: none;
  outline: none;
  padding: 8px 0;
  width: 100%;
  font-size: 14px;
  background: transparent;
  color: var(--text-primary);
}

.search-bar .search-container input::placeholder {
  color: var(--text-secondary);
}

/* Chat list */
.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.chat-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background var(--transition-fast);
  border-bottom: 1px solid var(--border-color);
  position: relative;
}

.chat-item:hover {
  background: var(--background-light);
}

.chat-item.active {
  background: #e8f0fe;
}

[data-theme="dark"] .chat-item.active {
  background: #2d3d3a;
}

.chat-item .avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 18px;
  flex-shrink: 0;
  position: relative;
}

.chat-item .avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.chat-item .avatar .status-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  background: var(--online-color);
}

.chat-item .avatar .status-dot.offline {
  background: var(--offline-color);
}

.chat-item .chat-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}

.chat-item .chat-info .chat-name {
  font-weight: 500;
  font-size: 16px;
}

.chat-item .chat-info .chat-last-msg {
  color: var(--text-secondary);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item .chat-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  margin-left: 8px;
}

.chat-item .chat-meta .chat-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.chat-item .chat-meta .unread-badge {
  background: var(--primary-light);
  color: white;
  border-radius: 50%;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  margin-top: 4px;
  min-width: 18px;
  text-align: center;
}

/* No chats state */
.no-chats {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  padding: 40px;
  text-align: center;
}

.no-chats i {
  font-size: 40px;
  color: var(--border-color);
  margin-bottom: 12px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  #sidebar {
    width: 100%;
    min-width: 100%;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    transform: translateX(-100%);
  }

  #sidebar.open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
  }

  .sidebar-backdrop.show {
    display: block;
  }
}
"""
    file_path = CSS_DIR / 'sidebar.css'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_chat_css():
    """Create chat.css"""
    content = """/* Chat area styles */
#chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--background-light);
  height: 100vh;
  position: relative;
}

/* Chat header */
.chat-header {
  padding: 10px 16px;
  background: white;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  height: var(--header-height);
  flex-shrink: 0;
}

[data-theme="dark"] .chat-header {
  background: #1a1a1a;
}

.chat-header .back-btn {
  display: none;
  background: transparent;
  border: none;
  font-size: 20px;
  cursor: pointer;
  margin-right: 12px;
  color: var(--text-primary);
}

.chat-header .avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
}

.chat-header .avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.chat-header .chat-user-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}

.chat-header .chat-user-info .chat-user-name {
  font-weight: 500;
  font-size: 16px;
}

.chat-header .chat-user-info .chat-user-status {
  font-size: 13px;
  color: var(--text-secondary);
}

.chat-header .chat-actions {
  display: flex;
  gap: 4px;
}

.chat-header .chat-actions button {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 50%;
  transition: all var(--transition-fast);
}

.chat-header .chat-actions button:hover {
  background: var(--background-light);
  color: var(--text-primary);
}

/* Empty chat state - "Tap to open chat" */
.empty-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  padding: 40px;
  text-align: center;
}

.empty-chat i {
  font-size: 64px;
  color: var(--border-color);
  margin-bottom: 16px;
}

.empty-chat h3 {
  color: var(--text-primary);
  margin-bottom: 4px;
}

.empty-chat p {
  font-size: 14px;
}

/* Messages container */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  background-image:
    radial-gradient(circle at 20% 50%, rgba(18, 140, 126, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 80% 50%, rgba(52, 183, 241, 0.05) 0%, transparent 50%);
}

.message {
  max-width: 65%;
  margin-bottom: 4px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  word-wrap: break-word;
  animation: messageIn 0.3s ease;
  position: relative;
}

.message.sent {
  align-self: flex-end;
  background: #dcf8c6;
  border-bottom-right-radius: 4px;
}

.message.received {
  align-self: flex-start;
  background: white;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px var(--shadow-color);
}

[data-theme="dark"] .message.sent {
  background: #056162;
  color: #e9edef;
}

[data-theme="dark"] .message.received {
  background: #2d2d2d;
  color: #e9edef;
}

.message .message-text {
  font-size: 14px;
  line-height: 1.5;
}

.message .message-time {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}

.message .message-time i {
  font-size: 12px;
}

.message.sent .message-time {
  color: rgba(0, 0, 0, 0.5);
}

[data-theme="dark"] .message.sent .message-time {
  color: rgba(255, 255, 255, 0.5);
}

@keyframes messageIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Date divider */
.date-divider {
  text-align: center;
  margin: 12px 0;
  position: relative;
}

.date-divider span {
  background: var(--background-light);
  padding: 2px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
  position: relative;
  z-index: 1;
}

[data-theme="dark"] .date-divider span {
  background: #1a1a1a;
}

.date-divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border-color);
}

/* Typing indicator */
.typing-indicator {
  display: none;
  align-self: flex-start;
  background: white;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px var(--shadow-color);
  margin-bottom: 4px;
}

[data-theme="dark"] .typing-indicator {
  background: #2d2d2d;
}

.typing-indicator.active {
  display: flex;
  align-items: center;
  gap: 4px;
}

.typing-indicator .dot {
  width: 6px;
  height: 6px;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: typingDot 1.4s infinite;
}

.typing-indicator .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator .dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typingDot {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-6px);
  }
}

/* Message input */
.message-input-container {
  padding: 8px 12px;
  background: white;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-height: var(--footer-height);
}

[data-theme="dark"] .message-input-container {
  background: #1a1a1a;
}

.message-input-container .input-actions {
  display: flex;
  gap: 2px;
}

.message-input-container .input-actions button {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  transition: all var(--transition-fast);
}

.message-input-container .input-actions button:hover {
  background: var(--background-light);
  color: var(--primary-color);
}

.message-input-container input {
  flex: 1;
  border: none;
  outline: none;
  padding: 8px 14px;
  background: var(--background-light);
  border-radius: var(--radius-xl);
  font-size: 14px;
  transition: all var(--transition-fast);
  color: var(--text-primary);
}

[data-theme="dark"] .message-input-container input {
  background: #2d2d2d;
  color: #e9edef;
}

.message-input-container input:focus {
  background: white;
  box-shadow: 0 0 0 2px var(--primary-color);
}

[data-theme="dark"] .message-input-container input:focus {
  background: #2d2d2d;
}

.message-input-container .send-btn {
  background: var(--primary-color);
  border: none;
  color: white;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-input-container .send-btn:hover {
  background: var(--primary-dark);
  transform: scale(1.05);
}

.message-input-container .send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .chat-header .back-btn {
    display: block;
  }

  .message {
    max-width: 80%;
  }

  #chat-area {
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    transform: translateX(100%);
    transition: transform var(--transition-medium);
  }

  #chat-area.open {
    transform: translateX(0);
  }
}
"""
    file_path = CSS_DIR / 'chat.css'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_modals_css():
    """Create modals.css"""
    content = """/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: none;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.3s ease;
}

.modal-overlay.active {
  display: flex;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: white;
  border-radius: var(--radius-lg);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] .modal {
  background: #1a1a1a;
  color: #e9edef;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
}

.modal-header .close-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.modal-header .close-btn:hover {
  background: var(--background-light);
  color: var(--text-primary);
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Modal form elements */
.modal-body .form-group {
  margin-bottom: 16px;
}

.modal-body .form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 6px;
  font-size: 14px;
}

.modal-body .form-group input,
.modal-body .form-group textarea,
.modal-body .form-group select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 14px;
  transition: all var(--transition-fast);
  background: white;
  color: var(--text-primary);
}

[data-theme="dark"] .modal-body .form-group input,
[data-theme="dark"] .modal-body .form-group textarea,
[data-theme="dark"] .modal-body .form-group select {
  background: #2d2d2d;
  color: #e9edef;
  border-color: #3d3d3d;
}

.modal-body .form-group input:focus,
.modal-body .form-group textarea:focus,
.modal-body .form-group select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(18, 140, 126, 0.1);
}

.modal-body .form-group textarea {
  min-height: 100px;
  resize: vertical;
}

/* Buttons */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(18, 140, 126, 0.3);
}

.btn-secondary {
  background: var(--background-light);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: #e5e8ec;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-sm {
  padding: 6px 14px;
  font-size: 13px;
}

/* Responsive */
@media (max-width: 768px) {
  .modal {
    max-width: 95%;
    margin: 10px;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-footer {
    flex-direction: column;
  }

  .modal-footer .btn {
    width: 100%;
  }
}
"""
    file_path = CSS_DIR / 'modals.css'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_status_css():
    """Create status.css"""
    content = """/* Status viewer styles */
#status-viewer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 2000;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

#status-viewer.active {
  display: flex;
}

.status-viewer-header {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 1;
}

.status-viewer-header .user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
}

.status-viewer-header .user-info .avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
}

.status-viewer-header .user-info .avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.status-viewer-header .user-info .name {
  font-weight: 500;
}

.status-viewer-header .user-info .time {
  font-size: 12px;
  opacity: 0.8;
}

.status-viewer-header .close-btn {
  background: transparent;
  border: none;
  color: white;
  font-size: 28px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity var(--transition-fast);
}

.status-viewer-header .close-btn:hover {
  opacity: 1;
}

.status-content {
  max-width: 400px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-content img,
.status-content video {
  max-width: 100%;
  max-height: 80vh;
  border-radius: var(--radius-md);
  object-fit: contain;
}

.status-content .text-status {
  color: white;
  font-size: 24px;
  text-align: center;
  padding: 40px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-md);
  width: 100%;
}

.status-progress {
  position: absolute;
  top: 80px;
  left: 20px;
  right: 20px;
  display: flex;
  gap: 4px;
  z-index: 1;
}

.status-progress .progress-bar {
  flex: 1;
  height: 3px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  overflow: hidden;
}

.status-progress .progress-bar .progress-fill {
  height: 100%;
  background: white;
  width: 0%;
  transition: width 0.1s linear;
}

.status-progress .progress-bar.active .progress-fill {
  animation: progress 5s linear forwards;
}

@keyframes progress {
  from { width: 0%; }
  to { width: 100%; }
}

/* Status navigation */
.status-nav {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  z-index: 1;
  cursor: pointer;
}

.status-nav.prev {
  left: 0;
}

.status-nav.next {
  right: 0;
}

/* Status list in sidebar */
.status-list {
  padding: 4px 0;
  border-bottom: 1px solid var(--border-color);
}

.status-item {
  display: flex;
  align-items: center;
  padding: 6px 16px;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.status-item:hover {
  background: var(--background-light);
}

.status-item .status-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  padding: 2px;
  background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-item .status-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid white;
  object-fit: cover;
}

.status-item .status-avatar.viewed {
  padding: 0;
  background: var(--border-color);
}

.status-item .status-avatar.viewed img {
  border: 2px solid var(--border-color);
}

.status-item .status-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}

.status-item .status-info .status-name {
  font-weight: 500;
  font-size: 14px;
}

.status-item .status-info .status-time {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .status-content {
    max-width: 100%;
  }

  .status-viewer-header {
    top: 10px;
    left: 10px;
    right: 10px;
  }

  .status-progress {
    top: 70px;
    left: 10px;
    right: 10px;
  }
}
"""
    file_path = CSS_DIR / 'status.css'
    file_path.write_text(content)
    print(f"Created: {file_path}")

# ==================== JAVASCRIPT FILES ====================

def create_utils_js():
    """Create utils.js"""
    content = """// Utility functions
const Utils = {
    $(selector, context = document) {
        return context.querySelector(selector);
    },

    $$(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    },

    html(strings, ...values) {
        return strings.reduce((result, str, i) =>
            result + str + (values[i] || ''), '');
    },

    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    formatTime(date) {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
        if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diff < 172800000) return 'Yesterday';
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    },

    formatDate(date) {
        const d = new Date(date);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d >= today) return 'Today';
        if (d >= yesterday) return 'Yesterday';
        return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    },

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    },

    copyToClipboard(text) {
        return navigator.clipboard.writeText(text);
    },

    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    },

    isImage(filename) {
        const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
        return extensions.includes(this.getFileExtension(filename));
    },

    isVideo(filename) {
        const extensions = ['mp4', 'webm', 'ogg', 'mov', 'avi'];
        return extensions.includes(this.getFileExtension(filename));
    }
};

// Toast system
const Toast = {
    container: null,

    init() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show(message, type = 'info', duration = 3000) {
        this.init();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${this.getIcon(type)}"></i>
            <span>${message}</span>
        `;

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    getIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    },

    success(message, duration) {
        this.show(message, 'success', duration);
    },

    error(message, duration) {
        this.show(message, 'error', duration);
    },

    warning(message, duration) {
        this.show(message, 'warning', duration);
    },

    info(message, duration) {
        this.show(message, 'info', duration);
    }
};

// Modal system
const ModalManager = {
    currentModal: null,

    open(modalId) {
        const overlay = document.getElementById(modalId);
        if (!overlay) return;

        overlay.classList.add('active');
        this.currentModal = overlay;
        document.body.style.overflow = 'hidden';

        const closeBtn = overlay.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => this.close(modalId);
        }

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.close(modalId);
            }
        };

        document.addEventListener('keydown', this.handleEscape);
        this.triggerEvent(modalId, 'open');
    },

    close(modalId) {
        const overlay = document.getElementById(modalId);
        if (!overlay) return;

        overlay.classList.remove('active');
        if (this.currentModal === overlay) {
            this.currentModal = null;
        }
        document.body.style.overflow = '';
        document.removeEventListener('keydown', this.handleEscape);
        this.triggerEvent(modalId, 'close');
    },

    handleEscape(e) {
        if (e.key === 'Escape' && ModalManager.currentModal) {
            const modalId = ModalManager.currentModal.id;
            ModalManager.close(modalId);
        }
    },

    triggerEvent(modalId, event) {
        const eventName = new CustomEvent(`${event}:${modalId}`);
        document.dispatchEvent(eventName);
    }
};

window.Utils = Utils;
window.Toast = Toast;
window.ModalManager = ModalManager;
"""
    file_path = JS_DIR / 'utils.js'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_auth_js():
    """Create auth.js"""
    content = """// Authentication module
const Auth = {
    currentUser: null,
    isAuthenticated: false,

    init() {
        this.checkAuth();
        this.setupEventListeners();
    },

    checkAuth() {
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                this.currentUser = JSON.parse(userData);
                this.isAuthenticated = true;
                this.onAuthSuccess();
            } catch (e) {
                console.error('Invalid user data:', e);
                this.logout();
            }
        } else {
            this.onAuthRequired();
        }
    },

    setupEventListeners() {
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'login-form') {
                e.preventDefault();
                this.handleLogin(e.target);
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('#logout-btn')) {
                e.preventDefault();
                this.logout();
            }
        });

        document.addEventListener('submit', (e) => {
            if (e.target.id === 'phone-verification-form') {
                e.preventDefault();
                this.handlePhoneVerification(e.target);
            }
        });
    },

    handleLogin(form) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

        setTimeout(() => {
            const user = {
                id: Date.now(),
                name: data.username || 'User',
                email: data.email || 'user@example.com',
                phone: data.phone || '+1234567890',
                avatar: null
            };

            this.setUser(user);
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Login';
            Toast.success('Welcome back, ' + user.name + '!');
        }, 1000);
    },

    handlePhoneVerification(form) {
        const phone = form.querySelector('input[type="tel"]').value;

        if (!phone || phone.length < 10) {
            Toast.error('Please enter a valid phone number');
            return;
        }

        Toast.info('Verification code sent to ' + phone);
    },

    setUser(user) {
        this.currentUser = user;
        this.isAuthenticated = true;
        localStorage.setItem('user', JSON.stringify(user));
        this.onAuthSuccess();
    },

    logout() {
        this.currentUser = null;
        this.isAuthenticated = false;
        localStorage.removeItem('user');
        this.onAuthRequired();
        Toast.info('You have been logged out');
    },

    onAuthSuccess() {
        const authWall = document.getElementById('auth-wall');
        const appShell = document.getElementById('app-shell');

        if (authWall) authWall.style.display = 'none';
        if (appShell) appShell.style.display = 'flex';

        this.updateUI();

        document.dispatchEvent(new CustomEvent('auth:success', {
            detail: { user: this.currentUser }
        }));
    },

    onAuthRequired() {
        const authWall = document.getElementById('auth-wall');
        const appShell = document.getElementById('app-shell');

        if (authWall) authWall.style.display = 'flex';
        if (appShell) appShell.style.display = 'none';
    },

    updateUI() {
        if (!this.currentUser) return;

        const avatarElements = document.querySelectorAll('.user-avatar');
        avatarElements.forEach(el => {
            if (this.currentUser.avatar) {
                el.innerHTML = `<img src="${this.currentUser.avatar}" alt="${this.currentUser.name}">`;
            } else {
                el.textContent = Utils.getInitials(this.currentUser.name);
            }
        });

        const nameElements = document.querySelectorAll('.user-name');
        nameElements.forEach(el => {
            el.textContent = this.currentUser.name;
        });

        const profileName = document.getElementById('profile-name');
        const profileEmail = document.getElementById('profile-email');
        const profilePhone = document.getElementById('profile-phone');
        const profileAvatar = document.getElementById('profile-avatar');

        if (profileName) profileName.value = this.currentUser.name;
        if (profileEmail) profileEmail.value = this.currentUser.email || '';
        if (profilePhone) profilePhone.value = this.currentUser.phone || '';
        if (profileAvatar) {
            if (this.currentUser.avatar) {
                profileAvatar.innerHTML = `<img src="${this.currentUser.avatar}" alt="Avatar">`;
            } else {
                profileAvatar.textContent = Utils.getInitials(this.currentUser.name);
            }
        }
    },

    updateProfile(data) {
        if (!this.currentUser) return;

        this.currentUser = { ...this.currentUser, ...data };
        localStorage.setItem('user', JSON.stringify(this.currentUser));
        this.updateUI();

        Toast.success('Profile updated successfully');
        document.dispatchEvent(new CustomEvent('profile:updated', {
            detail: { user: this.currentUser }
        }));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});

window.Auth = Auth;
"""
    file_path = JS_DIR / 'auth.js'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_chat_js():
    """Create chat.js"""
    content = """// Chat module
const Chat = {
    currentChat: null,
    messages: {},
    isTyping: false,
    typingTimeout: null,

    init() {
        this.setupEventListeners();
        this.loadChats();
        this.setupMessageInput();

        document.addEventListener('auth:success', () => {
            this.loadChats();
        });
    },

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const chatItem = e.target.closest('.chat-item');
            if (chatItem) {
                const chatId = chatItem.dataset.chatId;
                this.openChat(chatId);
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('#send-message-btn')) {
                this.sendMessage();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.id === 'message-input') {
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.id === 'message-input') {
                this.handleTyping();
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('#chat-back-btn')) {
                this.closeChat();
            }
        });

        // Navigation tabs
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
                navItem.classList.add('active');
                this.filterChats(navItem.dataset.tab);
            }
        });
    },

    loadChats() {
        const mockChats = [
            {
                id: '1',
                name: 'Bwalya',
                avatar: null,
                lastMessage: 'Tap to open chat',
                lastMessageTime: new Date(Date.now() - 60000).toISOString(),
                unread: 2,
                online: true,
                category: 'general'
            },
            {
                id: '2',
                name: 'Chilamo',
                avatar: null,
                lastMessage: 'Tap to open chat',
                lastMessageTime: new Date(Date.now() - 3600000).toISOString(),
                unread: 0,
                online: false,
                category: 'general'
            },
            {
                id: '3',
                name: 'Mwanza',
                avatar: null,
                lastMessage: 'Tap to open chat',
                lastMessageTime: new Date(Date.now() - 7200000).toISOString(),
                unread: 1,
                online: true,
                category: 'funerals'
            },
            {
                id: '4',
                name: 'Kabwe',
                avatar: null,
                lastMessage: 'Tap to open chat',
                lastMessageTime: new Date(Date.now() - 86400000).toISOString(),
                unread: 0,
                online: false,
                category: 'weddings'
            }
        ];

        this.renderChats(mockChats);
    },

    renderChats(chats) {
        const chatList = document.querySelector('.chat-list');
        if (!chatList) return;

        if (chats.length === 0) {
            chatList.innerHTML = `
                <div class="no-chats">
                    <i class="fas fa-comments"></i>
                    <p>No conversations</p>
                    <small>Start a new chat!</small>
                </div>
            `;
            return;
        }

        chatList.innerHTML = chats.map(chat => this.renderChatItem(chat)).join('');
    },

    renderChatItem(chat) {
        const initials = Utils.getInitials(chat.name);
        const time = Utils.formatTime(chat.lastMessageTime);
        const unreadBadge = chat.unread > 0 ? `<span class="unread-badge">${chat.unread}</span>` : '';
        const onlineDot = chat.online ? '<span class="status-dot"></span>' : '<span class="status-dot offline"></span>';

        return `
            <div class="chat-item" data-chat-id="${chat.id}" data-category="${chat.category}">
                <div class="avatar">
                    ${chat.avatar ? `<img src="${chat.avatar}" alt="${chat.name}">` : initials}
                    ${onlineDot}
                </div>
                <div class="chat-info">
                    <div class="chat-name">${Utils.escapeHtml(chat.name)}</div>
                    <div class="chat-last-msg">${Utils.escapeHtml(chat.lastMessage || '')}</div>
                </div>
                <div class="chat-meta">
                    <span class="chat-time">${time}</span>
                    ${unreadBadge}
                </div>
            </div>
        `;
    },

    filterChats(category) {
        const items = document.querySelectorAll('.chat-item');
        items.forEach(item => {
            if (category === 'all' || item.dataset.category === category) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    },

    openChat(chatId) {
        const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (!chatItem) return;

        const chatName = chatItem.querySelector('.chat-name').textContent;
        const chatAvatar = chatItem.querySelector('.avatar img')?.src || null;

        this.currentChat = {
            id: chatId,
            name: chatName,
            avatar: chatAvatar
        };

        this.updateChatHeader();
        this.loadMessages(chatId);
        this.markAsRead(chatId);

        document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
        chatItem.classList.add('active');

        const chatArea = document.getElementById('chat-area');
        if (window.innerWidth <= 768) {
            chatArea.classList.add('open');
        }
    },

    closeChat() {
        const chatArea = document.getElementById('chat-area');
        chatArea.classList.remove('open');
        this.currentChat = null;
    },

    updateChatHeader() {
        if (!this.currentChat) return;

        const header = document.querySelector('.chat-header');
        const nameEl = header?.querySelector('.chat-user-name');
        const avatarEl = header?.querySelector('.avatar');
        const statusEl = header?.querySelector('.chat-user-status');

        if (nameEl) nameEl.textContent = this.currentChat.name;
        if (avatarEl) {
            if (this.currentChat.avatar) {
                avatarEl.innerHTML = `<img src="${this.currentChat.avatar}" alt="${this.currentChat.name}">`;
            } else {
                avatarEl.textContent = Utils.getInitials(this.currentChat.name);
            }
        }
        if (statusEl) statusEl.textContent = 'Online';
    },

    loadMessages(chatId) {
        const mockMessages = this.generateMockMessages(chatId);
        this.renderMessages(chatId, mockMessages);
        this.scrollToBottom();
    },

    generateMockMessages(chatId) {
        const messages = [];
        const now = new Date();
        const count = Math.floor(Math.random() * 8) + 3;

        for (let i = 0; i < count; i++) {
            const isSent = Math.random() > 0.5;
            const time = new Date(now - (count - i) * 300000);
            messages.push({
                id: Utils.generateId(),
                chatId: chatId,
                sender: isSent ? 'me' : 'other',
                text: this.getRandomMessage(),
                timestamp: time.toISOString(),
                read: true
            });
        }

        return messages;
    },

    getRandomMessage() {
        const messages = [
            'Hello!',
            'How are you?',
            'That\'s great!',
            'See you later.',
            'Sounds good.',
            'Thanks!',
            'No problem.',
            'I\'ll be there.'
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    },

    renderMessages(chatId, messages) {
        const container = document.querySelector('.messages-container');
        if (!container) return;

        if (!messages || messages.length === 0) {
            container.innerHTML = `
                <div class="empty-chat">
                    <i class="fas fa-comment-dots"></i>
                    <h3>No messages yet</h3>
                    <p>Tap to start chatting</p>
                </div>
            `;
            return;
        }

        let html = '';
        let lastDate = '';

        messages.forEach(msg => {
            const date = new Date(msg.timestamp);
            const dateStr = date.toDateString();

            if (dateStr !== lastDate) {
                html += `
                    <div class="date-divider">
                        <span>${Utils.formatDate(msg.timestamp)}</span>
                    </div>
                `;
                lastDate = dateStr;
            }

            const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isSent = msg.sender === 'me';

            html += `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div class="message-text">${Utils.escapeHtml(msg.text)}</div>
                    <div class="message-time">
                        ${time}
                        ${isSent ? '<i class="fas fa-check"></i>' : ''}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        this.scrollToBottom();
    },

    sendMessage() {
        const input = document.getElementById('message-input');
        const text = input.value.trim();

        if (!text || !this.currentChat) return;

        const message = {
            id: Utils.generateId(),
            chatId: this.currentChat.id,
            sender: 'me',
            text: text,
            timestamp: new Date().toISOString(),
            read: false
        };

        this.addMessage(message);
        input.value = '';
        this.scrollToBottom();
        this.sendToServer(message);
    },

    addMessage(message) {
        const container = document.querySelector('.messages-container');
        if (!container) return;

        const emptyState = container.querySelector('.empty-chat');
        if (emptyState) {
            container.innerHTML = '';
        }

        const lastDivider = container.querySelector('.date-divider:last-child');
        const msgDate = new Date(message.timestamp);
        const today = new Date();
        const isToday = msgDate.toDateString() === today.toDateString();

        if (!lastDivider || !isToday) {
            const divider = document.createElement('div');
            divider.className = 'date-divider';
            divider.innerHTML = `<span>${Utils.formatDate(message.timestamp)}</span>`;
            container.appendChild(divider);
        }

        const isSent = message.sender === 'me';
        const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const msgEl = document.createElement('div');
        msgEl.className = `message ${isSent ? 'sent' : 'received'}`;
        msgEl.innerHTML = `
            <div class="message-text">${Utils.escapeHtml(message.text)}</div>
            <div class="message-time">
                ${time}
                ${isSent ? '<i class="fas fa-check"></i>' : ''}
            </div>
        `;

        container.appendChild(msgEl);
    },

    sendToServer(message) {
        console.log('Sending message:', message);

        setTimeout(() => {
            const msgElements = document.querySelectorAll('.message.sent');
            if (msgElements.length > 0) {
                const lastMsg = msgElements[msgElements.length - 1];
                const timeEl = lastMsg.querySelector('.message-time i');
                if (timeEl) {
                    timeEl.className = 'fas fa-check-double';
                }
            }
        }, 1000);
    },

    markAsRead(chatId) {
        console.log('Marking chat as read:', chatId);

        const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (chatItem) {
            const badge = chatItem.querySelector('.unread-badge');
            if (badge) badge.remove();
        }
    },

    handleTyping() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        if (!this.isTyping) {
            this.isTyping = true;
            this.showTypingIndicator();
        }

        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
            this.hideTypingIndicator();
        }, 2000);
    },

    showTypingIndicator() {
        const container = document.querySelector('.messages-container');
        if (!container) return;

        let indicator = container.querySelector('.typing-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'typing-indicator';
            indicator.innerHTML = `
                <span>Typing</span>
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
            `;
            container.appendChild(indicator);
        }
        indicator.classList.add('active');
        this.scrollToBottom();
    },

    hideTypingIndicator() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.classList.remove('active');
        }
    },

    scrollToBottom() {
        const container = document.querySelector('.messages-container');
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 50);
        }
    },

    setupMessageInput() {
        const input = document.getElementById('message-input');
        if (!input) return;
    },

    searchChats(query) {
        if (!query || query.length < 2) {
            document.querySelectorAll('.chat-item').forEach(el => el.style.display = '');
            return;
        }

        const items = document.querySelectorAll('.chat-item');
        let found = false;

        items.forEach(item => {
            const name = item.querySelector('.chat-name')?.textContent?.toLowerCase() || '';
            const matches = name.includes(query.toLowerCase());
            item.style.display = matches ? '' : 'none';
            if (matches) found = true;
        });

        const chatList = document.querySelector('.chat-list');
        const noResults = chatList?.querySelector('.no-search-results');

        if (!found) {
            if (!noResults) {
                const div = document.createElement('div');
                div.className = 'no-chats no-search-results';
                div.innerHTML = `
                    <i class="fas fa-search"></i>
                    <p>No results found</p>
                `;
                chatList?.appendChild(div);
            }
        } else if (noResults) {
            noResults.remove();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Chat.init();

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

window.Chat = Chat;
"""
    file_path = JS_DIR / 'chat.js'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_sidebar_js():
    """Create sidebar.js"""
    content = """// Sidebar module
const Sidebar = {
    isOpen: false,

    init() {
        this.setupEventListeners();
        this.handleResponsive();
    },

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('#sidebar-toggle');
            if (toggleBtn) {
                e.preventDefault();
                this.toggle();
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('.sidebar-backdrop')) {
                this.close();
            }
        });

        document.addEventListener('input', (e) => {
            if (e.target.id === 'search-chat') {
                const query = e.target.value;
                if (window.Chat) {
                    Chat.searchChats(query);
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        window.addEventListener('resize', () => {
            this.handleResponsive();
        });
    },

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    open() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.querySelector('.sidebar-backdrop');

        if (sidebar) {
            sidebar.classList.add('open');
        }
        if (backdrop) {
            backdrop.classList.add('show');
        }

        this.isOpen = true;
        document.body.style.overflow = 'hidden';
    },

    close() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.querySelector('.sidebar-backdrop');

        if (sidebar) {
            sidebar.classList.remove('open');
        }
        if (backdrop) {
            backdrop.classList.remove('show');
        }

        this.isOpen = false;
        document.body.style.overflow = '';
    },

    handleResponsive() {
        if (window.innerWidth > 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
            const backdrop = document.querySelector('.sidebar-backdrop');
            if (backdrop) {
                backdrop.classList.remove('show');
            }
            this.isOpen = false;
            document.body.style.overflow = '';
        }
    },

    setActiveChat(chatId) {
        document.querySelectorAll('.chat-item').forEach(el => {
            el.classList.toggle('active', el.dataset.chatId === chatId);
        });
    },

    updateUnreadCount(chatId, count) {
        const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (!chatItem) return;

        let badge = chatItem.querySelector('.unread-badge');
        if (count > 0) {
            if (!badge) {
                const meta = chatItem.querySelector('.chat-meta');
                badge = document.createElement('span');
                badge.className = 'unread-badge';
                meta.appendChild(badge);
            }
            badge.textContent = count;
        } else if (badge) {
            badge.remove();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Sidebar.init();
});

window.Sidebar = Sidebar;
"""
    file_path = JS_DIR / 'sidebar.js'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_modals_js():
    """Create modals.js"""
    content = """// Modal handlers
const ModalHandlers = {
    init() {
        this.setupModalTriggers();
        this.setupFormHandlers();
        this.setupProfileModal();
        this.setupPartnersModal();
        this.setupSettingsModal();
        this.setupWeddingPanel();
        this.setupStatusModal();
        this.setupConfirmModal();
        this.setupAlertModal();
        this.setupForwardModal();
        this.setupPhoneModal();
    },

    setupModalTriggers() {
        document.addEventListener('click', (e) => {
            const trigger = e.target.closest('[data-modal]');
            if (trigger) {
                const modalId = trigger.dataset.modal;
                ModalManager.open(modalId);
            }
        });
    },

    setupFormHandlers() {
        document.addEventListener('submit', (e) => {
            const form = e.target;

            if (form.id === 'profile-form') {
                e.preventDefault();
                this.handleProfileUpdate(form);
            }

            if (form.id === 'settings-form') {
                e.preventDefault();
                this.handleSettingsUpdate(form);
            }

            if (form.id === 'phone-form') {
                e.preventDefault();
                this.handlePhoneVerification(form);
            }
        });
    },

    setupProfileModal() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#profile-avatar-upload')) {
                document.getElementById('profile-avatar-input')?.click();
            }

            if (e.target.closest('#profile-avatar-input')) {
                this.handleAvatarUpload(e.target);
            }
        });
    },

    setupPartnersModal() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.partner-item')) {
                const partnerId = e.target.closest('.partner-item').dataset.partnerId;
                this.handlePartnerSelect(partnerId);
            }
        });
    },

    setupSettingsModal() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#logout-btn')) {
                e.preventDefault();
                if (window.Auth) {
                    Auth.logout();
                }
                ModalManager.close('settings-modal');
            }
        });
    },

    setupWeddingPanel() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#wedding-toggle')) {
                e.preventDefault();
                ModalManager.open('wedding-panel');
            }
        });
    },

    setupStatusModal() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#edit-status-btn')) {
                ModalManager.open('edit-status-modal');
            }
        });

        document.addEventListener('submit', (e) => {
            if (e.target.id === 'edit-status-form') {
                e.preventDefault();
                this.handleStatusUpdate(e.target);
            }
        });
    },

    setupConfirmModal() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#confirm-yes')) {
                const data = e.target.closest('#confirm-modal')?.dataset;
                if (data) {
                    document.dispatchEvent(new CustomEvent('confirm:yes', {
                        detail: { data }
                    }));
                }
                ModalManager.close('confirm-modal');
            }

            if (e.target.closest('#confirm-no')) {
                ModalManager.close('confirm-modal');
            }
        });
    },

    setupAlertModal() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#alert-ok')) {
                ModalManager.close('alert-modal');
            }
        });
    },

    setupForwardModal() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.forward-contact')) {
                const contactId = e.target.closest('.forward-contact').dataset.contactId;
                this.handleForward(contactId);
            }
        });
    },

    setupPhoneModal() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('#phone-verification-btn')) {
                ModalManager.open('phone-modal');
            }
        });
    },

    handleProfileUpdate(form) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        if (window.Auth) {
            Auth.updateProfile(data);
        }

        ModalManager.close('profile-modal');
    },

    handleSettingsUpdate(form) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        if (data.theme) {
            document.documentElement.setAttribute('data-theme', data.theme);
        }

        if (data.notifications === 'enabled') {
            if ('Notification' in window) {
                Notification.requestPermission();
            }
        }

        Toast.success('Settings updated successfully');
        ModalManager.close('settings-modal');
    },

    handleAvatarUpload(input) {
        const file = input.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            Toast.error('Please select an image file');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            Toast.error('Image size should be less than 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const avatarUrl = e.target.result;
            const avatarEl = document.getElementById('profile-avatar');
            if (avatarEl) {
                avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
            }

            if (window.Auth && window.Auth.currentUser) {
                window.Auth.updateProfile({ avatar: avatarUrl });
            }
        };
        reader.readAsDataURL(file);
    },

    handlePartnerSelect(partnerId) {
        Toast.success('Partner selected');
        ModalManager.close('partners-modal');
    },

    handleStatusUpdate(form) {
        const input = form.querySelector('input[type="text"]');
        const status = input?.value.trim();

        if (status) {
            Toast.success('Status updated: ' + status);
            ModalManager.close('edit-status-modal');
        }
    },

    handleForward(contactId) {
        Toast.success('Message forwarded');
        ModalManager.close('forward-modal');
    },

    handlePhoneVerification(form) {
        const phone = form.querySelector('input[type="tel"]')?.value;
        if (phone && phone.length >= 10) {
            Toast.info('Verification code sent to ' + phone);
            ModalManager.close('phone-modal');
        } else {
            Toast.error('Please enter a valid phone number');
        }
    },

    showAlert(message, title = 'Notice') {
        const modal = document.getElementById('alert-modal');
        const titleEl = modal?.querySelector('.modal-header h3');
        const messageEl = modal?.querySelector('.alert-message');

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;

        ModalManager.open('alert-modal');
    },

    showConfirm(message, title = 'Confirm', data = {}) {
        const modal = document.getElementById('confirm-modal');
        const titleEl = modal?.querySelector('.modal-header h3');
        const messageEl = modal?.querySelector('.confirm-message');

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;

        if (modal) {
            Object.keys(data).forEach(key => {
                modal.dataset[key] = data[key];
            });
        }

        ModalManager.open('confirm-modal');
        return new Promise((resolve) => {
            const handler = (e) => {
                resolve(e.detail.data);
                document.removeEventListener('confirm:yes', handler);
            };
            document.addEventListener('confirm:yes', handler);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ModalHandlers.init();
});

window.ModalHandlers = ModalHandlers;
"""
    file_path = JS_DIR / 'modals.js'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_status_js():
    """Create status.js"""
    content = """// Status module
const Status = {
    currentStatus: null,
    statusQueue: [],
    isPlaying: false,
    progressInterval: null,

    init() {
        this.setupEventListeners();
        this.loadStatuses();
    },

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const statusItem = e.target.closest('.status-item');
            if (statusItem) {
                const statusId = statusItem.dataset.statusId;
                this.viewStatus(statusId);
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('#status-viewer .close-btn')) {
                this.closeViewer();
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('.status-nav.prev')) {
                this.prevStatus();
            }
            if (e.target.closest('.status-nav.next')) {
                this.nextStatus();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (!this.isPlaying) return;

            if (e.key === 'ArrowLeft') {
                this.prevStatus();
            } else if (e.key === 'ArrowRight') {
                this.nextStatus();
            } else if (e.key === 'Escape') {
                this.closeViewer();
            }
        });
    },

    loadStatuses() {
        const mockStatuses = [
            {
                id: '1',
                userId: 'user1',
                userName: 'My Status',
                userAvatar: null,
                type: 'image',
                content: 'https://picsum.photos/400/700?random=1',
                timestamp: new Date(Date.now() - 1800000).toISOString(),
                viewed: false
            },
            {
                id: '2',
                userId: 'user2',
                userName: 'Alice',
                userAvatar: null,
                type: 'image',
                content: 'https://picsum.photos/400/700?random=2',
                timestamp: new Date(Date.now() - 7200000).toISOString(),
                viewed: false
            }
        ];

        this.renderStatuses(mockStatuses);
    },

    renderStatuses(statuses) {
        const statusList = document.querySelector('.status-list');
        if (!statusList) return;

        if (statuses.length === 0) {
            statusList.innerHTML = `
                <div class="no-statuses" style="padding: 8px 16px; color: var(--text-secondary); text-align: center; font-size: 13px;">
                    <p>No status updates</p>
                </div>
            `;
            return;
        }

        statusList.innerHTML = statuses.map(status => this.renderStatusItem(status)).join('');
    },

    renderStatusItem(status) {
        const initials = Utils.getInitials(status.userName);
        const time = Utils.formatTime(status.timestamp);
        const viewedClass = status.viewed ? 'viewed' : '';

        return `
            <div class="status-item" data-status-id="${status.id}">
                <div class="status-avatar ${viewedClass}">
                    ${status.userAvatar ? `<img src="${status.userAvatar}" alt="${status.userName}">` : initials}
                </div>
                <div class="status-info">
                    <div class="status-name">${Utils.escapeHtml(status.userName)}</div>
                    <div class="status-time">${time}</div>
                </div>
            </div>
        `;
    },

    viewStatus(statusId) {
        const statusItem = document.querySelector(`.status-item[data-status-id="${statusId}"]`);
        if (!statusItem) return;

        const userName = statusItem.querySelector('.status-name')?.textContent || '';
        const userAvatar = statusItem.querySelector('.status-avatar img')?.src || null;

        this.statusQueue = [
            {
                id: statusId,
                userName: userName,
                userAvatar: userAvatar,
                type: 'image',
                content: 'https://picsum.photos/400/700?random=' + Math.floor(Math.random() * 100),
                timestamp: new Date().toISOString()
            },
            {
                id: statusId + '-2',
                userName: userName,
                userAvatar: userAvatar,
                type: 'text',
                content: 'This is a status update!',
                timestamp: new Date(Date.now() - 300000).toISOString()
            }
        ];

        this.currentStatusIndex = 0;
        this.openViewer();
    },

    openViewer() {
        const viewer = document.getElementById('status-viewer');
        if (!viewer) return;

        viewer.classList.add('active');
        this.isPlaying = true;
        document.body.style.overflow = 'hidden';

        this.showCurrentStatus();
    },

    closeViewer() {
        const viewer = document.getElementById('status-viewer');
        if (!viewer) return;

        viewer.classList.remove('active');
        this.isPlaying = false;
        document.body.style.overflow = '';

        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    },

    showCurrentStatus() {
        if (!this.statusQueue || this.currentStatusIndex >= this.statusQueue.length) {
            this.closeViewer();
            return;
        }

        const status = this.statusQueue[this.currentStatusIndex];
        const viewer = document.getElementById('status-viewer');

        const userName = viewer.querySelector('.user-info .name');
        const userTime = viewer.querySelector('.user-info .time');
        const avatar = viewer.querySelector('.user-info .avatar');

        if (userName) userName.textContent = status.userName;
        if (userTime) userTime.textContent = Utils.formatTime(status.timestamp);
        if (avatar) {
            if (status.userAvatar) {
                avatar.innerHTML = `<img src="${status.userAvatar}" alt="${status.userName}">`;
            } else {
                avatar.textContent = Utils.getInitials(status.userName);
            }
        }

        const content = viewer.querySelector('.status-content');
        if (content) {
            if (status.type === 'image') {
                content.innerHTML = `<img src="${status.content}" alt="Status">`;
            } else if (status.type === 'video') {
                content.innerHTML = `<video src="${status.content}" autoplay></video>`;
            } else {
                content.innerHTML = `<div class="text-status">${Utils.escapeHtml(status.content)}</div>`;
            }
        }

        this.updateProgress();
        this.markAsViewed(status.id);
    },

    updateProgress() {
        const progressBars = document.querySelectorAll('.status-progress .progress-bar');
        progressBars.forEach(bar => {
            bar.classList.remove('active');
            const fill = bar.querySelector('.progress-fill');
            if (fill) {
                fill.style.width = '0%';
            }
        });

        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }

        const currentBar = document.querySelector('.status-progress .progress-bar:nth-child(' + (this.currentStatusIndex + 1) + ')');
        if (currentBar) {
            currentBar.classList.add('active');
        }

        const duration = 5000;
        let elapsed = 0;

        this.progressInterval = setInterval(() => {
            elapsed += 100;
            const progress = Math.min(elapsed / duration * 100, 100);

            const fill = currentBar?.querySelector('.progress-fill');
            if (fill) {
                fill.style.width = progress + '%';
            }

            if (progress >= 100) {
                this.nextStatus();
            }
        }, 100);
    },

    nextStatus() {
        if (this.currentStatusIndex < this.statusQueue.length - 1) {
            this.currentStatusIndex++;
            this.showCurrentStatus();
        } else {
            this.closeViewer();
        }
    },

    prevStatus() {
        if (this.currentStatusIndex > 0) {
            this.currentStatusIndex--;
            this.showCurrentStatus();
        }
    },

    markAsViewed(statusId) {
        console.log('Marking status as viewed:', statusId);

        const statusItem = document.querySelector(`.status-item[data-status-id="${statusId}"]`);
        if (statusItem) {
            const avatar = statusItem.querySelector('.status-avatar');
            if (avatar) {
                avatar.classList.add('viewed');
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Status.init();
});

window.Status = Status;
"""
    file_path = JS_DIR / 'status.js'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_app_js():
    """Create app.js"""
    content = """// Main application initializer
const App = {
    initialized: false,

    init() {
        if (this.initialized) return;

        console.log('Asterix App initialized');

        this.initModules();
        this.setupGlobalListeners();
        this.setupTheme();
        this.setupOfflineBanner();

        this.initialized = true;
        document.dispatchEvent(new CustomEvent('app:ready'));
    },

    initModules() {
        if (window.Auth) window.Auth.init();
        if (window.Chat) window.Chat.init();
        if (window.Sidebar) window.Sidebar.init();
        if (window.ModalHandlers) window.ModalHandlers.init();
        if (window.Status) window.Status.init();
        if (window.Toast) window.Toast.init();
    },

    setupGlobalListeners() {
        window.addEventListener('online', () => {
            Toast.success('Back online');
            this.updateOfflineBanner(false);
        });

        window.addEventListener('offline', () => {
            Toast.warning('You are offline');
            this.updateOfflineBanner(true);
        });

        window.addEventListener('error', (e) => {
            console.error('Unhandled error:', e.message);
            Toast.error('An unexpected error occurred');
        });

        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled rejection:', e.reason);
            Toast.error('An unexpected error occurred');
        });
    },

    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);

        document.addEventListener('theme:change', (e) => {
            this.setTheme(e.detail.theme);
        });
    },

    setTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#1a1a1a');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#128c7e');
        }
        localStorage.setItem('theme', theme);
    },

    setupOfflineBanner() {
        // Create offline banner if it doesn't exist
        let banner = document.querySelector('.offline-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.className = 'offline-banner';
            banner.innerHTML = 'You\'re offline – messages will send when reconnected.';
            document.body.appendChild(banner);
        }

        if (!navigator.onLine) {
            this.updateOfflineBanner(true);
        }
    },

    updateOfflineBanner(show) {
        const banner = document.querySelector('.offline-banner');
        if (banner) {
            banner.classList.toggle('show', show);
        }
    },

    isOnline() {
        return navigator.onLine;
    },

    getVersion() {
        return '1.0.0';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;
"""
    file_path = JS_DIR / 'app.js'
    file_path.write_text(content)
    print(f"Created: {file_path}")

# ==================== TEMPLATE FILES ====================

def create_base_html():
    """Create base.html - Matching Template"""
    content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Asterix - WhatsApp Web Alternative">
    <link rel="manifest" href="/static/manifest.json">
    <meta name="theme-color" content="#128c7e">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Asterix">
    <link rel="apple-touch-icon" href="/static/images/icon-192.png">
    <title>{% block title %}Asterix{% endblock %}</title>

    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">

    <!-- Modular CSS -->
    {% load static %}
    <link rel="stylesheet" href="{% static 'css/base.css' %}">
    <link rel="stylesheet" href="{% static 'css/sidebar.css' %}">
    <link rel="stylesheet" href="{% static 'css/chat.css' %}">
    <link rel="stylesheet" href="{% static 'css/modals.css' %}">
    <link rel="stylesheet" href="{% static 'css/status.css' %}">

    {% block extra_css %}{% endblock %}
</head>
<body>
    <!-- Content will be injected here -->
    {% block content %}{% endblock %}

    <!-- Modular JavaScript -->
    <script src="{% static 'js/utils.js' %}"></script>
    <script src="{% static 'js/auth.js' %}"></script>
    <script src="{% static 'js/chat.js' %}"></script>
    <script src="{% static 'js/sidebar.js' %}"></script>
    <script src="{% static 'js/modals.js' %}"></script>
    <script src="{% static 'js/status.js' %}"></script>
    <script src="{% static 'js/app.js' %}"></script>

    {% block extra_js %}{% endblock %}
</body>
</html>
"""
    file_path = TEMPLATES_DIR / 'base.html'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_index_html():
    """Create index.html - Matching Template"""
    content = """{% extends 'base.html' %}
{% load static %}

{% block content %}
<!-- Auth Wall -->
<div id="auth-wall" style="display:flex;">
    <div class="auth-container">
        <h2><i class="fas fa-comment-dots" style="color: var(--primary-color);"></i> Asterix</h2>
        <form id="login-form">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" placeholder="Enter your username" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" placeholder="Enter your password" required>
            </div>
            <button type="submit" class="btn btn-primary">Login</button>
        </form>
        <p style="text-align:center;margin-top:16px;font-size:13px;color:var(--text-secondary);">
            Demo: Use any username/password
        </p>
    </div>
</div>

<!-- App Shell -->
<div id="app-shell" style="display:none;">
    <!-- Sidebar -->
    {% include 'partials/_sidebar.html' %}

    <!-- Chat Area -->
    {% include 'partials/_chat_area.html' %}
</div>

<!-- Modals -->
{% include 'partials/modals/_profile_modal.html' %}
{% include 'partials/modals/_partners_modal.html' %}
{% include 'partials/modals/_confirm_modal.html' %}
{% include 'partials/modals/_alert_modal.html' %}
{% include 'partials/modals/_phone_modal.html' %}
{% include 'partials/modals/_forward_modal.html' %}
{% include 'partials/modals/_edit_status_modal.html' %}
{% include 'partials/modals/_settings_modal.html' %}
{% include 'partials/modals/_wedding_panel.html' %}

<!-- Status Viewer -->
{% include 'partials/_status_viewer.html' %}

<!-- Toasts & Overlays -->
{% include 'partials/_toasts_overlays.html' %}
{% endblock %}
"""
    file_path = TEMPLATES_DIR / 'index.html'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_partial_files():
    """Create partial HTML files - Matching Template"""

    # _sidebar.html - with navigation tabs
    content = """<!-- Sidebar -->
<div id="sidebar">
    <div class="sidebar-header">
        <div class="app-title">Asterix</div>
        <div class="header-actions">
            <button id="sidebar-toggle" aria-label="Close sidebar">
                <i class="fas fa-times"></i>
            </button>
        </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="nav-tabs">
        <button class="nav-item active" data-tab="all">
            <i class="fas fa-home"></i> All
        </button>
        <button class="nav-item" data-tab="general">
            <i class="fas fa-users"></i> General
        </button>
        <button class="nav-item" data-tab="funerals">
            <i class="fas fa-cross"></i> Funerals
        </button>
        <button class="nav-item" data-tab="weddings">
            <i class="fas fa-ring"></i> Weddings
        </button>
        <button class="nav-item" data-tab="market">
            <i class="fas fa-store"></i> Market
        </button>
        <button class="nav-item" data-tab="church">
            <i class="fas fa-church"></i> Church
        </button>
    </div>

    <!-- Search Bar -->
    <div class="search-bar">
        <div class="search-container">
            <i class="fas fa-search"></i>
            <input type="text" id="search-chat" placeholder="Search or start new chat">
        </div>
    </div>

    <!-- Status List -->
    <div class="status-list">
        <!-- Status items will be rendered here -->
    </div>

    <!-- Chat List -->
    <div class="chat-list">
        <!-- Chat items will be rendered here -->
    </div>
</div>
<div class="sidebar-backdrop"></div>
"""
    file_path = PARTIALS_DIR / '_sidebar.html'
    file_path.write_text(content)
    print(f"Created: {file_path}")

    # _chat_area.html
    content = """<!-- Chat Area -->
<div id="chat-area">
    <!-- Chat Header -->
    <div class="chat-header">
        <button class="back-btn" id="chat-back-btn">
            <i class="fas fa-arrow-left"></i>
        </button>
        <div class="avatar">?</div>
        <div class="chat-user-info">
            <div class="chat-user-name">Select a chat</div>
            <div class="chat-user-status">Tap to open chat</div>
        </div>
        <div class="chat-actions">
            <button title="Voice call"><i class="fas fa-phone"></i></button>
            <button title="Video call"><i class="fas fa-video"></i></button>
            <button title="More options"><i class="fas fa-ellipsis-v"></i></button>
        </div>
    </div>

    <!-- Messages Container -->
    <div class="messages-container">
        <div class="empty-chat">
            <i class="fas fa-comment-dots"></i>
            <h3>Select a conversation</h3>
            <p>Tap to open chat</p>
        </div>
    </div>

    <!-- Message Input -->
    <div class="message-input-container">
        <div class="input-actions">
            <button title="Emoji"><i class="fas fa-smile"></i></button>
            <button title="Attach"><i class="fas fa-paperclip"></i></button>
        </div>
        <input type="text" id="message-input" placeholder="Type a message" autocomplete="off">
        <button class="send-btn" id="send-message-btn" title="Send message">
            <i class="fas fa-paper-plane"></i>
        </button>
    </div>
</div>
"""
    file_path = PARTIALS_DIR / '_chat_area.html'
    file_path.write_text(content)
    print(f"Created: {file_path}")

    # _status_viewer.html
    content = """<!-- Status Viewer -->
<div id="status-viewer">
    <div class="status-viewer-header">
        <div class="user-info">
            <div class="avatar">?</div>
            <div>
                <div class="name">User</div>
                <div class="time">Just now</div>
            </div>
        </div>
        <button class="close-btn" title="Close">
            <i class="fas fa-times"></i>
        </button>
    </div>

    <div class="status-progress">
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
    </div>

    <div class="status-content">
        <!-- Status content will be rendered here -->
    </div>

    <div class="status-nav prev"></div>
    <div class="status-nav next"></div>
</div>
"""
    file_path = PARTIALS_DIR / '_status_viewer.html'
    file_path.write_text(content)
    print(f"Created: {file_path}")

    # _toasts_overlays.html
    content = """<!-- Toast Container -->
<div id="toast-container"></div>
"""
    file_path = PARTIALS_DIR / '_toasts_overlays.html'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_modal_files():
    """Create modal partial files - Matching Template"""

    modals = {
        '_profile_modal.html': """<!-- Profile Modal -->
<div id="profile-modal" class="modal-overlay">
    <div class="modal">
        <div class="modal-header">
            <h3>Profile</h3>
            <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <div class="profile-image-container">
                <div class="profile-avatar" id="profile-avatar">
                    ?
                    <div class="edit-overlay" id="profile-avatar-upload">
                        <i class="fas fa-camera"></i> Change
                    </div>
                </div>
                <input type="file" id="profile-avatar-input" accept="image/*" style="display:none">
            </div>
            <form id="profile-form">
                <div class="form-group">
                    <label for="profile-name">Name</label>
                    <input type="text" id="profile-name" name="name" required>
                </div>
                <div class="form-group">
                    <label for="profile-email">Email</label>
                    <input type="email" id="profile-email" name="email">
                </div>
                <div class="form-group">
                    <label for="profile-phone">Phone</label>
                    <input type="tel" id="profile-phone" name="phone">
                </div>
                <button type="submit" class="btn btn-primary">Update Profile</button>
            </form>
        </div>
    </div>
</div>""",

        '_partners_modal.html': """<!-- Partners Modal -->
<div id="partners-modal" class="modal-overlay">
    <div class="modal">
        <div class="modal-header">
            <h3>Partners</h3>
            <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <div class="partners-list">
                <div class="partner-item" data-partner-id="1">
                    <div class="partner-avatar">A</div>
                    <div class="partner-info">
                        <div class="partner-name">Alice Johnson</div>
                        <div class="partner-status">Online</div>
                    </div>
                    <i class="fas fa-check-circle partner-check"></i>
                </div>
                <div class="partner-item" data-partner-id="2">
                    <div class="partner-avatar">B</div>
                    <div class="partner-info">
                        <div class="partner-name">Bob Smith</div>
                        <div class="partner-status">Offline</div>
                    </div>
                    <i class="fas fa-check-circle partner-check" style="opacity:0.3"></i>
                </div>
            </div>
        </div>
    </div>
</div>""",

        '_confirm_modal.html': """<!-- Confirm Modal -->
<div id="confirm-modal" class="modal-overlay confirm-modal">
    <div class="modal">
        <div class="modal-header">
            <h3>Confirm</h3>
            <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <div class="confirm-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="confirm-message">Are you sure you want to proceed?</div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" id="confirm-no">Cancel</button>
            <button class="btn btn-primary" id="confirm-yes">Confirm</button>
        </div>
    </div>
</div>""",

        '_alert_modal.html': """<!-- Alert Modal -->
<div id="alert-modal" class="modal-overlay">
    <div class="modal">
        <div class="modal-header">
            <h3>Notice</h3>
            <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <p class="alert-message">This is an alert message.</p>
        </div>
        <div class="modal-footer">
            <button class="btn btn-primary" id="alert-ok">OK</button>
        </div>
    </div>
</div>""",

        '_phone_modal.html': """<!-- Phone Modal -->
<div id="phone-modal" class="modal-overlay">
    <div class="modal">
        <div class="modal-header">
            <h3>Phone Verification</h3>
            <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <form id="phone-form">
                <div class="form-group">
                    <label for="phone-input">Phone Number</label>
                    <input type="tel" id="phone-input" name="phone" placeholder="+1 234 567 8900" required>
                </div>
                <button type="submit" class="btn btn-primary">Verify</button>
            </form>
        </div>
    </div>
</div>""",

        '_forward_modal.html': """<!-- Forward Modal -->
<div id="forward-modal" class="modal-overlay">
    <div class="modal">
        <div class="modal-header">
            <h3>Forward Message</h3>
            <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <div class="partners-list">
                <div class="partner-item forward-contact" data-contact-id="1">
                    <div class="partner-avatar">A</div>
                    <div class="partner-info">
                        <div class="partner-name">Alice Johnson</div>
                    </div>
                </div>
                <div class="partner-item forward-contact" data-contact-id="2">
                    <div class="partner-avatar">B</div>
                    <div class="partner-info">
                        <div class="partner-name">Bob Smith</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>""",

        '_edit_status_modal.html': """<!-- Edit Status Modal -->
<div id="edit-status-modal" class="modal-overlay">
    <div class="modal">
        <div class="modal-header">
            <h3>Edit Status</h3>
            <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <form id="edit-status-form">
                <div class="form-group">
                    <label for="status-input">Your Status</label>
                    <input type="text" id="status-input" name="status" placeholder="What's on your mind?" required>
                </div>
                <button type="submit" class="btn btn-primary">Update Status</button>
            </form>
        </div>
    </div>
</div>""",

        '_settings_modal.html': """<!-- Settings Modal -->
<div id="settings-modal" class="modal-overlay">
    <div class="modal">
        <div class="modal-header">
            <h3>Settings</h3>
            <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <form id="settings-form">
                <div class="form-group">
                    <label for="theme-select">Theme</label>
                    <select id="theme-select" name="theme">
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="notifications">Notifications</label>
                    <select id="notifications" name="notifications">
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Save Settings</button>
            </form>
            <hr style="margin: 20px 0; border-color: var(--border-color);">
            <button class="btn btn-danger" id="logout-btn">Logout</button>
        </div>
    </div>
</div>""",

        '_wedding_panel.html': """<!-- Wedding Panel -->
<div id="wedding-panel" class="modal-overlay">
    <div class="modal">
        <div class="modal-header">
            <h3>Wedding Planning</h3>
            <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <p>Wedding planning features coming soon!</p>
            <div style="margin-top: 16px; display:flex; gap:12px;">
                <button class="btn btn-primary">Create Event</button>
                <button class="btn btn-secondary">Guest List</button>
            </div>
        </div>
    </div>
</div>"""
    }

    for filename, content in modals.items():
        file_path = MODALS_DIR / filename
        file_path.write_text(content)
        print(f"Created: {file_path}")

def create_manifest():
    """Create manifest.json"""
    content = json.dumps({
        "name": "Asterix",
        "short_name": "Asterix",
        "description": "Asterix - WhatsApp Web Alternative",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#128c7e",
        "theme_color": "#128c7e",
        "icons": [
            {
                "src": "/static/images/icon-192.png",
                "sizes": "192x192",
                "type": "image/png"
            },
            {
                "src": "/static/images/icon-512.png",
                "sizes": "512x512",
                "type": "image/png"
            }
        ]
    }, indent=2)
    file_path = STATIC_DIR / 'manifest.json'
    file_path.write_text(content)
    print(f"Created: {file_path}")

def create_placeholder_images():
    """Create placeholder image files"""
    file_path = IMAGES_DIR / 'icon-192.png'
    file_path.write_text("Placeholder: Replace with actual icon-192.png")
    print(f"Created: {file_path} (placeholder)")

    file_path = IMAGES_DIR / 'icon-512.png'
    file_path.write_text("Placeholder: Replace with actual icon-512.png")
    print(f"Created: {file_path} (placeholder)")

def main():
    """Main function to generate all files"""
    print("\n" + "="*60)
    print("Asterix Modular File Generator")
    print("Based on Template Design")
    print("="*60 + "\n")

    create_directories()
    print()

    create_base_css()
    create_sidebar_css()
    create_chat_css()
    create_modals_css()
    create_status_css()
    print()

    create_utils_js()
    create_auth_js()
    create_chat_js()
    create_sidebar_js()
    create_modals_js()
    create_status_js()
    create_app_js()
    print()

    create_base_html()
    create_index_html()
    create_partial_files()
    create_modal_files()
    print()

    create_manifest()
    create_placeholder_images()
    print()

    print("="*60)
    print("✅ All files created successfully!")
    print(f"📁 Files generated in: {BASE_DIR.absolute()}")
    print("="*60)

if __name__ == "__main__":
    main()