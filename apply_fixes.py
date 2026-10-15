#!/usr/bin/env python3
"""
apply_fixes.py — Fizzme chat fixes with AUTO-DISCOVERY.

Walks the project directory (from where you run it) and finds each target
file by name, no matter where it lives. Then applies the same surgical
patches as before.

Usage:
    python3 apply_fixes.py              # run from project root
    python3 apply_fixes.py /path/to/root
"""

import os
import re
import shutil
import sys
import time

TS = time.strftime('%Y%m%d_%H%M%S')


# ──────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────

def _banner(msg):
    print()
    print('═' * 78)
    print('  ' + msg)
    print('═' * 78)


def _info(msg):  print('  • ' + msg)
def _warn(msg):  print('  ⚠️  ' + msg)
def _ok(msg):    print('  ✅ ' + msg)


def _read(path):
    if not os.path.isfile(path):
        _warn(f'File not found: {path} — skipped')
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def _write(path, content):
    backup = f'{path}.bak.{TS}'
    shutil.copy2(path, backup)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    _ok(f'{path}  (backup: {backup})')


def _replace_once(content, pattern, replacement, label):
    # Handle both string patterns and pre-compiled regex objects.
    if hasattr(pattern, 'finditer'):
        matches = list(pattern.finditer(content))
    else:
        matches = list(re.finditer(pattern, content, re.DOTALL))

    if len(matches) == 0:
        _warn(f'No match for: {label}')
        return content, False
    if len(matches) > 1:
        _warn(f'Multiple matches ({len(matches)}) for: {label} — patching first only')
        m = matches[0]
        return content[:m.start()] + replacement + content[m.end():], True
    m = matches[0]
    return content[:m.start()] + replacement + content[m.end():], True


# ──────────────────────────────────────────────────────────────────────────
# File discovery — walk the project, skip common noise dirs
# ──────────────────────────────────────────────────────────────────────────

SKIP_DIRS = {
    '.git', '.hg', '.svn', '__pycache__', 'node_modules',
    '.venv', 'venv', 'env', '.env', '.idea', '.vscode',
    'migrations', 'dist', 'build', '.next', '.cache',
    'media', 'staticfiles', 'site-packages',
}


def find_file(target_name, root='.'):
    """Return the first path (relative) matching target_name."""
    matches = []
    for dirpath, dirnames, filenames in os.walk(root):
        # prune skip dirs
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        if target_name in filenames:
            matches.append(os.path.join(dirpath, target_name))

    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]

    # Prefer paths that look like JS/CSS/etc.
    # Pick the shallowest match by default.
    matches.sort(key=lambda p: (p.count(os.sep), len(p)))
    _info(f'Multiple matches for {target_name}:')
    for m in matches:
        _info(f'   → {m}')
    _info(f'Using: {matches[0]}')
    return matches[0]


# ──────────────────────────────────────────────────────────────────────────
# FIX 1 — chat.js : remove cache-first render (kills FOU)
# ──────────────────────────────────────────────────────────────────────────

def patch_chat_js_fou(path):
    _banner('FIX 1 — chat.js : remove cache-first render (FOU)')

    content = _read(path)
    if content is None:
        return

    # Locate the `} else if (window.Sync) { ... }` block inside loadMessages()
    # NOTE: no leading `}` — the anchor is the `else if (window.Sync) {` block.
    pattern = (
        r"else if \(window\.Sync\) \{\s*"
        r"Sync\.getMessages\(recipient, INITIAL_LIMIT\)\.then\(function\(localMsgs\) \{.*?"
        r"fetchContactInfo\(recipient\)\.then\(function\(info\) \{ if \(info\) updateOnlineStatus\(recipient, info\); \}\);\s*"
        r"\}\s*\);\s*\}"
    )

    content, ok = _replace_once(
        content, pattern, "",
        'chat.js cache-first render block'
    )
    if ok:
        _ok('Removed cache-first render block.')

    # Add .syncing class toggle
    old = "    loadingRecipients.add(recipient);\n    isLoading = true;"
    new = "    loadingRecipients.add(recipient);\n    isLoading = true;\n    try { chatContainer.classList.add('syncing'); } catch (e) {}"
    if old in content:
        content = content.replace(old, new, 1)
        _ok("Added chatContainer.classList.add('syncing').")
    else:
        _warn("Could not add 'syncing' class toggle.")

    old_f = ".finally(function() { loadingRecipients.delete(recipient); });"
    new_f = (".finally(function() { loadingRecipients.delete(recipient); "
             "try { chatContainer.classList.remove('syncing'); } catch (e) {} });")
    if old_f in content:
        content = content.replace(old_f, new_f, 1)
        _ok("Removed 'syncing' class in finally().")
    else:
        _warn("Could not remove 'syncing' class in finally().")

    _write(path, content)


