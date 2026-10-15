"""
views_messages.py — All message endpoints:
  get_messages, send_message_http, poll_messages,
  mark_messages_as_read, get_unread_message_count,
  get_conversation_previews, delete_message, clear_chat.

FIX: _serialize_message now embeds 'offer' and 'deal' nested dicts
     so that negotiate.js buildTransactionCard() can render the
     Accept / Counter / Decline card instead of falling through to
     plain text.  select_related('offer', 'deal') is already present
     in every queryset — this just exposes the data to the frontend.
"""

import json
import logging
import mimetypes

import cloudinary.uploader
import io

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import Attachment, CustomUser, Message, UserStatus
from .helpers import (
    _utc_iso, _get_file_url, _get_cloudinary_filename,
    _fetch_file_bytes,
)
from ..push_utils import send_push_notification

User    = get_user_model()
logger  = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# SERIALISATION HELPERS (NEW)
# ─────────────────────────────────────────────────────────────────────────────

def _offer_history(offer):
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


def _serialize_deal_safe(msg):
    """
    Return the nested deal dict that negotiate.js _buildDealCard() reads,
    or None when the message has no linked deal.
    """
    try:
        deal = msg.deal
        if deal is None:
            return None

        def _username(u):
            return u.username if hasattr(u, 'username') else str(u)

        return {
            'id':               deal.pk,
            'final_price':      str(deal.final_price),
            'state':            deal.state,
            'buyer':            _username(deal.buyer),
            'seller':           _username(deal.seller),
            'buyer_confirmed':  deal.buyer_confirmed,
            'seller_confirmed': deal.seller_confirmed,
            'payment_method':   deal.payment_method or '',
            'collection_point': getattr(deal, 'collection_point_snapshot', '') or '',
        }
    except Exception:
        return None


def _serialize_related_status(status_obj, viewer=None):
    """
    Return the listing snapshot dict negotiate.js / chat.js uses, including
    active_deal_id + final_price so the buyer always sees a Pay button
    after Buy Now.
    """
    if status_obj is None:
        return None
    try:
        media_url = ''
        try:
            first = status_obj.media_items.order_by('order', 'id').first()
            if first:
                raw = first.file.url if hasattr(first.file, 'url') else str(first.file)
                media_url = raw.replace('http://', 'https://') if raw else ''
        except Exception:
            pass
        if not media_url:
            try:
                legacy = getattr(status_obj, 'media', None)
                if legacy:
                    raw = legacy.url if hasattr(legacy, 'url') else str(legacy)
                    media_url = raw.replace('http://', 'https://') if raw else ''
            except Exception:
                pass
        if not media_url:
            try:
                media_url = _get_file_url(getattr(status_obj, 'media', None)) or ''
            except Exception:
                pass

        # Compute active deal context for the viewer
        active_deal_id = None
        final_price    = None
        if viewer is not None:
            try:
                active = status_obj.deals.filter(
                    state__in=('pending_confirmation', 'confirmed'),
                ).filter(
                    Q(buyer=viewer) | Q(seller=viewer)
                ).order_by('-created_at').first()
                if active:
                    active_deal_id = active.id
                    final_price    = str(active.final_price)
            except Exception:
                pass

        return {
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
        }
    except Exception:
        return None

def _serialize_message(msg, viewer=None):
    """
    Full message serialisation for both get_messages and poll_messages.

    The critical additions vs the previous version:
      • 'offer'          — nested offer dict (or null)
      • 'deal'           — nested deal dict (or null)
      • 'related_status' — listing snapshot dict (or null)

    These three fields are what negotiate.js reads to decide whether to
    render a structured commerce card or fall back to plain message text.
    """
    # ── Attachments ───────────────────────────────────────────────────
    attachments = []
    for att in msg.attachments.all():
        url = _get_file_url(att.file)
        if url:
            attachments.append({
                'id':        att.id,
                'file_url':  url,
                'file_name': getattr(att, 'original_filename', None) or _get_cloudinary_filename(att.file),
                'file_type': att.file_type or '',
            })

    # ── Reply context ─────────────────────────────────────────────────
    reply_to_id = None
    if msg.reply_to_msg_id:
        reply_to_id = msg.reply_to_msg_id

    # ── Sender / recipient usernames ──────────────────────────────────
    sender_username    = msg.sender.username    if msg.sender    else ''
    recipient_username = msg.recipient.username if msg.recipient else ''

    return {
        # Core identity
        'id':           msg.pk,
        'server_id':    msg.pk,

        # Participants
        'sender':       sender_username,
        'username':     sender_username,   # legacy alias some templates use
        'recipient':    recipient_username,

        # Content
        'message':      msg.message or '',
        'message_type': msg.message_type or 'text',

        # Timing / status
        'timestamp':    _utc_iso(msg.timestamp),
        'is_read':      msg.is_read,

        # Reply thread
        'reply_to':     reply_to_id,
        'reply_sender': msg.reply_sender or '',
        'reply_text':   msg.reply_text   or '',
        'reply_media':  msg.reply_media  or '',

        # Files
        'attachments': attachments,

        # ── Commerce fields (THE FIX) ─────────────────────────────────
        # These were missing: without them buildTransactionCard() had
        # no nested offer/deal to read, so every negotiation message
        # rendered as plain text instead of the structured card.
        'offer':          _serialize_offer_safe(msg),
        'deal':           _serialize_deal_safe(msg),
        'related_status': _serialize_related_status(msg.related_status),
        # ─────────────────────────────────────────────────────────────
    }


