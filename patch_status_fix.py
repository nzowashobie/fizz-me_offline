#!/usr/bin/env python3
import sys, shutil
from pathlib import Path

PROJ = Path("/home/fizzme/fizzme/projec")

# Find wedding_panel.html anywhere in the project
WEDDING_PANEL = None
for p in PROJ.rglob("wedding_panel.html"):
    if "_patch_backup" not in p.parts:
        WEDDING_PANEL = p
        break

if not WEDDING_PANEL:
    print("❌ ERROR: Could not find wedding_panel.html anywhere in the project.")
    sys.exit(1)

print(f"✅ Found wedding_panel.html at: {WEDDING_PANEL}")

text = WEDDING_PANEL.read_text(encoding="utf-8")

old_css = """  #wedding-panel {
    display:none; position:fixed; bottom:0; left:0; width:var(--sidebar-w);
    max-height:92vh; background:#1a1f1f; border-top:2px solid #e91e63;
    border-radius:16px 16px 0 0; z-index:19001; overflow-y:auto;
    box-shadow:0 -4px 24px rgba(0,0,0,.7); animation:slideUp .25s ease-out;
  }"""

new_css = """  #wedding-panel {
    display:none; position:fixed; bottom:0; left:0; width:var(--sidebar-w);
    max-height:92vh; background:var(--card, #1a1f1f); border-top:2px solid #e91e63;
    border-radius:16px 16px 0 0; z-index:19001; overflow-y:auto;
    box-shadow:0 -4px 24px rgba(0,0,0,.7); animation:slideUp .25s ease-out;
  }
  .wp-field { display: flex; flex-direction: column; gap: 4px; }
  .wp-field-row { display: flex; gap: 10px; }
  .wp-field-row .wp-field { flex: 1; }"""

if old_css in text:
    text = text.replace(old_css, new_css)
    bak = WEDDING_PANEL.with_suffix(".bak")
    if not bak.exists(): shutil.copy2(WEDDING_PANEL, bak)
    WEDDING_PANEL.write_text(text, encoding="utf-8")
    print("✅ wedding_panel.html patched: UI theme updated to match the app.")
elif "background:var(--card, #1a1f1f);" in text:
    print("✅ wedding_panel.html is already patched.")
else:
    print("⚠️ Could not find the exact CSS anchor in wedding_panel.html.")