# ──────────────────────────────────────────────────────────────────────────
# FIX 4c — chat.js : track _latest_reply_media per listing
# ──────────────────────────────────────────────────────────────────────────

def patch_chat_js_reply_media(path):
    _banner('FIX 4c — chat.js : track freshest reply_media per listing')

    content = _read(path)
    if content is None:
        return

    old = (
        "    var msgs = window._currentMessages || [];\n"
        "    var statusMap = {};\n"
        "    msgs.forEach(function(msg) {\n"
        "      if (msg.related_status && msg.related_status.is_commercial) {\n"
        "        statusMap[msg.related_status.status_id] = msg.related_status;\n"
        "      }\n"
        "    });"
    )

    new = (
        "    var msgs = window._currentMessages || [];\n"
        "    var statusMap = {};\n"
        "    msgs.forEach(function(msg) {\n"
        "      if (msg.related_status && msg.related_status.is_commercial) {\n"
        "        var key = msg.related_status.status_id;\n"
        "        statusMap[key] = msg.related_status;\n"
        "        if (msg.reply_media && (\n"
        "              msg.message_type === 'offer' ||\n"
        "              msg.message_type === 'deal_confirmation' ||\n"
        "              msg.message_type === 'status_update')) {\n"
        "          statusMap[key]._latest_reply_media = msg.reply_media;\n"
        "        }\n"
        "      }\n"
        "    });"
    )

    if old in content:
        content = content.replace(old, new, 1)
        _ok('Enriched statusMap entries with _latest_reply_media.')
    else:
        _warn('Could not locate statusMap builder — trying looser match.')
        # Looser fallback
        loose = re.compile(
            r"(var statusMap = \{\};\s*msgs\.forEach\(function\(msg\) \{\s*"
            r"if \(msg\.related_status && msg\.related_status\.is_commercial\) \{\s*"
            r")statusMap\[msg\.related_status\.status_id\] = msg\.related_status;",
            re.DOTALL
        )
        m = loose.search(content)
        if m:
            insertion = (
                "var key = msg.related_status.status_id;\n"
                "        statusMap[key] = msg.related_status;\n"
                "        if (msg.reply_media && (\n"
                "              msg.message_type === 'offer' ||\n"
                "              msg.message_type === 'deal_confirmation' ||\n"
                "              msg.message_type === 'status_update')) {\n"
                "          statusMap[key]._latest_reply_media = msg.reply_media;\n"
                "        }"
            )
            content = content[:m.start()] + m.group(1) + insertion + content[m.end():]
            _ok('Enriched via loose match.')
        else:
            _warn('Looser match failed too — manual patch may be needed.')

    _write(path, content)


# ──────────────────────────────────────────────────────────────────────────
# FIX 4d — chat.js : Buy Now forwards buyer-selected photo
# ──────────────────────────────────────────────────────────────────────────