# ─── Read ──────────────────────────────────────────────────────────────────

@login_required
def get_messages(request):
    recipient_username = request.GET.get('recipient', '').strip()
    if not recipient_username:
        return JsonResponse({'error': 'recipient is required'}, status=400)

    recipient = get_object_or_404(User, username=recipient_username)

    qs = Message.objects.filter(
        Q(sender=request.user, recipient=recipient, cleared_by_sender=False) |
        Q(sender=recipient, recipient=request.user, cleared_by_recipient=False)
    ).select_related('sender', 'recipient', 'offer', 'deal', 'related_status') \
     .prefetch_related('attachments')

    after_id_raw = request.GET.get('after_id', '').strip()
    if after_id_raw:
        try:
            qs = qs.filter(id__gt=int(after_id_raw))
        except (ValueError, TypeError):
            return JsonResponse({'error': 'after_id must be an integer'}, status=400)

    qs = qs.order_by('timestamp')

    try:
        return JsonResponse(
            [_serialize_message(m, viewer=request.user) for m in qs],
            safe=False,
        )
    except Exception as e:
        logger.error(f"get_messages serialisation error: {e}", exc_info=True)
        return JsonResponse({'error': 'Could not load messages.'}, status=500)


@login_required
def poll_messages(request):
    """Lightweight poll — returns only messages newer than after_id."""
    recipient_username = request.GET.get('recipient', '').strip()
    after_id_raw       = request.GET.get('after_id', '0').strip()

    if not recipient_username:
        return JsonResponse([], safe=False)

    try:
        after_id = int(after_id_raw)
    except (ValueError, TypeError):
        after_id = 0

    try:
        recipient = User.objects.get(username=recipient_username)
    except User.DoesNotExist:
        return JsonResponse([], safe=False)

    qs = (
        Message.objects
        .filter(
            Q(sender=request.user, recipient=recipient, cleared_by_sender=False) |
            Q(sender=recipient, recipient=request.user, cleared_by_recipient=False)
        )
        .filter(id__gt=after_id)
        .select_related('sender', 'recipient', 'offer', 'deal', 'related_status')
        .prefetch_related('attachments')
        .order_by('id')
    )

    try:
        return JsonResponse(
            [_serialize_message(m, viewer=request.user) for m in qs],
            safe=False,
        )
    except Exception as e:
        logger.error(f"poll_messages error: {e}", exc_info=True)
        return JsonResponse([], safe=False)


@login_required
def mark_messages_as_read(request):
    sender_username = (
        request.GET.get('sender', '').strip() or
        request.POST.get('sender', '').strip()
    )
    try:
        sender = User.objects.get(username=sender_username)
    except User.DoesNotExist:
        return JsonResponse({"error": "Sender not found"}, status=404)

    updated = Message.objects.filter(
        recipient=request.user, sender=sender, is_read=False
    ).update(is_read=True)

    return JsonResponse({"status": "success", "marked": updated})


@login_required
def get_unread_message_count(request):
    rows = (
        Message.objects
        .filter(recipient=request.user, is_read=False)
        .values('sender__username')
        .annotate(count=Count('id'))
    )
    return JsonResponse({row['sender__username']: row['count'] for row in rows})


