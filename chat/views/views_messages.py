"""
views_messages.py — All message endpoints:
  get_messages, send_message_http, poll_messages,
  mark_messages_as_read, get_unread_message_count,
  get_conversation_previews, delete_message, clear_chat.
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
    _fetch_file_bytes, _serialize_message,
)
from ..push_utils import send_push_notification

User    = get_user_model()
logger  = logging.getLogger(__name__)


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
    Powers unread badge + preview without a full page reload.
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
        }

    unread_rows = (
        Message.objects
        .filter(recipient=me, is_read=False)
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
            }

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

    # ── Web Push (best-effort, never affects the response above) ───────
    # Placed after the message + attachments are fully saved and the
    # success payload is already built, so a push failure here can never
    # turn a successful send into an error response.
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
        pass  # send_push_notification already never raises — belt and braces.

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