def patch_chat_js_buy_now(path):
    _banner('FIX 4d — chat.js : Buy Now forwards buyer-selected photo')

    content = _read(path)
    if content is None:
        return

    pattern = re.compile(
        r"strip\.appendChild\(_mkBannerBtn\('🛒 Buy', 'banner-btn-buy', function\(\) \{\s*"
        r"if \(window\.Asterix && window\.Asterix\.checkout\) \{\s*"
        r"window\.Asterix\.checkout\.open\(rs, null, function\(\) \{ refreshThread\(\); \}\);\s*"
        r"\}\s*else \{\s*"
        r"toast\('Error', 'Checkout module not available — make sure checkout\.js is loaded before chat\.js\.'\);\s*"
        r"\}\s*"
        r"\}\)\);",
        re.DOTALL
    )

    replacement = (
        "strip.appendChild(_mkBannerBtn('🛒 Buy', 'banner-btn-buy', function() {\n"
        "            if (window.Asterix && window.Asterix.checkout) {\n"
        "              var sel = (rs._latest_reply_media && { url: rs._latest_reply_media }) || null;\n"
        "              window.Asterix.checkout.open(rs, sel, function() { refreshThread(); });\n"
        "            } else {\n"
        "              toast('Error', 'Checkout module not available — make sure checkout.js is loaded before chat.js.');\n"
        "            }\n"
        "          }));"
    )

    content, ok = _replace_once(content, pattern, replacement, 'Buy Now button')
    if not ok:
        _warn('Buy Now button pattern not matched — continuing.')
    else:
        _ok('Buy Now button now forwards the buyer-selected photo.')

    _write(path, content)


# ──────────────────────────────────────────────────────────────────────────
# FIX 3 — negotiate.js : render buyer note + original message
# ──────────────────────────────────────────────────────────────────────────

def patch_negotiate_js_note(path):
    _banner('FIX 3 — negotiate.js : render buyer note + original message')

    content = _read(path)
    if content is None:
        return

    # ── Offer card: insert msg.message block right after offer.note block ──
    old_offer = (
        "    if (offer.note) {\n"
        "      var noteEl = document.createElement('div'); noteEl.className = 'fz-txn-note';\n"
        "      noteEl.textContent = '\\u201C' + offer.note + '\\u201D';\n"
        "      body.appendChild(noteEl);\n"
        "    }\n"
        "    card.appendChild(body);"
    )

    new_offer = (
        "    if (offer.note) {\n"
        "      var noteEl = document.createElement('div'); noteEl.className = 'fz-txn-note';\n"
        "      noteEl.textContent = '\\u201C' + offer.note + '\\u201D';\n"
        "      body.appendChild(noteEl);\n"
        "    }\n"
        "\n"
        "    // FIX 3: show the buyer's original reply / bargain text\n"
        "    var rawMsg = (msg.message || '').trim();\n"
        "    if (rawMsg &&\n"
        "        rawMsg.indexOf('Offer:') !== 0 &&\n"
        "        rawMsg.indexOf('Counter offer:') !== 0 &&\n"
        "        rawMsg.indexOf('Deal agreed') !== 0) {\n"
        "      var msgTextEl = document.createElement('div');\n"
        "      msgTextEl.className = 'fz-txn-message';\n"
        "      msgTextEl.textContent = rawMsg;\n"
        "      body.appendChild(msgTextEl);\n"
        "    }\n"
        "    card.appendChild(body);"
    )

    content, ok = _replace_once(content, re.escape(old_offer), new_offer,
                                'offer card note+msg block')
    if ok:
        _ok('Offer card renders msg.message under offer.note.')

    # ── Deal card ──────────────────────────────────────────────────────
    old_deal = (
        "    _addMeta(meta, 'Seller confirmed', (deal.seller_confirmed ? '✅' : '⏳') + ' ' + (deal.seller_confirmed ? 'Yes' : 'Pending'));\n"
        "    body.appendChild(meta);\n"
        "    card.appendChild(body);"
    )

    new_deal = (
        "    _addMeta(meta, 'Seller confirmed', (deal.seller_confirmed ? '✅' : '⏳') + ' ' + (deal.seller_confirmed ? 'Yes' : 'Pending'));\n"
        "    body.appendChild(meta);\n"
        "\n"
        "    // FIX 3: show the original enquiry text\n"
        "    var rawDealMsg = (msg.message || '').trim();\n"
        "    if (rawDealMsg &&\n"
        "        rawDealMsg.indexOf('Deal agreed') !== 0 &&\n"
        "        rawDealMsg.indexOf('Payment confirmed') !== 0 &&\n"
        "        rawDealMsg.indexOf('Both parties confirmed') !== 0 &&\n"
        "        rawDealMsg.indexOf('Purchase request') !== 0) {\n"
        "      var dealMsgEl = document.createElement('div');\n"
        "      dealMsgEl.className = 'fz-txn-message';\n"
        "      dealMsgEl.textContent = rawDealMsg;\n"
        "      body.appendChild(dealMsgEl);\n"
        "    }\n"
        "    card.appendChild(body);"
    )

    content, ok2 = _replace_once(content, re.escape(old_deal), new_deal,
                                 'deal card msg block')
    if ok2:
        _ok('Deal card renders msg.message.')

    # ── CSS: add .fz-txn-message ──────────────────────────────────────
    css_anchor = "'.fz-txn-note{font-size:11px;color:rgba(255,255,255,.5);font-style:italic;margin-bottom:8px;padding:6px 8px;background:rgba(255,255,255,.03);border-left:2px solid rgba(230,168,23,.3);border-radius:0 6px 6px 0;}',"
    css_add = (
        css_anchor + "\n"
        "      '.fz-txn-message{font-size:12px;color:rgba(255,255,255,.75);line-height:1.5;margin-bottom:8px;padding:8px 10px;"
        "background:rgba(255,255,255,.03);border-radius:0 8px 8px 0;border-left:3px solid rgba(37,211,102,.7);"
        "white-space:pre-wrap;word-break:break-word;}',"
    )
    if css_anchor in content:
        content = content.replace(css_anchor, css_add, 1)
        _ok('Added .fz-txn-message CSS to injected stylesheet.')
    else:
        _warn('Could not add .fz-txn-message CSS — continuing.')

    _write(path, content)


