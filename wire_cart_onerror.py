#!/usr/bin/env python3
"""wire_cart_onerror.py — attach retry handlers to cart thumbnails."""

import os, re, shutil, sys, time
TS = time.strftime('%Y%m%d_%H%M%S')
SKIP = {'.git','__pycache__','node_modules','.venv','venv','env','.idea','.vscode','migrations','dist','build','media','staticfiles'}

def find(name, root='.'):
    hits = []
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in SKIP]
        if name in fns: hits.append(os.path.join(dp, name))
    if not hits: return None
    hits.sort(key=lambda p: (p.count(os.sep), len(p)))
    return hits[0]

path = find('cart.js', sys.argv[1] if len(sys.argv) > 1 else '.')
if not path:
    print('✗ cart.js not found'); sys.exit(1)
print(f'→ {path}')

with open(path) as f: c = f.read()

if "img.cart-thumb" in c:
    print('•  error handler already wired — nothing to do')
    sys.exit(0)

# Locate the line that sets container.innerHTML = html;
pattern = re.compile(r"(\n(\s*)container\.innerHTML\s*=\s*html;\n)")
m = pattern.search(c)
if not m:
    print('✗ Could not find "container.innerHTML = html;" anchor.')
    sys.exit(1)

indent = m.group(2)
handler = (
    f"\n{indent}// Wire thumb fallback: primary → fallback → icon\n"
    f"{indent}container.querySelectorAll('img.cart-thumb').forEach(function (img) {{\n"
    f"{indent}  function _fail() {{\n"
    f"{indent}    var fb = img.getAttribute('data-fallback');\n"
    f"{indent}    if (fb && img.getAttribute('data-used-fb') !== '1') {{\n"
    f"{indent}      console.warn('[Cart] primary thumb failed, retrying fallback:', fb);\n"
    f"{indent}      img.setAttribute('data-used-fb', '1');\n"
    f"{indent}      img.src = fb;\n"
    f"{indent}      return;\n"
    f"{indent}    }}\n"
    f"{indent}    console.warn('[Cart] all thumb URLs failed:', img.src);\n"
    f"{indent}    var ph = document.createElement('div');\n"
    f"{indent}    ph.style.cssText = 'width:44px;height:44px;background:var(--mid);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;';\n"
    f"{indent}    ph.textContent = '\U0001F3F7\uFE0F';\n"
    f"{indent}    img.replaceWith(ph);\n"
    f"{indent}  }}\n"
    f"{indent}  img.addEventListener('error', _fail);\n"
    f"{indent}  if (img.complete && img.naturalWidth === 0) _fail();\n"
    f"{indent}}});\n"
)

c = c[:m.end()] + handler + c[m.end():]
bak = f'{path}.bak.{TS}'
shutil.copy2(path, bak)
with open(path, 'w') as f: f.write(c)
print(f'✅ Wired img error handler into {path}')
print(f'   backup: {bak}')
print()
print('Next: restart Django, hard-refresh (Ctrl+Shift+R).')
print('In the browser console you will see either:')
print('  [Cart] thumb for <item> = https://...        (success)')
print('  [Cart] primary thumb failed, retrying...     (fallback active)')
print('  [Cart] all thumb URLs failed: https://...    (broken input URL)')