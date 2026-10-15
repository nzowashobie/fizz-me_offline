#!/usr/bin/env python
"""
patch_chat_features.py

1. Clear chat: a contact whose messages you cleared stops appearing in the
   sidebar (unread and market lookups now ignore cleared messages).
2. Offer cards: each offer carries 'history', the full bargaining chain with
   every note, oldest first. A counter now stores its note on the counter offer.
3. Accept no longer opens the payment screen for the seller.

Run from the folder that contains manage.py:
    python patch_chat_features.py --dry-run
    python patch_chat_features.py

Backs up every file it changes and restores them if a check fails.
"""
import datetime
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
DRY = "--dry-run" in sys.argv
BACKUP = ROOT / "_patch_backup" / f"chat-features-{datetime.datetime.now():%Y%m%d-%H%M%S}"
MSG = "chat/views/views_messages.py"
COMMERCE = "chat/views/views_commerce.py"
DEALS = "static/js/modules/deals.js"

HISTORY_PY = r'''def _offer_history(offer):
    """
    Every offer in this bargaining chain, oldest first, each with its own note.
    Walks parent_offer links back to the first offer.
    """
    chain = []
    seen = set()
    cur = offer
    while cur is not None and cur.pk not in seen and len(chain) < 50:
        seen.add(cur.pk)
        chain.append(cur)
        cur = cur.parent_offer
    chain.reverse()
    return [
        {
            "id":          o.pk,
            "amount":      str(o.amount),
            "state":       o.state,
            "proposed_by": o.proposed_by.username,
            "note":        getattr(o, "note", "") or "",
            "created_at":  o.created_at.isoformat() if o.created_at else None,
        }
        for o in chain
    ]


def _serialize_offer_safe(msg):
    """
    Nested offer dict for the card builders, or None.
    'history' is the whole bargaining chain, including this offer.
    """
    try:
        offer = msg.offer
        if offer is None:
            return None
        return {
            "id":              offer.pk,
            "amount":          str(offer.amount),
            "state":           offer.state,
            "proposed_by":     offer.proposed_by.username,
            "note":            getattr(offer, "note", "") or "",
            "created_at":      offer.created_at.isoformat() if offer.created_at else None,
            "parent_offer_id": offer.parent_offer_id,
            "history":         _offer_history(offer),
        }
    except Exception:
        return None


'''

HISTORY_JS = r'''    // Bargaining history: every offer in this chain with the note that came with it
    var chain = offer.history || [];
    if (chain.length > 1) {
      var hist = document.createElement('div');
      hist.className = 'fz-txn-history';
      hist.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);';
      var histTitle = document.createElement('div');
      histTitle.style.cssText = 'font-size:11px;font-weight:700;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;';
      histTitle.textContent = 'Bargaining so far';
      hist.appendChild(histTitle);
      chain.forEach(function (h, i) {
        var row = document.createElement('div');
        row.style.cssText = 'margin-bottom:8px;';
        var line = document.createElement('div');
        var isCurrent = h.id === offer.id;
        line.style.cssText = 'font-size:12px;font-weight:' + (isCurrent ? '700' : '500') + ';color:' + (isCurrent ? '#e6a817' : 'rgba(255,255,255,.75)') + ';';
        line.textContent = (i + 1) + '. ' + h.proposed_by + ' · ' + fmtK(h.amount) + ' · ' + _stateLabel(h.state) + ' · ' + _fmtDate(h.created_at);
        row.appendChild(line);
        if (h.note) {
          var hNote = document.createElement('div');
          hNote.className = 'fz-txn-note';
          hNote.textContent = '\u201C' + h.note + '\u201D';
          row.appendChild(hNote);
        }
        hist.appendChild(row);
      });
      body.appendChild(hist);
    } else if (offer.note) {
      var noteEl = document.createElement('div');
      noteEl.className = 'fz-txn-note';
      noteEl.textContent = '\u201C' + offer.note + '\u201D';
      body.appendChild(noteEl);
    }

'''

ACCEPT_RE = re.compile(
    r"if \(res\.deal_id && window\.Asterix && window\.Asterix\.checkout\) \{\s*"
    r"setTimeout\(function \(\) \{\s*"
    r"window\.Asterix\.checkout\.openDealConfirm\(res\.deal_id, res\.final_price\);\s*"
    r"\}, 800\);\s*\}"
)
ACCEPT_NEW = "/* Payment opens from the deal card's Pay button, not on accept. */"


def say(msg):
    print(("[dry-run] " if DRY else "") + msg)