# ──────────────────────────────────────────────────────────────────────────
# FIX 2 — negotiate.js : strict buyer-only checkout
# ──────────────────────────────────────────────────────────────────────────

def patch_negotiate_js_buyer_only(path):
    _banner('FIX 2 — negotiate.js : strict buyer-only checkout')

    content = _read(path)
    if content is None:
        return

    # ── _routeBuyerToCheckout ────────────────────────────────────────
    old_route = (
        "  function _routeBuyerToCheckout(res, sellerUsername) {\n"
        "    if (!res || !res.deal_id) return;\n"
        "    if (!(window.Asterix && window.Asterix.checkout)) return;\n"
        "    var myName     = me();\n"
        "    var sellerName = sellerUsername || '';\n"
        "    if (!sellerName || myName === sellerName) return;   // seller skips\n"
        "    setTimeout(function () {"
    )

    new_route = (
        "  function _routeBuyerToCheckout(res, sellerUsername) {\n"
        "    if (!res || !res.deal_id) return;\n"
        "    if (!(window.Asterix && window.Asterix.checkout)) return;\n"
        "    var myName     = me();\n"
        "    var sellerName = sellerUsername || '';\n"
        "    if (!myName) return;\n"
        "    if (!sellerName || myName === sellerName) return;\n"
        "    if (res.deal && res.deal.buyer && myName !== res.deal.buyer) return;\n"
        "    setTimeout(function () {"
    )

    content, ok1 = _replace_once(content, re.escape(old_route), new_route, '_routeBuyerToCheckout')
    if ok1:
        _ok('_routeBuyerToCheckout now strictly buyer-only.')

    # ── _maybeAutoCheckout ───────────────────────────────────────────
    old_auto = (
        "  function _maybeAutoCheckout(deal, sellerUsername) {\n"
        "    if (!deal || !deal.id) return;\n"
        "    if (_autoCheckoutFired.has(deal.id)) return;\n"
        "    if (!(window.Asterix && window.Asterix.checkout)) return;\n"
        "\n"
        "    var myName = me();\n"
        "    if (!sellerUsername || myName === sellerUsername) return;  // seller skips\n"
        "    if (deal.buyer_confirmed) return;\n"
        "\n"
        "    _autoCheckoutFired.add(deal.id);"
    )

    new_auto = (
        "  function _maybeAutoCheckout(deal, sellerUsername) {\n"
        "    if (!deal || !deal.id) return;\n"
        "    if (_autoCheckoutFired.has(deal.id)) return;\n"
        "    if (!(window.Asterix && window.Asterix.checkout)) return;\n"
        "\n"
        "    var myName        = me();\n"
        "    var buyerUsername = _displayName(deal.buyer);\n"
        "    if (!buyerUsername || myName !== buyerUsername) return;\n"
        "    if (!sellerUsername || myName === sellerUsername) return;\n"
        "    if (deal.buyer_confirmed) return;\n"
        "\n"
        "    _autoCheckoutFired.add(deal.id);"
    )

    content, ok2 = _replace_once(content, re.escape(old_auto), new_auto, '_maybeAutoCheckout')
    if ok2:
        _ok('_maybeAutoCheckout now strictly buyer-only.')

    # ── takeListing signature ────────────────────────────────────────
    old_take = (
        "    takeListing: function (statusId, paymentMethod, deliveryAddress, instructions) {\n"
        "      return _apiPost('/api/deals/take/', {\n"
        "        status_id:             statusId,\n"
        "        payment_method:        paymentMethod    || '',\n"
        "        delivery_address:      deliveryAddress  || '',\n"
        "        delivery_instructions: instructions     || '',\n"
        "      });\n"
        "    },"
    )

    new_take = (
        "    takeListing: function (statusId, paymentMethod, deliveryAddress, instructions, selectedMediaUrl) {\n"
        "      return _apiPost('/api/deals/take/', {\n"
        "        status_id:             statusId,\n"
        "        payment_method:        paymentMethod    || '',\n"
        "        delivery_address:      deliveryAddress  || '',\n"
        "        delivery_instructions: instructions     || '',\n"
        "        selected_media_url:    selectedMediaUrl || '',\n"
        "      });\n"
        "    },"
    )

    content, ok3 = _replace_once(content, re.escape(old_take), new_take, 'takeListing signature')
    if ok3:
        _ok('takeListing now accepts + forwards selectedMediaUrl.')

    _write(path, content)


