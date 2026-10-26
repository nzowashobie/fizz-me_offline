#!/usr/bin/env python3
"""patch_market_only.py — only Market category shows listing / Buy UI"""
import sys, shutil
from pathlib import Path

DRY  = "--dry-run" in sys.argv
PROJ = Path("/home/fizzme/fizzme/projec")

def find_file(name):
    for p in PROJ.rglob(name):
        parts = [s.lower() for s in p.parts]
        if "migrations" in parts or "_patch_backup" in parts or "backup" in parts:
            continue
        return p
    return None

FILES = {n: find_file(n) for n in
         ("views_status.py", "views_messages.py",
          "helpers.py", "negotiate_views.py")}
missing = [k for k, v in FILES.items() if v is None]
if missing:
    print(f"ERROR: could not find: {missing}"); sys.exit(1)

print(f"project: {PROJ}")
for n, p in FILES.items():
    print(f"  {n} → {p}")
if DRY: print("(dry run)\n")

PATCHES = [
    # 1. views_status.py — upload_status: force non-Market is_commercial=False
    ("views_status.py",
     "upload_status: coerce is_commercial=False for non-Market",
     """    is_commercial = request.POST.get('is_commercial', '').strip().lower() == 'true'
""",
     """    is_commercial = request.POST.get('is_commercial', '').strip().lower() == 'true'
    # Business listings live only in the Market category.
    if is_commercial and category_name != 'Market':
        is_commercial = False
"""),

    # 2. views_status.py — feed: only Market statuses get is_commercial=True
    ("views_status.py",
     "get_categorized_status_feed: only Market gets is_commercial",
     """                if status.is_commercial:
                    item.update({
                        'is_commercial': True,
""",
     """                if status.is_commercial and category.name == 'Market':
                    item.update({
                        'is_commercial': True,
"""),

    # 3. views_messages.py — _serialize_related_status: real flag + category
    ("views_messages.py",
     "_serialize_related_status: is_commercial Market-only + category field",
     """        return {
            'status_id':        status_obj.pk,
            'username':         status_obj.user.username,
            'caption':          status_obj.caption or '',
            'price':            str(status_obj.price) if status_obj.price is not None else None,
            'is_negotiable':    status_obj.is_negotiable,
            'media_url':        media_url,
            'is_commercial':    True,
            'availability':     status_obj.availability,
            'collection_point': status_obj.collection_point or '',
            'active_deal_id':   active_deal_id,
            'final_price':      final_price,
        }""",
     """        _cat_name = (status_obj.category.name if status_obj.category else '')
        _is_market_commercial = bool(status_obj.is_commercial) and _cat_name == 'Market'
        return {
            'status_id':        status_obj.pk,
            'username':         status_obj.user.username,
            'caption':          status_obj.caption or '',
            'price':            str(status_obj.price) if status_obj.price is not None else None,
            'is_negotiable':    status_obj.is_negotiable,
            'media_url':        media_url,
            'is_commercial':    _is_market_commercial,
            'category':         _cat_name,
            'availability':     status_obj.availability,
            'collection_point': status_obj.collection_point or '',
            'active_deal_id':   active_deal_id,
            'final_price':      final_price,
        }"""),

    # 4. helpers.py — _serialize_message: real flag + category
    ("helpers.py",
     "_serialize_message: is_commercial Market-only + category field",
     """            related_status_data = {
                "id":               rs.id,
                "status_id":        rs.id,
                "username":         rs.user.username,
                "price":            str(rs.price) if rs.price is not None else None,
                "is_negotiable":    rs.is_negotiable,
                "availability":     rs.availability,
                "caption":          rs.caption or '',
                "media_url":        _get_file_url(rs.media) or '',
                "product_category": rs.product_category or '',
                "collection_point": rs.collection_point or '',
                "active_deal_id":   active_deal_id,
                "final_price":      final_price,
                "is_commercial":    rs.is_commercial,
            }""",
     """            _rs_cat = (rs.category.name if getattr(rs, 'category', None) else '')
            _rs_market_commercial = bool(rs.is_commercial) and _rs_cat == 'Market'
            related_status_data = {
                "id":               rs.id,
                "status_id":        rs.id,
                "username":         rs.user.username,
                "price":            str(rs.price) if rs.price is not None else None,
                "is_negotiable":    rs.is_negotiable,
                "availability":     rs.availability,
                "caption":          rs.caption or '',
                "media_url":        _get_file_url(rs.media) or '',
                "product_category": rs.product_category or '',
                "collection_point": rs.collection_point or '',
                "active_deal_id":   active_deal_id,
                "final_price":      final_price,
                "is_commercial":    _rs_market_commercial,
                "category":         _rs_cat,
            }"""),

    # 5. negotiate_views.py — _listing_snapshot: real flag + category
    ("negotiate_views.py",
     "_listing_snapshot: is_commercial Market-only + category field",
     """def _listing_snapshot(status_obj):
    return {
        'status_id':        status_obj.pk,
        'username':         status_obj.user.username,
        'caption':          status_obj.caption or '',
        'price':            str(status_obj.price) if status_obj.price is not None else None,
        'is_negotiable':    status_obj.is_negotiable,
        'media_url':        _media_url(status_obj),
        'is_commercial':    True,
        'availability':     status_obj.availability,
        'collection_point': status_obj.collection_point or '',
    }""",
     """def _listing_snapshot(status_obj):
    _cat = (status_obj.category.name if getattr(status_obj, 'category', None) else '')
    _is_market_commercial = bool(status_obj.is_commercial) and _cat == 'Market'
    return {
        'status_id':        status_obj.pk,
        'username':         status_obj.user.username,
        'caption':          status_obj.caption or '',
        'price':            str(status_obj.price) if status_obj.price is not None else None,
        'is_negotiable':    status_obj.is_negotiable,
        'media_url':        _media_url(status_obj),
        'is_commercial':    _is_market_commercial,
        'category':         _cat,
        'availability':     status_obj.availability,
        'collection_point': status_obj.collection_point or '',
    }"""),
]

applied = skipped = failed = 0
for fname, desc, old, new in PATCHES:
    path = FILES[fname]
    text = path.read_text(encoding="utf-8")
    if new in text:
        print(f"  = {fname}: already patched — {desc}"); skipped += 1; continue
    if old not in text:
        print(f"  x {fname}: anchor not found — {desc}");  failed  += 1; continue
    if DRY:
        print(f"  > {fname}: would patch — {desc}"); applied += 1; continue
    bak = path.with_suffix(path.suffix + ".bak")
    if not bak.exists(): shutil.copy2(path, bak)
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"  + {fname}: patched — {desc}"); applied += 1

print(f"\nSummary: applied={applied} skipped={skipped} failed={failed}")
sys.exit(0 if failed == 0 else 2)