@login_required
def get_conversation_previews(request):
    """
    Per-contact unread count + last-message snippet for the sidebar.
    Also flags conversations that contain market/offer messages so
    chat.js can badge them with the 🛒 Market pill.
    """
    me = request.user

    qs = (
        Message.objects
        .filter(
            Q(sender=me, cleared_by_sender=False) |
            Q(recipient=me, cleared_by_recipient=False)
        )
        .filter(Q(sender=me) | Q(recipient=me))
        .select_related('sender', 'recipient')
        .prefetch_related('attachments')
        .order_by('-timestamp')
    )

    previews = {}
    for m in qs:
        other = m.recipient.username if m.sender_id == me.id else m.sender.username
        if other in previews:
            continue

        text = (m.message or '').strip()
        if not text and m.attachments.exists():
            text = '📎 Attachment'
        if len(text) > 60:
            text = text[:60].rstrip() + '…'

        previews[other] = {
            'preview':   text,
            'timestamp': _utc_iso(m.timestamp),
            'from_me':   m.sender_id == me.id,
            'unread':    0,
            'has_market_thread': False,   # NEW – will be set below
        }

    # Unread counts
    unread_rows = (
        Message.objects
        .filter(recipient=me, is_read=False, cleared_by_recipient=False)
        .values('sender__username')
        .annotate(count=Count('id'))
    )
    for row in unread_rows:
        who = row['sender__username']
        if who in previews:
            previews[who]['unread'] = row['count']
        else:
            previews[who] = {
                'preview': '', 'timestamp': None,
                'from_me': False, 'unread': row['count'],
                'has_market_thread': False,
            }

    # Market thread flag — any conversation with a commercial related_status
    market_contacts = (
        Message.objects
        .filter(
            Q(sender=me, cleared_by_sender=False) | Q(recipient=me, cleared_by_recipient=False),
            related_status__isnull=False,
            related_status__is_commercial=True,
        )
        .values_list('sender__username', 'recipient__username')
        .distinct()
    )
    for sender_u, recipient_u in market_contacts:
        other = recipient_u if sender_u == me.username else sender_u
        if other in previews:
            previews[other]['has_market_thread'] = True

    return JsonResponse(previews)


# ─── Send ──────────────────────────────────────────────────────────────────