# ──────────────────────────────────────────────────────────────────────────
# FIX 4b — cart.js : prefer buyer-selected photo
# ──────────────────────────────────────────────────────────────────────────

def patch_cart_js(path):
    _banner('FIX 4b — cart.js : prefer buyer-selected photo')

    content = _read(path)
    if content is None:
        return

    # ── Thumbnail in the cart modal ──────────────────────────────────
    old_thumb = (
        "      var price = 'K' + parseFloat(item.price).toLocaleString('en-ZM', { minimumFractionDigits: 2 });\n"
        "      var thumbHtml = item.media_url\n"
        "        ? '<img src=\"' + item.media_url + '\" style=\"width:44px;height:44px;object-fit:cover;border-radius:6px;\">'\n"
        "        : '<div style=\"width:44px;height:44px;background:var(--mid);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px;\">🏷️</div>';"
    )

    new_thumb = (
        "      var price = 'K' + parseFloat(item.price).toLocaleString('en-ZM', { minimumFractionDigits: 2 });\n"
        "      var thumbUrl = (item.selectedMedia && item.selectedMedia.url)\n"
        "                   || item._latest_reply_media\n"
        "                   || item.media_url\n"
        "                   || '';\n"
        "      var thumbHtml = thumbUrl\n"
        "        ? '<img src=\"' + thumbUrl + '\" style=\"width:44px;height:44px;object-fit:cover;border-radius:6px;\">'\n"
        "        : '<div style=\"width:44px;height:44px;background:var(--mid);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px;\">🏷️</div>';"
    )

    content, ok1 = _replace_once(content, re.escape(old_thumb), new_thumb, 'cart thumbnail')
    if ok1:
        _ok('Cart thumbnail prefers selectedMedia/_latest_reply_media.')

    # ── Persist _latest_reply_media ──────────────────────────────────
    old_push = (
        "    cartItems.push({\n"
        "      status_id: status.status_id,\n"
        "      username:  status.username,\n"
        "      caption:   status.caption   || 'Listing',\n"
        "      price:     parseFloat(status.price) || 0,\n"
        "      media_url: status.media_url || '',\n"
        "      selectedMedia: status.selectedMedia || null,\n"
        "    });"
    )

    new_push = (
        "    cartItems.push({\n"
        "      status_id: status.status_id,\n"
        "      username:  status.username,\n"
        "      caption:   status.caption   || 'Listing',\n"
        "      price:     parseFloat(status.price) || 0,\n"
        "      media_url: status.media_url || '',\n"
        "      selectedMedia: status.selectedMedia || null,\n"
        "      _latest_reply_media: status._latest_reply_media || '',\n"
        "    });"
    )

    content, ok2 = _replace_once(content, re.escape(old_push), new_push, 'cartItems.push()')
    if ok2:
        _ok('cart.addItem() persists _latest_reply_media.')

    _write(path, content)


