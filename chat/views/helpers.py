"""
helpers.py — Shared utilities used across all view modules.
"""

import logging
import urllib.request
from django.db.models import Q

logger = logging.getLogger(__name__)


# ─── URL / file helpers ────────────────────────────────────────────────────

def _utc_iso(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'


def _profile_pic(user):
    try:
        pp = user.profile.profile_picture
        pid = getattr(pp, 'public_id', None) or getattr(pp, 'name', None)

        # Reject static paths or full URLs that might be stuck in the DB
        if pid and not str(pid).startswith(('/static/', 'http://', 'https://')):
            url = pp.url
            if url and url.startswith('http://'):
                url = url.replace('http://', 'https://', 1)
            return url or ''
    except Exception:
        pass
    return ''


def _guess_resource_type(public_id_or_name):
    name = str(public_id_or_name or '').lower()
    for prefix in ('auto/upload/', 'image/upload/', 'video/upload/', 'raw/upload/'):
        if prefix in name:
            name = name.split(prefix, 1)[-1]
            break
    ext = name.rsplit('.', 1)[-1] if '.' in name else ''
    if ext in ('mp4', 'mov', 'webm', 'avi', 'mkv', 'flv', 'wmv'):
        return 'video'
    if ext in ('pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'csv', 'txt'):
        return 'raw'
    return 'image'


def _clean_public_id(file_field):
    public_id = getattr(file_field, 'public_id', None)
    if not public_id:
        public_id = getattr(file_field, 'name', None) or str(file_field)
    if not public_id:
        return None

    public_id = str(public_id)

    for prefix in ('auto/upload/', 'image/upload/', 'video/upload/', 'raw/upload/'):
        if prefix in public_id:
            public_id = public_id.split(prefix, 1)[-1]
            break

    import re
    public_id = re.sub(r'^v\d+/', '', public_id)

    return public_id or None


def _get_file_url(file_field):
    if not file_field:
        return ''

    try:
        public_id = _clean_public_id(file_field)
        if not public_id:
            return ''

        resource_type = _guess_resource_type(public_id)

        import cloudinary.utils
        url, _ = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type=resource_type,
            type='upload',
            secure=True,
            sign_url=True,
        )

        if url and url.startswith('http://'):
            url = url.replace('http://', 'https://', 1)
        return url or ''

    except Exception as e:
        logger.warning(f"_get_file_url failed for {file_field!r}: {e}")
        try:
            url = file_field.url
            if url and url.startswith('http://'):
                url = url.replace('http://', 'https://', 1)
            return url or ''
        except Exception:
            return ''


def _get_cloudinary_filename(file_field):
    try:
        public_id = getattr(file_field, 'public_id', None)
        if public_id:
            return str(public_id).split('/')[-1]
        raw = str(file_field)
        if raw:
            return raw.split('/')[-1]
    except Exception:
        pass
    return 'file'


def _secure_url(url):
    if url and url.startswith('http://'):
        if 'res.cloudinary.com' in url or 'cloudinary.com' in url:
            return url.replace('http://', 'https://', 1)
    return url


def _delete_file(file_field):
    try:
        if not file_field:
            return
        public_id = getattr(file_field, 'public_id', None)
        name = public_id or getattr(file_field, 'name', None)
        if name:
            file_field.storage.delete(name)
    except Exception:
        pass


def _fetch_file_bytes(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'AsterixChat/1.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            content_type = resp.headers.get(
                'Content-Type', 'application/octet-stream'
            ).split(';')[0].strip()
            return data, content_type
    except Exception as e:
        logger.error(f"_fetch_file_bytes failed for {url}: {e}")
        return None, None


# ─── Message serializer ────────────────────────────────────────────────────

def _serialize_message(msg, viewer=None):
    from django.db.models import Q as _Q

    attachments = []
    for att in msg.attachments.all():
        url = _get_file_url(att.file)
        if url:
            attachments.append({
                "id":        att.id,
                "file_url":  url,
                "file_name": att.original_filename or _get_cloudinary_filename(att.file),
                "file_type": att.file_type or "application/octet-stream",
            })

    related_status_data = None
    if msg.related_status_id:
        try:
            rs = msg.related_status
            active_deal_id = None
            final_price    = None
            if viewer:
                active = rs.deals.filter(
                    state__in=('pending_confirmation', 'confirmed'),
                ).filter(
                    _Q(buyer=viewer) | _Q(seller=viewer)
                ).order_by('-created_at').first()
                if active:
                    active_deal_id = active.id
                    final_price    = str(active.final_price)
            _rs_cat = (rs.category.name if getattr(rs, 'category', None) else '')
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
            }
        except Exception:
            related_status_data = None

    offer_data = None
    if msg.offer_id:
        try:
            offer = msg.offer
            offer_data = {
                "id":             offer.id,
                "amount":         str(offer.amount),
                "state":          offer.state,
                "proposed_by":    offer.proposed_by.username,
                "note":           getattr(offer, 'note', '') or '',
                "buyer":          offer.buyer.username,
                "seller":         offer.seller.username,
                "parent_offer_id": offer.parent_offer_id,
                "created_at":     _utc_iso(offer.created_at),
                "responded_at":   _utc_iso(offer.responded_at) if offer.responded_at else None,
            }
        except Exception:
            offer_data = None

    deal_data = None
    if msg.deal_id:
        try:
            deal = msg.deal
            deal_data = {
                "id":                   deal.id,
                "final_price":          str(deal.final_price),
                "state":                deal.state,
                "buyer":                deal.buyer.username,
                "seller":               deal.seller.username,
                "buyer_confirmed":      deal.buyer_confirmed,
                "seller_confirmed":     deal.seller_confirmed,
                "collection_point":     deal.collection_point_snapshot,
                "created_at":           _utc_iso(deal.created_at),
                "updated_at":           _utc_iso(deal.updated_at),
                "payment_method":       deal.payment_method or '',
                "delivery_address":     deal.delivery_address or '',
                "delivery_instructions": deal.delivery_instructions or '',
                "payment_account":      deal.payment_account or '',
                "payment_reference":    deal.payment_reference or '',
            }
        except Exception:
            deal_data = None

    return {
        "id":              msg.id,
        "sender":          msg.sender.username,
        "recipient":       msg.recipient.username,
        "message":         msg.message,
        "timestamp":       _utc_iso(msg.timestamp),
        "is_read":         msg.is_read,
        "profile_picture": _profile_pic(msg.sender),
        "attachments":     attachments,
        "reply_to":        msg.reply_to_msg_id,
        "reply_sender":    msg.reply_sender or '',
        "reply_text":      msg.reply_text or '',
        "reply_media":     msg.reply_media or '',
        "related_status":  related_status_data,
        "message_type":    msg.message_type,
        "offer":           offer_data,
        "deal":            deal_data,
    }