@csrf_exempt
@login_required
def send_message_http(request):
    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "Method not allowed."}, status=405)

    recipient_username       = request.POST.get("recipient", "").strip()
    message_text             = request.POST.get("message", "").strip()
    files                    = request.FILES.getlist("files")
    forward_attachment_ids   = request.POST.get("forward_attachment_ids", "")

    if not recipient_username:
        return JsonResponse({"status": "error", "message": "recipient is required."}, status=400)
    if not message_text and not files and not forward_attachment_ids:
        return JsonResponse({"status": "error", "message": "message or attachment required."}, status=400)

    try:
        recipient = CustomUser.objects.get(username=recipient_username)
    except CustomUser.DoesNotExist:
        return JsonResponse({"status": "error", "message": "Recipient not found."}, status=404)

    # ── Reply context ──────────────────────────────────────────────────
    reply_to_id  = request.POST.get('reply_to', '').strip()
    reply_sender = request.POST.get('reply_sender', '').strip()[:150]
    reply_text   = request.POST.get('reply_text', '').strip()[:500]
    reply_media  = request.POST.get('reply_media', '').strip()[:500]

    reply_to_obj = None
    if reply_to_id:
        try:
            reply_to_obj = Message.objects.get(id=int(reply_to_id))
        except (Message.DoesNotExist, ValueError):
            pass

    # Auto-fill reply media from the quoted message's own attachment
    if reply_to_obj and not reply_media:
        first_att = reply_to_obj.attachments.first()
        if first_att:
            reply_media = (_get_file_url(first_att.file) or '')[:500]
            if not reply_text:
                ft = (first_att.file_type or '').lower()
                if ft.startswith('image/'):   reply_text = '📷 Photo'
                elif ft.startswith('video/'): reply_text = '🎬 Video'
                elif ft.startswith('audio/'): reply_text = '🎵 Audio'
                else: reply_text = '📎 ' + (first_att.original_filename or 'File')

    # ── Status reply — real FK + thumbnail ────────────────────────────
    is_status_reply    = request.POST.get('is_status_reply', '').strip() == 'true'
    status_id_raw      = request.POST.get('status_id', '').strip()
    related_status_obj = None
    if is_status_reply and status_id_raw:
        try:
            s_obj              = UserStatus.objects.get(id=int(status_id_raw))
            related_status_obj = s_obj
            reply_media        = _get_file_url(s_obj.media) or reply_media
            reply_sender       = s_obj.user.username
            if not reply_text:
                reply_text = s_obj.caption or '(status)'
        except (UserStatus.DoesNotExist, ValueError):
            pass

    msg = Message.objects.create(
        sender         = request.user,
        recipient      = recipient,
        message        = message_text,
        is_read        = False,
        reply_to_msg   = reply_to_obj,
        reply_sender   = reply_sender,
        reply_text     = reply_text,
        reply_media    = reply_media,
        related_status = related_status_obj,
    )

    saved_attachments = []

    # ── Upload new files ───────────────────────────────────────────────
    for f in files:
        ft = f.content_type or mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        try:
            att = Attachment.objects.create(
                message=msg, file=f, file_type=ft, original_filename=f.name
            )
            url = _get_file_url(att.file)
            if url:
                saved_attachments.append({
                    "id": att.id, "file_url": url,
                    "file_name": f.name, "file_type": ft,
                })
        except Exception as e:
            logger.error(f"Attachment upload failed: {e}", exc_info=True)

    # ── Forward existing attachments ───────────────────────────────────
    for raw_id in forward_attachment_ids.split(","):
        raw_id = raw_id.strip()
        if not raw_id:
            continue
        try:
            original = Attachment.objects.get(id=raw_id)
        except Attachment.DoesNotExist:
            continue
        try:
            original_url = _get_file_url(original.file)
            if not original_url:
                logger.warning(f"Forward attachment {raw_id}: no URL.")
                continue

            file_bytes, _ = _fetch_file_bytes(original_url)
            if not file_bytes:
                logger.warning(f"Forward attachment {raw_id}: download failed.")
                continue

            upload_result = cloudinary.uploader.upload(
                io.BytesIO(file_bytes), resource_type='auto'
            )
            new_public_id = upload_result.get('public_id')
            if not new_public_id:
                logger.warning(f"Forward attachment {raw_id}: no public_id from Cloudinary.")
                continue

            new_att = Attachment.objects.create(
                message=msg,
                file=new_public_id,
                file_type=original.file_type,
                original_filename=original.original_filename,
            )
            url = _get_file_url(new_att.file)
            if url:
                saved_attachments.append({
                    "id": new_att.id, "file_url": url,
                    "file_name": original.original_filename or _get_cloudinary_filename(original.file),
                    "file_type": original.file_type,
                })
        except Exception as e:
            logger.error(f"Forward attachment failed: {e}", exc_info=True)

    response_payload = {
        "status":  "success",
        "message": _serialize_message(msg, viewer=request.user),
    }

    # ── Web Push (best-effort) ─────────────────────────────────────────
    try:
        if message_text:
            preview = message_text[:80]
        elif saved_attachments:
            preview = '📎 Attachment'
        else:
            preview = 'New message'
        send_push_notification(
            user=recipient,
            title=request.user.username,
            body=preview,
            url=f'/?chat={request.user.username}',
            tag=f'chat-{request.user.username}',
        )
    except Exception:
        pass

    return JsonResponse(response_payload)


# ─── Delete / clear ────────────────────────────────────────────────────────

@login_required
@require_http_methods(["DELETE"])
def delete_message(request, message_id):
    try:
        msg = Message.objects.get(id=message_id)
    except Message.DoesNotExist:
        return JsonResponse({"status": "error", "message": "Message not found."}, status=404)

    if request.user not in (msg.sender, msg.recipient):
        return JsonResponse({"status": "error", "message": "Permission denied."}, status=403)

    if request.user == msg.sender:
        msg.cleared_by_sender = True
    else:
        msg.cleared_by_recipient = True
    msg.save()

    return JsonResponse({"status": "success"})


@csrf_exempt
@login_required
def clear_chat(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    recipient_username = data.get("recipient_id", "").strip()
    if not recipient_username:
        return JsonResponse({"error": "recipient_id is required."}, status=400)

    try:
        recipient = CustomUser.objects.get(username=recipient_username)
    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "Recipient not found."}, status=404)

    Message.objects.filter(sender=request.user, recipient=recipient).update(cleared_by_sender=True)
    Message.objects.filter(sender=recipient, recipient=request.user).update(cleared_by_recipient=True)

    return JsonResponse({"message": "Chat cleared."})