# ──────────────────────────────────────────────────────────────────────────
# FIX 4d — checkout.js : pass selectedMedia.url to takeListing
# ──────────────────────────────────────────────────────────────────────────

def patch_checkout_js(path):
    _banner('FIX 4d — checkout.js : pass selectedMedia.url to takeListing')

    content = _read(path)
    if content is None:
        return

    old = "    window.Asterix.deals.takeListing(_state.status.status_id, method, deliveryString, fullNote)\n"
    new = (
        "    window.Asterix.deals.takeListing(\n"
        "      _state.status.status_id,\n"
        "      method,\n"
        "      deliveryString,\n"
        "      fullNote,\n"
        "      (_state.selectedMedia && _state.selectedMedia.url) || ''\n"
        "    )\n"
    )

    content, ok = _replace_once(content, re.escape(old), new, 'checkout takeListing call')
    if ok:
        _ok('checkout.js forwards the buyer-selected photo URL to takeListing.')
    else:
        _warn('Could not patch checkout takeListing.')

    _write(path, content)


# ──────────────────────────────────────────────────────────────────────────
# FIX 4a — views_negotiate.py : _send_message carries reply_media
# ──────────────────────────────────────────────────────────────────────────

def patch_views_negotiate(path):
    _banner('FIX 4a — views_negotiate.py : _send_message carries reply_media')

    content = _read(path)
    if content is None:
        return

    # _send_message signature + body
    old_send = (
        "def _send_message(sender_user, recipient_user, text, message_type,\n"
        "                  status_obj, offer=None, deal=None):\n"
        "    \"\"\"\n"
        "    Create one Message row with proper FK assignments.\n"
        "    After saving, fire a push notification to the recipient so their\n"
        "    browser/app wakes up without waiting for the poll cycle.\n"
        "    \"\"\"\n"
        "    msg = Message(\n"
        "        sender=sender_user,\n"
        "        recipient=recipient_user,\n"
        "        message=text,\n"
        "        message_type=message_type,\n"
        "        related_status=status_obj,\n"
        "    )\n"
        "    if offer is not None:\n"
        "        msg.offer = offer\n"
        "    if deal is not None:\n"
        "        msg.deal = deal\n"
        "    msg.save()"
    )

    new_send = (
        "def _send_message(sender_user, recipient_user, text, message_type,\n"
        "                  status_obj, offer=None, deal=None, reply_media=''):\n"
        "    \"\"\"\n"
        "    Create one Message row with proper FK assignments.\n"
        "    `reply_media` carries the buyer-selected photo URL so the offer/deal\n"
        "    card can render the exact photo the buyer tapped in the market grid.\n"
        "    \"\"\"\n"
        "    msg = Message(\n"
        "        sender=sender_user,\n"
        "        recipient=recipient_user,\n"
        "        message=text,\n"
        "        message_type=message_type,\n"
        "        related_status=status_obj,\n"
        "        reply_media=reply_media or '',\n"
        "    )\n"
        "    if offer is not None:\n"
        "        msg.offer = offer\n"
        "    if deal is not None:\n"
        "        msg.deal = deal\n"
        "    msg.save()"
    )

    content, ok1 = _replace_once(content, re.escape(old_send), new_send, '_send_message')
    if ok1:
        _ok('_send_message now accepts + stores reply_media.')

    # create_offer call site
    old_create = (
        "    msg  = _send_message(\n"
        "        sender_user=request.user,\n"
        "        recipient_user=status_obj.user,\n"
        "        text=text,\n"
        "        message_type='offer',\n"
        "        status_obj=status_obj,\n"
        "        offer=offer,\n"
        "    )\n"
        "    return _msg_response(msg, {'offer_id': offer.pk})"
    )

    new_create = (
        "    msg  = _send_message(\n"
        "        sender_user=request.user,\n"
        "        recipient_user=status_obj.user,\n"
        "        text=text,\n"
        "        message_type='offer',\n"
        "        status_obj=status_obj,\n"
        "        offer=offer,\n"
        "        reply_media=selected_media_url,\n"
        "    )\n"
        "    return _msg_response(msg, {'offer_id': offer.pk})"
    )

    content, ok2 = _replace_once(content, re.escape(old_create), new_create, 'create_offer call')
    if ok2:
        _ok('create_offer forwards selected_media_url → reply_media.')

    # counter branch
    old_counter = (
        "        msg  = _send_message(\n"
        "            sender_user=request.user, recipient_user=other,\n"
        "            text=text, message_type='offer',\n"
        "            status_obj=status_obj, offer=new_offer,\n"
        "        )\n"
        "        return _msg_response(msg, {'offer_id': new_offer.pk})"
    )

    new_counter = (
        "        msg  = _send_message(\n"
        "            sender_user=request.user, recipient_user=other,\n"
        "            text=text, message_type='offer',\n"
        "            status_obj=status_obj, offer=new_offer,\n"
        "            reply_media=smurl,\n"
        "        )\n"
        "        return _msg_response(msg, {'offer_id': new_offer.pk})"
    )

    content, ok3 = _replace_once(content, re.escape(old_counter), new_counter, 'counter branch')
    if ok3:
        _ok('Counter offers propagate the parent offer\'s selected photo.')

    # accept branch
    old_accept = (
        "        msg  = _send_message(\n"
        "            sender_user=request.user,\n"
        "            recipient_user=locked_offer.proposed_by,   # notify the buyer\n"
        "            text=text,\n"
        "            message_type='deal_confirmation',\n"
        "            status_obj=locked_status,\n"
        "            deal=deal,\n"
        "        )"
    )

    new_accept = (
        "        msg  = _send_message(\n"
        "            sender_user=request.user,\n"
        "            recipient_user=locked_offer.proposed_by,\n"
        "            text=text,\n"
        "            message_type='deal_confirmation',\n"
        "            status_obj=locked_status,\n"
        "            deal=deal,\n"
        "            reply_media=getattr(locked_offer, 'selected_media_url', '') or '',\n"
        "        )"
    )

    content, ok4 = _replace_once(content, re.escape(old_accept), new_accept, 'accept branch')
    if ok4:
        _ok('Accepted deals carry the buyer-selected photo.')

    # take_listing body parse
    old_take_sig = (
        "    status_id      = body.get('status_id')\n"
        "    payment_method = body.get('payment_method', '')\n"
        "    delivery_addr  = body.get('delivery_address', '')\n"
        "    instructions   = body.get('delivery_instructions', '')"
    )

    new_take_sig = (
        "    status_id      = body.get('status_id')\n"
        "    payment_method = body.get('payment_method', '')\n"
        "    delivery_addr  = body.get('delivery_address', '')\n"
        "    instructions   = body.get('delivery_instructions', '')\n"
        "    selected_media_url = (body.get('selected_media_url') or '').strip()[:500]"
    )

    content, ok5 = _replace_once(content, re.escape(old_take_sig), new_take_sig, 'take_listing body parse')
    if ok5:
        _ok('take_listing reads selected_media_url from the request body.')

    # take_listing send call
    old_take_call = (
        "    msg  = _send_message(\n"
        "        sender_user=request.user, recipient_user=status_obj.user,\n"
        "        text=text, message_type='deal_confirmation',\n"
        "        status_obj=status_obj, deal=deal,\n"
        "    )\n"
        "    return _msg_response(msg, {'deal_id': deal.pk, 'deal': _serialize_deal(deal)})"
    )

    new_take_call = (
        "    msg  = _send_message(\n"
        "        sender_user=request.user, recipient_user=status_obj.user,\n"
        "        text=text, message_type='deal_confirmation',\n"
        "        status_obj=status_obj, deal=deal,\n"
        "        reply_media=selected_media_url,\n"
        "    )\n"
        "    return _msg_response(msg, {'deal_id': deal.pk, 'deal': _serialize_deal(deal)})"
    )

    content, ok6 = _replace_once(content, re.escape(old_take_call), new_take_call, 'take_listing send call')
    if ok6:
        _ok('Buy Now forwards the buyer-selected photo into reply_media.')

    _write(path, content)