def apply_once(text, old, new, label):
    if new in text:
        say(f"ok      {label} (already applied)")
        return text
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected one match, found {n}. Stopping.")
    return text.replace(old, new, 1)


def apply_block(text, start, end, new, label, done):
    if done in text:
        say(f"ok      {label} (already applied)")
        return text
    if text.count(start) != 1:
        raise SystemExit(f"{label}: start marker found {text.count(start)} times. Stopping.")
    s = text.index(start)
    e = text.index(end, s + len(start))
    return text[:s] + new + text[e:]


def apply_accept(text):
    if ACCEPT_NEW in text and not ACCEPT_RE.search(text):
        say("ok      deals.js accept (auto-open already removed)")
        return text
    found = len(ACCEPT_RE.findall(text))
    if found == 0:
        raise SystemExit("deals.js: accept payment block not found. Stopping.")
    say(f"edit    deals.js: removed {found} accept-time payment open(s)")
    return ACCEPT_RE.sub(ACCEPT_NEW, text)


def main():
    if not (ROOT / "manage.py").exists():
        raise SystemExit("Run this from the folder that contains manage.py.")

    original = {}
    for rel in (MSG, COMMERCE, DEALS):
        p = ROOT / rel
        if not p.exists():
            raise SystemExit(f"{rel} not found. Stopping.")
        original[rel] = p.read_text(encoding="utf-8")

    new = dict(original)

    # views_messages.py: sidebar ignores cleared messages; offers carry history
    t = new[MSG]
    t = apply_once(t,
        "Q(sender=me) | Q(recipient=me),",
        "Q(sender=me, cleared_by_sender=False) | Q(recipient=me, cleared_by_recipient=False),",
        "views_messages market lookup")
    t = apply_once(t,
        ".filter(recipient=me, is_read=False)",
        ".filter(recipient=me, is_read=False, cleared_by_recipient=False)",
        "views_messages unread lookup")
    t = apply_block(t,
        "def _serialize_offer_safe(msg):",
        "def _serialize_deal_safe(msg):",
        HISTORY_PY, "views_messages offer history", "def _offer_history(offer):")
    new[MSG] = t

    # views_commerce.py: the counter offer keeps its note
    new[COMMERCE] = apply_once(new[COMMERCE],
        "proposed_by=request.user, amount=counter_decimal,",
        "proposed_by=request.user, amount=counter_decimal, note=note,",
        "views_commerce counter note")

    # deals.js: history on the card; accept no longer opens payment
    t = new[DEALS]
    t = apply_block(t,
        "    // Note (buyer's message to seller)",
        "    card.appendChild(body);",
        HISTORY_JS, "deals.js card history", "Bargaining so far")
    t = apply_accept(t)
    new[DEALS] = t

    changed = [rel for rel in (MSG, COMMERCE, DEALS) if new[rel] != original[rel]]
    if not changed:
        say("nothing to change")
        return
    for rel in changed:
        say(f"write   {rel}")
    if DRY:
        say("dry run complete, nothing was written")
        return

    BACKUP.mkdir(parents=True, exist_ok=True)
    for rel in changed:
        shutil.copy2(ROOT / rel, BACKUP / Path(rel).name)
        (ROOT / rel).write_text(new[rel], encoding="utf-8")
    say(f"backups: {BACKUP}")

    def restore():
        for rel in changed:
            shutil.copy2(BACKUP / Path(rel).name, ROOT / rel)

    for rel in changed:
        if rel.endswith(".py"):
            r = subprocess.run([sys.executable, "-m", "py_compile", rel], cwd=ROOT,
                               capture_output=True, text=True)
            if r.returncode:
                restore()
                raise SystemExit(f"Syntax error in {rel}. Restored originals.\n{r.stderr}")

    if DEALS in changed and shutil.which("node"):
        r = subprocess.run(["node", "--check", DEALS], cwd=ROOT, capture_output=True, text=True)
        if r.returncode:
            restore()
            raise SystemExit(f"Syntax error in {DEALS}. Restored originals.\n{r.stderr}")

    r = subprocess.run([sys.executable, "manage.py", "check"], cwd=ROOT,
                       capture_output=True, text=True)
    print(r.stdout + r.stderr)
    if r.returncode:
        restore()
        raise SystemExit("manage.py check failed. Restored originals.")

    r = subprocess.run([sys.executable, "manage.py", "collectstatic", "--noinput"],
                       cwd=ROOT, capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    say("done. Reload the web app, then hard-refresh the chat (Ctrl+Shift+R).")


if __name__ == "__main__":
    main()