# ──────────────────────────────────────────────────────────────────────────
# FIX 1 — CSS: add .syncing + .fz-txn-message
# ──────────────────────────────────────────────────────────────────────────

def patch_css(path):
    _banner('FIX 1 (CSS) — .syncing + .fz-txn-message')

    content = _read(path)
    if content is None:
        return

    addition = (
        "\n\n/* FOU guard — hide chat container until server render is complete */\n"
        "#id_chat_item_container.syncing { visibility: hidden; }\n"
        "\n"
        "/* Transaction card buyer-message block (rendered by negotiate.js) */\n"
        ".fz-txn-message {\n"
        "  font-size: 12px;\n"
        "  color: rgba(255,255,255,.75);\n"
        "  line-height: 1.5;\n"
        "  margin-bottom: 8px;\n"
        "  padding: 8px 10px;\n"
        "  background: rgba(255,255,255,.03);\n"
        "  border-radius: 0 8px 8px 0;\n"
        "  border-left: 3px solid rgba(37,211,102,.7);\n"
        "  white-space: pre-wrap;\n"
        "  word-break: break-word;\n"
        "}\n"
    )

    if '#id_chat_item_container.syncing' in content:
        _info('CSS rules already present — skipping.')
        return

    _write(path, content + addition)


# ──────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────

def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'

    print()
    print('╔' + '═' * 76 + '╗')
    print('║' + '  Fizzme Chat Fixes — auto-discovery patcher'.ljust(76) + '║')
    print('╚' + '═' * 76 + '╝')
    print(f'\n  Scanning: {os.path.abspath(root)}\n')

    CHAT_JS      = find_file('chat.js', root)
    NEGOTIATE_JS = find_file('negotiate.js', root)
    CART_JS      = find_file('cart.js', root)
    CHECKOUT_JS  = find_file('checkout.js', root)
    NEGOTIATE_PY = find_file('views_negotiate.py', root) or find_file('negotiate_views.py', root)
    CSS_FILE     = (find_file('styles.css', root)
                    or find_file('style.css', root)
                    or find_file('main.css', root))

    targets = {
        'chat.js':          CHAT_JS,
        'negotiate.js':     NEGOTIATE_JS,
        'cart.js':          CART_JS,
        'checkout.js':      CHECKOUT_JS,
        'views_negotiate':  NEGOTIATE_PY,
        'CSS':              CSS_FILE,
    }

    print('  Discovered files:')
    for name, path in targets.items():
        if path:
            print(f'    ✓ {name:20s} → {path}')
        else:
            print(f'    ✗ {name:20s} → NOT FOUND')
    print()

    if not any(targets.values()):
        _warn('No target files found. Are you running this from the project root?')
        _warn('Try: python3 apply_fixes.py /path/to/project/root')
        sys.exit(1)

    # Apply patches
    if CHAT_JS:
        patch_chat_js_fou(CHAT_JS)
        patch_chat_js_reply_media(CHAT_JS)
        patch_chat_js_buy_now(CHAT_JS)

    if NEGOTIATE_JS:
        patch_negotiate_js_note(NEGOTIATE_JS)
        patch_negotiate_js_buyer_only(NEGOTIATE_JS)

    if CART_JS:
        patch_cart_js(CART_JS)

    if CHECKOUT_JS:
        patch_checkout_js(CHECKOUT_JS)

    if NEGOTIATE_PY:
        patch_views_negotiate(NEGOTIATE_PY)

    if CSS_FILE:
        patch_css(CSS_FILE)

    _banner('DONE')
    print()
    print(f'  Every modified file has a .bak.{TS} copy.')
    print('  Restart Django + hard-refresh the browser (Ctrl+Shift+R).')
    print()
    print('  If any "⚠️ No match for:" warning appeared above, that specific')
    print('  patch did not apply — open the file and patch that block manually.')
    print()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nAborted by user.')
        sys.exit(1)