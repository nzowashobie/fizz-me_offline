#!/usr/bin/env python
# modularize_views.py
# Run this script once to split views.py into a modular views/ folder.
# It does not change any business logic – only file organisation.

import os
import shutil
from pathlib import Path

# -------- Helper to write a file (ensuring folder exists) ----------
def write_file(path, content):
    Path(os.path.dirname(path)).mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Created {path}")

# -------- Define the content for each new module ----------

# 1. views_utils.py
UTILS = '''"""
views_utils.py – shared helpers
"""
import os
import logging
import re
from urllib.parse import urlparse
from django.conf import settings
from .models import Contact, EventInvitee

logger = logging.getLogger(__name__)

def _utc_iso(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

def _profile_pic(user):
    try:
        pp = user.profile.profile_picture
        pid = getattr(pp, 'public_id', None) or getattr(pp, 'name', None)
        if pid:
            url = pp.url
            if url and url.startswith('http://'):
                url = url.replace('http://', 'https://', 1)
            return url or ''
    except Exception:
        pass
    return ''

def _get_file_url(file_field):
    try:
        if file_field:
            url = file_field.url
            if url and url.startswith('http://'):
                url = url.replace('http://', 'https://', 1)
            return url or ''
    except Exception:
        pass
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
    import urllib.request
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'AsterixChat/1.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            content_type = resp.headers.get('Content-Type', 'application/octet-stream').split(';')[0].strip()
            return data, content_type
    except Exception as e:
        logger.error(f"_fetch_file_bytes failed for {url}: {e}")
        return None, None

def _can_view_event(user, event):
    from .models import Contact
    if event.host == user:
        return True
    if event.visibility == 'public':
        return True
    if event.visibility == 'contacts':
        return Contact.objects.filter(owner=event.host, contact_user=user).exists()
    if event.visibility == 'invite_only':
        return EventInvitee.objects.filter(event=event, user=user).exists()
    return False

_OFFICE_MIME_MAP = {
    'pdf':  'application/pdf',
    'doc':  'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls':  'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt':  'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

def _fix_content_type(filename, content_type):
    if content_type in ('application/octet-stream', 'binary/octet-stream'):
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        return _OFFICE_MIME_MAP.get(ext, content_type)
    return content_type
'''

# 2. views_auth.py
AUTH = '''"""
views_auth.py – signup, login, public key
"""
import json
import logging
from django.contrib.auth import login, get_user_model
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render, redirect
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from ..forms import SignUpForm
from ..models import CustomUser, Contact
from .views_utils import _profile_pic

User = get_user_model()
logger = logging.getLogger(__name__)

def signup_view(request):
    if request.method == "POST":
        form = SignUpForm(request.POST, request.FILES)
        if form.is_valid():
            user = form.save()
            private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            public_key = private_key.public_key()
            public_pem = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode()
            private_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            ).decode()
            user.public_key = public_pem
            user.save()
            login(request, user)
            request.session['_tmp_private_key'] = private_pem
            return redirect("chat-page")
    else:
        form = SignUpForm()
    return render(request, "signup.html", {"form": form})

@login_required
def chat_view(request):
    contact_ids = Contact.objects.filter(owner=request.user).values_list('contact_user_id', flat=True)
    users = User.objects.filter(id__in=contact_ids).exclude(id=request.user.id)
    private_key = request.session.pop('_tmp_private_key', None)
    return render(request, 'index.html', {'users': users, 'private_key': private_key})

@login_required
def get_public_key(request):
    username = request.GET.get('username', '').strip()
    try:
        user = CustomUser.objects.get(username=username)
    except CustomUser.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    if not user.public_key:
        return JsonResponse({'error': 'No public key registered for this user'}, status=404)
    return JsonResponse({'username': username, 'public_key': user.public_key})
'''

# 3. views_messages.py
MESSAGES = '''"""
views_messages.py – message endpoints
"""
import json
import logging
import mimetypes
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from ..models import CustomUser, Message, Attachment, UserStatus
from .views_utils import _utc_iso, _profile_pic, _get_file_url, _get_cloudinary_filename, _fetch_file_bytes

User = CustomUser
logger = logging.getLogger(__name__)

@login_required
def get_messages(request):
    recipient_username = request.GET.get('recipient', '').strip()
    if not recipient_username:
        return JsonResponse({'error': 'recipient is required'}, status=400)
    recipient = get_object_or_404(User, username=recipient_username)
    qs = Message.objects.filter(
        Q(sender=request.user, recipient=recipient, cleared_by_sender=False) |
        Q(sender=recipient, recipient=request.user, cleared_by_recipient=False)
    ).select_related('sender', 'recipient').prefetch_related('attachments')
    after_id_raw = request.GET.get('after_id', '').strip()
    if after_id_raw:
        try:
            after_id = int(after_id_raw)
            qs = qs.filter(id__gt=after_id)
        except (ValueError, TypeError):
            return JsonResponse({'error': 'after_id must be an integer'}, status=400)
    qs = qs.order_by('timestamp')
    try:
        return JsonResponse([_serialize_message(m) for m in qs], safe=False)
    except Exception as e:
        logger.error(f"get_messages serialisation error: {e}", exc_info=True)
        return JsonResponse({'error': 'Could not load messages.'}, status=500)

@login_required
def mark_messages_as_read(request):
    sender_username = request.GET.get('sender', '').strip() or request.POST.get('sender', '').strip()
    try:
        sender = User.objects.get(username=sender_username)
    except User.DoesNotExist:
        return JsonResponse({"error": "Sender not found"}, status=404)
    updated = Message.objects.filter(recipient=request.user, sender=sender, is_read=False).update(is_read=True)
    return JsonResponse({"status": "success", "marked": updated})

@login_required
def get_unread_message_count(request):
    rows = Message.objects.filter(recipient=request.user, is_read=False).values('sender__username').annotate(count=Count('id'))
    return JsonResponse({row['sender__username']: row['count'] for row in rows})

@login_required
def get_conversation_previews(request):
    me = request.user
    qs = Message.objects.filter(
        Q(sender=me, cleared_by_sender=False) |
        Q(recipient=me, cleared_by_recipient=False)
    ).filter(Q(sender=me) | Q(recipient=me)).select_related('sender', 'recipient').prefetch_related('attachments').order_by('-timestamp')
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
            'preview': text,
            'timestamp': _utc_iso(m.timestamp),
            'from_me': m.sender_id == me.id,
            'unread': 0,
        }
    unread_rows = Message.objects.filter(recipient=me, is_read=False).values('sender__username').annotate(count=Count('id'))
    for row in unread_rows:
        who = row['sender__username']
        if who in previews:
            previews[who]['unread'] = row['count']
        else:
            previews[who] = {'preview': '', 'timestamp': None, 'from_me': False, 'unread': row['count']}
    return JsonResponse(previews)

@csrf_exempt
@login_required
def send_message_http(request):
    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "Method not allowed."}, status=405)
    recipient_username = request.POST.get("recipient", "").strip()
    message_text = request.POST.get("message", "").strip()
    files = request.FILES.getlist("files")
    forward_attachment_ids = request.POST.get("forward_attachment_ids", "")
    if not recipient_username:
        return JsonResponse({"status": "error", "message": "recipient is required."}, status=400)
    if not message_text and not files and not forward_attachment_ids:
        return JsonResponse({"status": "error", "message": "message or attachment required."}, status=400)
    try:
        recipient = CustomUser.objects.get(username=recipient_username)
    except CustomUser.DoesNotExist:
        return JsonResponse({"status": "error", "message": "Recipient not found."}, status=404)
    reply_to_id = request.POST.get('reply_to', '').strip()
    reply_sender = request.POST.get('reply_sender', '').strip()[:150]
    reply_text = request.POST.get('reply_text', '').strip()[:500]
    reply_media = request.POST.get('reply_media', '').strip()[:500]
    reply_to_obj = None
    if reply_to_id:
        try:
            reply_to_obj = Message.objects.get(id=int(reply_to_id))
        except (Message.DoesNotExist, ValueError):
            pass
    if reply_to_obj and not reply_media:
        first_att = reply_to_obj.attachments.first()
        if first_att:
            reply_media = (_get_file_url(first_att.file) or '')[:500]
            if not reply_text:
                ft = (first_att.file_type or '').lower()
                if ft.startswith('image/'):
                    reply_text = '📷 Photo'
                elif ft.startswith('video/'):
                    reply_text = '🎬 Video'
                elif ft.startswith('audio/'):
                    reply_text = '🎵 Audio'
                else:
                    reply_text = '📎 ' + (first_att.original_filename or 'File')
    is_status_reply = request.POST.get('is_status_reply', '').strip() == 'true'
    status_id_raw = request.POST.get('status_id', '').strip()
    related_status_obj = None
    if is_status_reply and status_id_raw:
        try:
            s_obj = UserStatus.objects.get(id=int(status_id_raw))
            related_status_obj = s_obj
            reply_media = _get_file_url(s_obj.media) or reply_media
            reply_sender = s_obj.user.username
            if not reply_text:
                reply_text = s_obj.caption or '(status)'
        except (UserStatus.DoesNotExist, ValueError):
            pass
    msg = Message.objects.create(
        sender=request.user,
        recipient=recipient,
        message=message_text,
        is_read=False,
        reply_to_msg=reply_to_obj,
        reply_sender=reply_sender,
        reply_text=reply_text,
        reply_media=reply_media,
        related_status=related_status_obj,
    )
    saved_attachments = []
    for f in files:
        ft = f.content_type or mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        try:
            att = Attachment.objects.create(
                message=msg,
                file=f,
                file_type=ft,
                original_filename=f.name
            )
            url = _get_file_url(att.file)
            if url:
                saved_attachments.append({
                    "id": att.id,
                    "file_url": url,
                    "file_name": f.name,
                    "file_type": ft,
                })
        except Exception as e:
            logger.error(f"Attachment upload failed: {e}", exc_info=True)
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
                logger.warning(f"Forward attachment {raw_id}: no URL for original file.")
                continue
            file_bytes, _fetched_ct = _fetch_file_bytes(original_url)
            if not file_bytes:
                logger.warning(f"Forward attachment {raw_id}: could not download original bytes from {original_url}.")
                continue
            import io
            import cloudinary.uploader
            upload_result = cloudinary.uploader.upload(
                io.BytesIO(file_bytes),
                resource_type='auto',
            )
            new_public_id = upload_result.get('public_id')
            if not new_public_id:
                logger.warning(f"Forward attachment {raw_id}: Cloudinary re-upload returned no public_id.")
                continue
            fname = original.original_filename or _get_cloudinary_filename(original.file)
            new_att = Attachment.objects.create(
                message=msg,
                file=new_public_id,
                file_type=original.file_type,
                original_filename=original.original_filename,
            )
            url = _get_file_url(new_att.file)
            if url:
                saved_attachments.append({
                    "id": new_att.id,
                    "file_url": url,
                    "file_name": original.original_filename or fname,
                    "file_type": original.file_type,
                })
            else:
                logger.warning(f"Forward attachment {raw_id}: new attachment {new_att.id} has no resolvable URL.")
        except Exception as e:
            logger.error(f"Forward attachment failed: {e}", exc_info=True)
    return JsonResponse({
        "status": "success",
        "message": _serialize_message(msg),
    })

@login_required
@require_http_methods(["DELETE"])
def delete_message(request, message_id):
    try:
        msg = Message.objects.get(id=message_id)
    except Message.DoesNotExist:
        return JsonResponse({"status": "error", "message": "Message not found."}, status=404)
    if request.user != msg.sender and request.user != msg.recipient:
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

@login_required
def poll_messages(request):
    recipient_username = request.GET.get('recipient', '').strip()
    after_id_raw = request.GET.get('after_id', '0').strip()
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
    qs = Message.objects.filter(
        Q(sender=request.user, recipient=recipient, cleared_by_sender=False) |
        Q(sender=recipient, recipient=request.user, cleared_by_recipient=False)
    ).filter(id__gt=after_id).select_related('sender', 'recipient').prefetch_related('attachments').order_by('id')
    try:
        return JsonResponse([_serialize_message(m) for m in qs], safe=False)
    except Exception as e:
        logger.error(f"poll_messages error: {e}", exc_info=True)
        return JsonResponse([], safe=False)

def _serialize_message(msg):
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
            related_status_data = {
                "id": rs.id,
                "status_id": rs.id,
                "username": rs.user.username,
                "price": str(rs.price) if rs.price is not None else None,
                "is_negotiable": rs.is_negotiable,
                "availability": rs.availability,
                "caption": rs.caption or '',
                "media_url": _get_file_url(rs.media) or '',
                "product_category": rs.product_category or '',
                "collection_point": rs.collection_point or '',
                "is_commercial": rs.is_commercial,
            }
        except Exception:
            related_status_data = None
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
    }
'''

# 4. views_profile.py
PROFILE = '''"""
views_profile.py – profile picture & username
"""
import json
import re
import logging
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from ..models import Profile, CustomUser
from .views_utils import _profile_pic, _secure_url

logger = logging.getLogger(__name__)

@csrf_exempt
@login_required
def upload_profile_picture(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    if 'profile_picture' not in request.FILES:
        return JsonResponse({'error': 'No file provided'}, status=400)
    file = request.FILES['profile_picture']
    allowed_mime = {'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'}
    if file.content_type not in allowed_mime:
        return JsonResponse({'error': 'Only JPEG, PNG, WEBP, or GIF images are allowed.'}, status=400)
    try:
        profile = request.user.profile
    except Exception:
        profile, _ = Profile.objects.get_or_create(user=request.user)
    import cloudinary.uploader
    try:
        result = cloudinary.uploader.upload(
            file,
            folder='profile_pictures',
            resource_type='image',
            overwrite=True
        )
        public_id = result.get('public_id')
        url = result.get('secure_url') or result.get('url', '')
        if not public_id or not url:
            return JsonResponse({'error': 'Cloudinary upload succeeded but returned no valid URL.'}, status=500)
        profile.profile_picture = public_id
        profile.save()
        return JsonResponse({'profile_picture_url': _secure_url(url)})
    except Exception as e:
        logger.error(f'upload_profile_picture error: {e}', exc_info=True)
        return JsonResponse({'error': f'Upload failed: {str(e)}'}, status=500)

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def update_profile(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"status": "error", "message": "Invalid JSON."}, status=400)
    new_username = data.get("username", "").strip()
    if not new_username:
        return JsonResponse({"status": "error", "message": "Username cannot be empty."}, status=400)
    if len(new_username) > 150:
        return JsonResponse({"status": "error", "message": "Username too long (max 150 chars)."}, status=400)
    if not re.match(r'^[a-zA-Z0-9_ ]*$', new_username):
        return JsonResponse({"status": "error", "message": "Username may only contain letters, digits, spaces, and underscores."}, status=400)
    if CustomUser.objects.exclude(pk=request.user.pk).filter(username=new_username).exists():
        return JsonResponse({"status": "error", "message": "That username is already taken."}, status=409)
    request.user.username = new_username
    request.user.save(update_fields=["username"])
    return JsonResponse({
        "status": "success",
        "username": new_username,
        "profile_picture_url": _profile_pic(request.user) or '',
    })
'''

# 5. views_contacts.py
CONTACTS = '''"""
views_contacts.py – contact management
"""
import json
import logging
import phonenumbers
from phonenumbers import NumberParseException
from django.db.models import Q
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.timezone import now
from ..models import CustomUser, Contact, BlockedUser, Profile
from .views_utils import _profile_pic

logger = logging.getLogger(__name__)

def normalize_phone(number):
    import re
    if not number:
        return None
    digits = re.sub(r'[^\d+]', '', number)
    if not digits:
        return None
    if digits.startswith('+'):
        try:
            parsed = phonenumbers.parse(digits, None)
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except:
            return None
    if digits.startswith('0'):
        digits = digits[1:]
        try:
            parsed = phonenumbers.parse(digits, "ZM")
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except:
            pass
    if len(digits) == 9 and digits[0] in ('7', '9'):
        try:
            parsed = phonenumbers.parse(digits, "ZM")
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except:
            pass
    if len(digits) == 10 and digits[0] in ('7', '9'):
        try:
            parsed = phonenumbers.parse(digits, "ZM")
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except:
            pass
    try:
        parsed = phonenumbers.parse(digits, "US")
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except:
        return None

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def add_contact_by_phone(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"status": "error", "message": "Invalid JSON."}, status=400)
    phone_number = data.get("phone_number", "").strip()
    if not phone_number:
        return JsonResponse({"status": "error", "message": "phone_number is required."}, status=400)
    normalized = normalize_phone(phone_number)
    if normalized:
        phone_number = normalized
    try:
        target = CustomUser.objects.get(phone_number=phone_number)
    except CustomUser.DoesNotExist:
        return JsonResponse({
            "status": "not_registered",
            "message": f"No Asterix account is registered with {phone_number}. Invite them to sign up first.",
        }, status=404)
    except Exception as e:
        return JsonResponse({
            "status": "error",
            "message": f"Invalid phone number format: {str(e)}"
        }, status=400)
    if target.id == request.user.id:
        return JsonResponse({
            "status": "error",
            "message": "You cannot add yourself as a contact."
        }, status=403)
    contact, created = Contact.objects.get_or_create(owner=request.user, contact_user=target)
    if not created:
        return JsonResponse({
            "status": "already_exists",
            "message": f"{target.username} is already in your contacts.",
            "contact": {
                "id": target.id,
                "username": target.username,
                "profile_picture": _profile_pic(target),
                "phone_number": str(target.phone_number)
            }
        }, status=200)
    return JsonResponse({
        "status": "success",
        "message": f"{target.username} added to your contacts.",
        "contact": {
            "id": target.id,
            "username": target.username,
            "profile_picture": _profile_pic(target),
            "phone_number": str(target.phone_number)
        },
    }, status=201)

@login_required
def get_contact_info(request):
    username = request.GET.get('username', '').strip()
    if not username:
        return JsonResponse({"error": "username is required."}, status=400)
    try:
        target = CustomUser.objects.select_related('profile').get(username=username)
    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)
    if not Contact.objects.filter(owner=request.user, contact_user=target).exists():
        return JsonResponse({"error": "That user isn't in your contacts."}, status=403)
    online = False
    if target.last_seen:
        diff = now() - target.last_seen
        online = diff.total_seconds() < 30
    return JsonResponse({
        "username": target.username,
        "phone_number": str(target.phone_number),
        "profile_picture": _profile_pic(target),
        "online": online,
        "last_seen": target.last_seen.isoformat() if target.last_seen else None
    })

@login_required
def get_contact_info_by_phone(request):
    phone = request.GET.get('phone', '').strip()
    if not phone:
        return JsonResponse({"error": "phone required."}, status=400)
    try:
        target = CustomUser.objects.select_related('profile').get(phone_number=phone)
    except CustomUser.DoesNotExist:
        return JsonResponse({"registered": False}, status=404)
    return JsonResponse({
        "registered": True,
        "username": target.username,
        "phone_number": str(target.phone_number),
        "profile_picture": _profile_pic(target),
    })

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def check_phones_on_asterix(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    numbers = [str(n).strip() for n in data.get("phone_numbers", []) if n][:500]
    registered = {}
    if numbers:
        for u in CustomUser.objects.filter(phone_number__in=numbers).select_related('profile'):
            registered[str(u.phone_number)] = {
                "username": u.username,
                "profile_picture": _profile_pic(u),
            }
    return JsonResponse({"registered": registered})

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def block_user(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"status": "error", "message": "Invalid JSON."}, status=400)
    username = data.get("username", "").strip()
    if not username:
        return JsonResponse({"status": "error", "message": "username required."}, status=400)
    try:
        target = CustomUser.objects.get(username__iexact=username)
    except CustomUser.DoesNotExist:
        return JsonResponse({"status": "error", "message": "User not found."}, status=404)
    if target.id == request.user.id:
        return JsonResponse({"status": "error", "message": "You cannot block yourself."}, status=403)
    _, created = BlockedUser.objects.get_or_create(user=request.user, blocked_user=target)
    if not created:
        return JsonResponse({"status": "error", "message": f"{username} is already blocked."}, status=409)
    Contact.objects.filter(owner=request.user, contact_user=target).delete()
    return JsonResponse({"status": "success", "message": f"Blocked {username}."})

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def unblock_user(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"status": "error", "message": "Invalid JSON."}, status=400)
    username = data.get("username", "").strip()
    try:
        target = CustomUser.objects.get(username__iexact=username)
    except CustomUser.DoesNotExist:
        return JsonResponse({"status": "error", "message": "User not found."}, status=404)
    deleted, _ = BlockedUser.objects.filter(user=request.user, blocked_user=target).delete()
    if not deleted:
        return JsonResponse({"status": "error", "message": f"{username} was not blocked."}, status=404)
    return JsonResponse({"status": "success", "message": f"Unblocked {username}."})

@csrf_exempt
@login_required
def sync_contacts(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            phone_numbers = data.get('phone_numbers', [])
            normalized = []
            for num in phone_numbers:
                normalized_num = normalize_phone(num)
                if normalized_num:
                    normalized.append(normalized_num)
            matched_users = CustomUser.objects.filter(phone_number__in=normalized).exclude(id=request.user.id)
            count = 0
            for user in matched_users:
                _, created = Contact.objects.get_or_create(owner=request.user, contact_user=user)
                if created:
                    count += 1
            return JsonResponse({"status": "success", "added_contacts": count})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)
    return JsonResponse({"error": "Method not allowed"}, status=405)

@login_required
def get_my_contacts(request):
    contact_ids = Contact.objects.filter(owner=request.user).values_list('contact_user_id', flat=True)
    users = CustomUser.objects.filter(id__in=contact_ids).exclude(id=request.user.id).select_related('profile')
    return JsonResponse({
        "contacts": [
            {
                "id": u.id,
                "username": u.username,
                "phone_number": str(u.phone_number),
                "profile_picture": _profile_pic(u),
            }
            for u in users
        ]
    })

@login_required
def search_user(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({"error": "q is required."}, status=400)
    already_blocked = BlockedUser.objects.filter(
        Q(user=request.user) | Q(blocked_user=request.user)
    ).values_list('user_id', 'blocked_user_id')
    blocked_ids = {uid for pair in already_blocked for uid in pair}
    matches = CustomUser.objects.filter(Q(username__icontains=query) | Q(phone_number__icontains=query)).exclude(id=request.user.id).exclude(id__in=blocked_ids)[:10]
    return JsonResponse({
        "results": [
            {"id": u.id, "username": u.username, "phone_number": str(u.phone_number)}
            for u in matches
        ]
    })

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def add_contact(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"status": "error", "message": "Invalid JSON."}, status=400)
    username = data.get("username", "").strip()
    if not username:
        return JsonResponse({"status": "error", "message": "username is required."}, status=400)
    try:
        target = CustomUser.objects.get(username__iexact=username)
    except CustomUser.DoesNotExist:
        return JsonResponse({
            "status": "not_registered",
            "message": f"{username} hasn't joined Asterix yet. Invite them to sign up first.",
        }, status=404)
    if target.id == request.user.id:
        return JsonResponse({"status": "error", "message": "You cannot add yourself."}, status=403)
    _, created = Contact.objects.get_or_create(owner=request.user, contact_user=target)
    if not created:
        return JsonResponse({"status": "error", "message": f"{target.username} is already in your contacts."}, status=409)
    return JsonResponse({
        "status": "success",
        "message": f"{target.username} added to your contacts.",
        "contact": {
            "id": target.id,
            "username": target.username,
            "profile_picture": _profile_pic(target),
        },
    })

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def remove_contact(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"status": "error", "message": "Invalid JSON."}, status=400)
    username = data.get("username", "").strip()
    if not username:
        return JsonResponse({"status": "error", "message": "username is required."}, status=400)
    try:
        target = CustomUser.objects.get(username__iexact=username)
    except CustomUser.DoesNotExist:
        return JsonResponse({"status": "error", "message": "User not found."}, status=404)
    deleted, _ = Contact.objects.filter(owner=request.user, contact_user=target).delete()
    if not deleted:
        return JsonResponse({"status": "error", "message": f"{target.username} is not in your contacts."}, status=404)
    return JsonResponse({"status": "success", "message": f"Removed {target.username} from your contacts."})

@csrf_exempt
@login_required
def check_phones(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    phone_numbers = data.get('phones', [])
    if not phone_numbers:
        return JsonResponse({"error": "phones list is required."}, status=400)
    normalized_phones = []
    for num in phone_numbers:
        norm = normalize_phone(num)
        if norm:
            normalized_phones.append(norm)
    if not normalized_phones:
        return JsonResponse({"registered": {}, "unregistered": phone_numbers})
    registered_users = CustomUser.objects.filter(phone_number__in=normalized_phones).exclude(id=request.user.id)
    registered = {}
    for user in registered_users:
        registered[str(user.phone_number)] = {
            "username": user.username,
            "profile_picture": _profile_pic(user),
        }
    registered_numbers = set(registered.keys())
    unregistered = [num for num in phone_numbers if normalize_phone(num) not in registered_numbers]
    return JsonResponse({
        "registered": registered,
        "unregistered": unregistered,
    })
'''

# 6. views_status.py
STATUS = '''"""
views_status.py – status feed, upload, edit, delete
"""
import json
import logging
import base64
from datetime import timedelta
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.timezone import now
from ..models import StatusCategory, UserStatus, AdCampaign
from .views_utils import _utc_iso, _profile_pic, _get_file_url, _delete_file

logger = logging.getLogger(__name__)

@login_required
def get_categorized_status_feed(request, category_name):
    try:
        category, _ = StatusCategory.objects.get_or_create(name=category_name)
        threshold = now() - timedelta(hours=24)
        user_statuses = UserStatus.objects.filter(category=category, created_at__gte=threshold).select_related('user', 'user__profile').order_by('created_at')
        ad = AdCampaign.objects.filter(category=category, is_active=True).first()
        ad_media_url = _get_file_url(ad.media) if ad else None
        playlist = []
        for idx, status in enumerate(user_statuses):
            try:
                media_url = _get_file_url(status.media) or ''
                if not media_url:
                    continue
                item = {
                    'type': 'user_status',
                    'status_id': status.id,
                    'username': status.user.username,
                    'profile_picture': _profile_pic(status.user) or '',
                    'media_url': media_url,
                    'caption': status.caption or '',
                    'category': category.name,
                    'market_link': status.market_link or '',
                    'timestamp': _utc_iso(status.created_at),
                }
                if status.is_commercial:
                    item['is_commercial'] = True
                    item['price'] = str(status.price) if status.price is not None else None
                    item['is_negotiable'] = status.is_negotiable
                    item['availability'] = status.availability or 'available'
                    item['product_category'] = status.product_category or ''
                    item['custom_tag'] = status.custom_tag or ''
                    item['collection_point'] = status.collection_point or ''
                playlist.append(item)
                if ad and ad_media_url and (idx + 1) % 4 == 0:
                    playlist.append({
                        'type': 'advertisement',
                        'campaign_id': ad.id,
                        'advertiser': ad.advertiser_name,
                        'media_url': ad_media_url,
                        'action_url': ad.website_link,
                    })
            except Exception as e:
                logger.warning(f"Skipping status {status.id}: {e}")
                continue
        return JsonResponse({'category': category.name, 'playlist': playlist})
    except Exception as e:
        logger.error(f"get_categorized_status_feed failed: {e}", exc_info=True)
        return JsonResponse({'category': category_name, 'playlist': []})

@csrf_exempt
@login_required
def upload_status(request):
    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed."}, status=405)
    media_file = request.FILES.get('media')
    if not media_file:
        return JsonResponse({"error": "media file required."}, status=400)
    caption = request.POST.get('caption', '').strip()[:255]
    market_link = request.POST.get('market_link', '').strip()[:500] or None
    category_name = (request.POST.get('category') or 'General').strip()
    is_commercial = request.POST.get('is_commercial', '').strip() == 'true'
    price_raw = request.POST.get('price', '').strip()
    price = None
    if price_raw:
        try:
            price = float(price_raw)
            if price < 0:
                return JsonResponse({"error": "price cannot be negative."}, status=400)
        except ValueError:
            return JsonResponse({"error": "price must be a number."}, status=400)
    is_negotiable = request.POST.get('is_negotiable', '').strip() == 'true'
    availability = request.POST.get('availability', 'available').strip()
    if availability not in ('available', 'reserved', 'sold'):
        availability = 'available'
    valid_product_categories = {'clothing', 'shoes', 'cosmetics', 'bags', 'household', 'other'}
    product_category = request.POST.get('product_category', '').strip()
    if product_category and product_category not in valid_product_categories:
        product_category = 'other'
    custom_tag = request.POST.get('custom_tag', '').strip()[:50]
    collection_point = request.POST.get('collection_point', '').strip()[:255]
    try:
        category, _ = StatusCategory.objects.get_or_create(name=category_name)
        status = UserStatus.objects.create(
            user=request.user,
            category=category,
            media=media_file,
            caption=caption,
            market_link=market_link,
            is_commercial=is_commercial,
            price=price,
            is_negotiable=is_negotiable,
            availability=availability,
            product_category=product_category,
            custom_tag=custom_tag,
            collection_point=collection_point,
        )
        media_url = _get_file_url(status.media)
        return JsonResponse({
            "status": "success",
            "message": "Status live for 24 hours.",
            "status_id": status.id,
            "media_url": media_url or '',
            "caption": status.caption,
            "category": category.name,
            "timestamp": _utc_iso(status.created_at),
            "is_commercial": status.is_commercial,
            "price": str(status.price) if status.price is not None else None,
            "is_negotiable": status.is_negotiable,
            "availability": status.availability,
            "product_category": status.product_category,
            "custom_tag": status.custom_tag,
            "collection_point": status.collection_point,
        })
    except Exception as e:
        logger.error(f"Status upload failed: {e}", exc_info=True)
        return JsonResponse({"error": f"Upload failed: {str(e)}"}, status=500)

@csrf_exempt
@login_required
def share_status_to_external(request):
    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    status_id = data.get('status_id')
    if not status_id:
        return JsonResponse({"error": "status_id is required."}, status=400)
    try:
        status = UserStatus.objects.get(id=status_id)
    except UserStatus.DoesNotExist:
        return JsonResponse({"error": "Status not found."}, status=404)
    media_url = _get_file_url(status.media)
    if not media_url:
        return JsonResponse({"error": "No media found on this status."}, status=404)
    file_bytes, content_type = _fetch_file_bytes(media_url)
    if not file_bytes:
        return JsonResponse({"error": "Could not download media file."}, status=500)
    ext_map = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
        'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
        'video/webm': 'webm',
    }
    ext = ext_map.get(content_type, 'bin')
    filename = f"asterix_status_{status_id}.{ext}"
    return JsonResponse({
        "status": "success",
        "filename": filename,
        "content_type": content_type,
        "size_bytes": len(file_bytes),
        "file_b64": base64.b64encode(file_bytes).decode('utf-8'),
        "caption": status.caption or '',
    })

@login_required
def my_status_page(request):
    threshold = now() - timedelta(hours=24)
    statuses = UserStatus.objects.filter(user=request.user, created_at__gte=threshold).select_related('category').order_by('-created_at')
    grouped = {}
    for s in statuses:
        cat = s.category.name if s.category else 'General'
        media_url = _get_file_url(s.media)
        grouped.setdefault(cat, []).append({
            'status_id': s.id,
            'media_url': media_url,
            'caption': s.caption,
            'timestamp': _utc_iso(s.created_at),
            'expires_in_minutes': max(0, int((s.created_at + timedelta(hours=24) - now()).total_seconds() // 60)),
            'market_link': s.market_link,
        })
    categories = list(StatusCategory.objects.values('id', 'name', 'icon'))
    return JsonResponse({"my_statuses": grouped, "categories": categories})

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def edit_status(request, status_id):
    try:
        status = UserStatus.objects.get(id=status_id, user=request.user)
    except UserStatus.DoesNotExist:
        return JsonResponse({'error': 'Status not found or not yours.'}, status=404)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    caption = data.get('caption', '').strip()
    if len(caption) > 255:
        return JsonResponse({'error': 'Caption too long (max 255 chars).'}, status=400)
    status.caption = caption
    status.save(update_fields=['caption'])
    return JsonResponse({'status': 'success', 'caption': caption})

def delete_status(request, status_id):
    if request.method not in ('POST', 'DELETE'):
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        status = UserStatus.objects.get(id=status_id, user=request.user)
    except UserStatus.DoesNotExist:
        return JsonResponse({"error": "Not found or not yours."}, status=404)
    _delete_file(status.media)
    status.delete()
    return JsonResponse({"status": "success", "message": "Status deleted."})
'''

# 7. views_events.py
EVENTS = '''"""
views_events.py – Zambian events (weddings, etc.)
"""
import json
import logging
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.timezone import now
from django.core.files.base import ContentFile
from django.utils.dateparse import parse_datetime, parse_date
from ..models import ZambianEvent, EventInvitee, EventStatusShare, StatusCategory, Contact
from .views_utils import _utc_iso, _get_file_url, _can_view_event

logger = logging.getLogger(__name__)

@login_required
def my_events(request):
    events = ZambianEvent.objects.filter(host=request.user).order_by('-created_at')
    return JsonResponse({
        "events": [
            {
                "id": e.id,
                "title": e.title,
                "event_date": e.event_date.isoformat(),
                "cover_photo": _get_file_url(e.cover_photo),
                "invite_url": request.build_absolute_uri(f"/events/invite/{e.invite_token}/"),
                "visibility": e.visibility,
            }
            for e in events
        ]
    })

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def create_event(request):
    try:
        event_type = request.POST.get('event_type', 'wedding').strip()
        title = request.POST.get('title', '').strip()
        description = request.POST.get('description', '').strip()
        venue = request.POST.get('venue', '').strip()
        event_date = request.POST.get('event_date', '').strip()
        visibility = request.POST.get('visibility', 'invite_only').strip()
        dress_code = request.POST.get('dress_code', '').strip()
        rsvp_str = request.POST.get('rsvp_deadline', '').strip()
        bride_name = request.POST.get('bride_name', '').strip()
        groom_name = request.POST.get('groom_name', '').strip()
        family_contact = request.POST.get('family_contact', '').strip()
        family_phone = request.POST.get('family_phone', '').strip()
        cover_photo = request.FILES.get('cover_photo')
        if not title:
            return JsonResponse({"error": "title is required."}, status=400)
        if not event_date:
            return JsonResponse({"error": "event_date is required."}, status=400)
        parsed_date = parse_datetime(event_date)
        if parsed_date and timezone.is_naive(parsed_date):
            parsed_date = timezone.make_aware(parsed_date)
        rsvp_deadline = parse_date(rsvp_str) if rsvp_str else None
        valid_types = [c[0] for c in ZambianEvent.EVENT_TYPES]
        if event_type not in valid_types:
            event_type = 'other'
        valid_vis = [c[0] for c in ZambianEvent.VISIBILITY_CHOICES]
        if visibility not in valid_vis:
            visibility = 'invite_only'
        event = ZambianEvent.objects.create(
            host=request.user,
            event_type=event_type,
            title=title,
            description=description,
            venue=venue,
            event_date=parsed_date,
            visibility=visibility,
            dress_code=dress_code,
            rsvp_deadline=rsvp_deadline,
            bride_name=bride_name,
            groom_name=groom_name,
            family_contact=family_contact,
            family_phone=family_phone,
            cover_photo=cover_photo,
        )
        invite_url = request.build_absolute_uri(f"/events/invite/{event.invite_token}/")
        return JsonResponse({
            "status": "success",
            "event_id": event.id,
            "invite_url": invite_url,
            "invite_token": str(event.invite_token),
            "cover_photo": _get_file_url(event.cover_photo) or '',
            "message": "Event created! Share the invite link with your guests.",
        }, status=201)
    except Exception as e:
        logger.error(f"create_event failed: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def invite_to_event(request, event_id):
    event = get_object_or_404(ZambianEvent, id=event_id)
    if event.host != request.user:
        return JsonResponse({"error": "Only the event host can invite guests."}, status=403)
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    usernames = data.get('usernames', [])
    if not usernames:
        return JsonResponse({"error": "usernames list is required."}, status=400)
    added, already, not_found = [], [], []
    for uname in usernames:
        uname = uname.strip()
        try:
            target = CustomUser.objects.get(username__iexact=uname)
        except CustomUser.DoesNotExist:
            not_found.append(uname)
            continue
        _, created = EventInvitee.objects.get_or_create(event=event, user=target)
        if created:
            added.append(uname)
        else:
            already.append(uname)
    return JsonResponse({
        "status": "success",
        "added": added,
        "already_invited": already,
        "not_found": not_found,
    })

@login_required
def event_invite_view(request, invite_token):
    event = get_object_or_404(ZambianEvent, invite_token=invite_token)
    if event.visibility != 'public' and not _can_view_event(request.user, event):
        return JsonResponse({
            "error": "You are not on the guest list for this event.",
            "event_title": event.title,
        }, status=403)
    rsvp_status = None
    try:
        invitee = EventInvitee.objects.get(event=event, user=request.user)
        rsvp_status = invitee.rsvp
    except EventInvitee.DoesNotExist:
        pass
    return JsonResponse({
        "event_id": event.id,
        "event_type": event.get_event_type_display(),
        "title": event.title,
        "description": event.description,
        "venue": event.venue,
        "event_date": _utc_iso(event.event_date),
        "dress_code": event.dress_code,
        "rsvp_deadline": str(event.rsvp_deadline) if event.rsvp_deadline else None,
        "bride_name": event.bride_name,
        "groom_name": event.groom_name,
        "family_contact": event.family_contact,
        "family_phone": event.family_phone,
        "host": event.host.username,
        "cover_photo": _get_file_url(event.cover_photo) or '',
        "visibility": event.visibility,
        "your_rsvp": rsvp_status,
        "invite_token": str(event.invite_token),
    })

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def rsvp_event(request, event_id):
    event = get_object_or_404(ZambianEvent, id=event_id)
    if not _can_view_event(request.user, event):
        return JsonResponse({"error": "You are not on the guest list for this event."}, status=403)
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)
    rsvp = data.get('rsvp', '').strip()
    valid_rsvps = ['accepted', 'declined', 'maybe']
    if rsvp not in valid_rsvps:
        return JsonResponse({"error": f"rsvp must be one of: {', '.join(valid_rsvps)}"}, status=400)
    invitee, _ = EventInvitee.objects.get_or_create(event=event, user=request.user)
    invitee.rsvp = rsvp
    invitee.responded_at = now()
    invitee.save(update_fields=['rsvp', 'responded_at'])
    return JsonResponse({
        "status": "success",
        "rsvp": rsvp,
        "message": f"Your RSVP has been recorded as '{rsvp}'.",
    })

@login_required
def get_my_events(request):
    hosting = ZambianEvent.objects.filter(host=request.user).order_by('-event_date')
    invited = ZambianEvent.objects.filter(invitees__user=request.user).exclude(host=request.user).order_by('-event_date')
    def _serialize_event(event, role):
        return {
            "event_id": event.id,
            "role": role,
            "event_type": event.get_event_type_display(),
            "title": event.title,
            "venue": event.venue,
            "event_date": _utc_iso(event.event_date),
            "cover_photo": _get_file_url(event.cover_photo) or '',
            "visibility": event.visibility,
            "invite_url": request.build_absolute_uri(f"/events/invite/{event.invite_token}/"),
        }
    return JsonResponse({
        "hosting": [_serialize_event(e, "host") for e in hosting],
        "invited": [_serialize_event(e, "invitee") for e in invited],
    })

@csrf_exempt
@login_required
def share_event_to_status(request, event_id):
    try:
        event = ZambianEvent.objects.get(id=event_id, host=request.user)
    except ZambianEvent.DoesNotExist:
        return JsonResponse({"error": "Event not found or no permission."}, status=404)
    if EventStatusShare.objects.filter(event=event).exists():
        return JsonResponse({"error": "Already shared to status."}, status=400)
    category, _ = StatusCategory.objects.get_or_create(name="Weddings")
    parts = [f"💍 {event.title}"]
    if event.bride_name and event.groom_name:
        parts.append(f"💕 {event.bride_name} & {event.groom_name}")
    if event.venue:
        parts.append(f"📍 {event.venue}")
    if event.event_date:
        parts.append(f"📅 {event.event_date.strftime('%B %d, %Y at %I:%M %p')}")
    if event.dress_code:
        parts.append(f"👗 {event.dress_code}")
    caption = "\n".join(parts)[:255]
    invite_url = request.build_absolute_uri(f"/events/invite/{event.invite_token}/")
    media_file = None
    cover_url = _get_file_url(event.cover_photo) if event.cover_photo else None
    if cover_url:
        try:
            import requests
            r = requests.get(cover_url, timeout=30)
            if r.status_code == 200:
                ct = r.headers.get('content-type', 'image/jpeg').split(';')[0].strip()
                ext = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}.get(ct, 'jpg')
                media_file = ContentFile(r.content, name=f'event-{event.id}.{ext}')
        except Exception as e:
            logger.warning(f"Could not download cover photo: {e}")
    if media_file is None:
        def _x(s):
            return (s or '')[:50].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        formatted_date = event.event_date.strftime('%B %d, %Y') if event.event_date else ''
        svg_str = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">'
            '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">'
            '<stop offset="0%" style="stop-color:#880e4f"/>'
            '<stop offset="50%" style="stop-color:#c62828"/>'
            '<stop offset="100%" style="stop-color:#4a148c"/>'
            '</linearGradient></defs>'
            '<rect width="800" height="400" fill="url(#g)"/>'
            f'<text x="400" y="150" font-size="28" font-weight="bold" text-anchor="middle" fill="white">{_x(event.title)}</text>'
            f'<text x="400" y="210" font-size="20" text-anchor="middle" fill="rgba(255,255,255,0.85)">{_x(event.venue)}</text>'
            f'<text x="400" y="260" font-size="18" text-anchor="middle" fill="rgba(255,255,255,0.7)">{_x(formatted_date)}</text>'
            '</svg>'
        )
        media_file = ContentFile(svg_str.encode('utf-8'), name=f'event-{event.id}.svg')
    status = UserStatus.objects.create(
        user=request.user,
        category=category,
        media=media_file,
        caption=caption,
        market_link=invite_url,
    )
    EventStatusShare.objects.create(event=event, status=status, shared_by=request.user)
    return JsonResponse({
        "status": "success",
        "message": "Event shared to Weddings status for 24 hours!",
        "status_id": status.id,
        "media_url": _get_file_url(status.media) or '',
    })

@login_required
def event_guest_list(request, event_id):
    event = get_object_or_404(ZambianEvent, id=event_id)
    if event.host != request.user:
        return JsonResponse({"error": "Only the host can view the guest list."}, status=403)
    invitees = EventInvitee.objects.filter(event=event).select_related('user')
    return JsonResponse({
        "event_id": event.id,
        "title": event.title,
        "total_invited": invitees.count(),
        "accepted": invitees.filter(rsvp='accepted').count(),
        "declined": invitees.filter(rsvp='declined').count(),
        "maybe": invitees.filter(rsvp='maybe').count(),
        "pending": invitees.filter(rsvp='pending').count(),
        "guests": [
            {
                "username": inv.user.username,
                "profile_picture": _profile_pic(inv.user),
                "rsvp": inv.rsvp,
                "invited_at": _utc_iso(inv.invited_at),
                "responded_at": _utc_iso(inv.responded_at) if inv.responded_at else None,
            }
            for inv in invitees
        ],
    })
'''

# 8. views_commerce.py – this is large; we'll include it in full.
COMMERCE = '''"""
views_commerce.py – offers, deals, delivery, ratings, listing extensions
"""
import json
import logging
from decimal import Decimal
from datetime import timedelta
from django.db import transaction
from django.db.models import Avg, Count, Q
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST
from django.utils.timezone import now
from ..models import Offer, Deal, DeliveryTracking, SellerRating, ListingBump, UserStatus, Message
from .views_utils import _utc_iso

logger = logging.getLogger(__name__)

# ─── Stage constants ──────────────────────────────────────────────
_STAGE_ORDER = [
    'order_placed', 'seller_confirmed', 'in_transit',
    'delivered', 'payment_released',
]
_STAGE_ACTOR = {
    'seller_confirmed':  'seller',
    'in_transit':        'seller',
    'delivered':         'buyer',
    'payment_released':  'buyer',
    'disputed':          'both',
}
_STAGE_LABELS = {
    'seller_confirmed':  '✅ Seller confirmed the item is ready',
    'in_transit':        '🚚 Item is on its way',
    'delivered':         '📬 Buyer confirmed delivery',
    'payment_released':  '💰 Payment released — deal closed!',
    'disputed':          '⚠️ A dispute has been raised. Resolve via chat.',
}
_MAX_FREE_BUMPS_PER_DAY = 1
_MAX_EXTENSIONS         = 3

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def create_offer(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    status_id = data.get('status_id')
    amount = data.get('amount')
    if not status_id:
        return JsonResponse({"error": "status_id required"}, status=400)
    if not amount:
        return JsonResponse({"error": "amount required"}, status=400)
    try:
        amount = Decimal(str(amount))
        if amount <= 0:
            return JsonResponse({"error": "Amount must be positive"}, status=400)
    except:
        return JsonResponse({"error": "Invalid amount"}, status=400)
    try:
        status = UserStatus.objects.get(id=status_id)
    except UserStatus.DoesNotExist:
        return JsonResponse({"error": "Status not found"}, status=404)
    if not status.is_commercial:
        return JsonResponse({"error": "This status is not for sale"}, status=400)
    if status.availability in ('sold', 'reserved'):
        return JsonResponse({"error": "This item is already sold or reserved"}, status=400)
    if status.user == request.user:
        return JsonResponse({"error": "You cannot make an offer on your own listing"}, status=403)
    if Offer.objects.filter(status=status, buyer=request.user, state='pending').exists():
        return JsonResponse({"error": "You already have a pending offer on this item. Withdraw it first."}, status=409)
    with transaction.atomic():
        offer = Offer.objects.create(
            status=status,
            buyer=request.user,
            seller=status.user,
            proposed_by=request.user,
            amount=amount,
            state='pending'
        )
        msg = Message.objects.create(
            sender=request.user,
            recipient=status.user,
            message=f"🛒 Offer: K{amount} for your listing",
            message_type='offer',
            offer=offer,
            related_status=status,
        )
    return JsonResponse({
        "status": "success",
        "offer": {
            "id": offer.id,
            "amount": str(offer.amount),
            "state": offer.state,
            "proposed_by": offer.proposed_by.username,
        },
        "message_id": msg.id,
    })

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def respond_to_offer(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    offer_id = data.get('offer_id')
    action = data.get('action')
    counter_amount = data.get('amount')
    if not offer_id or not action:
        return JsonResponse({"error": "offer_id and action required"}, status=400)
    try:
        offer = Offer.objects.get(id=offer_id)
    except Offer.DoesNotExist:
        return JsonResponse({"error": "Offer not found"}, status=404)
    if offer.state != 'pending':
        return JsonResponse({"error": f"Offer is already {offer.state}. Only pending offers can be accepted/declined/countered."}, status=400)
    if action in ('accept', 'decline', 'counter'):
        if offer.proposed_by == request.user:
            return JsonResponse({"error": "You cannot respond to your own offer."}, status=403)
    with transaction.atomic():
        if action == 'accept':
            offer.state = 'accepted'
            offer.responded_at = now()
            offer.save()
            deal = Deal.objects.create(
                status=offer.status,
                buyer=offer.buyer,
                seller=offer.seller,
                offer=offer,
                final_price=offer.amount,
                collection_point_snapshot=offer.status.collection_point,
                buyer_confirmed=True,
                buyer_confirmed_at=now(),
                seller_confirmed=True,
                seller_confirmed_at=now(),
                state='confirmed'
            )
            offer.status.availability = 'reserved'
            offer.status.save(update_fields=['availability'])
            for recipient in (offer.buyer, offer.seller):
                if recipient == request.user:
                    continue
                Message.objects.create(
                    sender=request.user,
                    recipient=recipient,
                    message=f"✅ Deal confirmed! K{offer.amount} agreed for '{offer.status.caption}'",
                    message_type='deal_confirmation',
                    deal=deal,
                    related_status=offer.status,
                )
            return JsonResponse({"status": "success", "deal_id": deal.id})
        elif action == 'decline':
            offer.state = 'declined'
            offer.responded_at = now()
            offer.save()
            Message.objects.create(
                sender=request.user,
                recipient=offer.buyer,
                message=f"❌ Your offer of K{offer.amount} was declined",
                message_type='status_update',
                related_status=offer.status,
            )
            return JsonResponse({"status": "success"})
        elif action == 'counter':
            if not counter_amount:
                return JsonResponse({"error": "amount required for counter"}, status=400)
            try:
                counter_amount = Decimal(str(counter_amount))
                if counter_amount <= 0:
                    return JsonResponse({"error": "Amount must be positive"}, status=400)
            except:
                return JsonResponse({"error": "Invalid amount"}, status=400)
            offer.state = 'countered'
            offer.responded_at = now()
            offer.save()
            counter_offer = Offer.objects.create(
                status=offer.status,
                buyer=offer.buyer,
                seller=offer.seller,
                proposed_by=request.user,
                amount=counter_amount,
                state='pending',
                parent_offer=offer,
            )
            counter_recipient = offer.buyer if request.user == offer.seller else offer.seller
            counter_label = "Seller" if request.user == offer.seller else "Buyer"
            Message.objects.create(
                sender=request.user,
                recipient=counter_recipient,
                message=f"🔄 {counter_label} countered: K{counter_amount} (was K{offer.amount})",
                message_type='offer',
                offer=counter_offer,
                related_status=offer.status,
            )
            return JsonResponse({"status": "success", "counter_offer_id": counter_offer.id})
        else:
            return JsonResponse({"error": "Invalid action. Use accept/decline/counter"}, status=400)

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def withdraw_offer(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    offer_id = data.get('offer_id')
    if not offer_id:
        return JsonResponse({"error": "offer_id required"}, status=400)
    try:
        offer = Offer.objects.get(id=offer_id)
    except Offer.DoesNotExist:
        return JsonResponse({"error": "Offer not found"}, status=404)
    if offer.state != 'pending':
        return JsonResponse({"error": "Only pending offers can be withdrawn"}, status=400)
    if offer.buyer != request.user:
        return JsonResponse({"error": "Only the buyer who made the offer can withdraw it"}, status=403)
    offer.state = 'withdrawn'
    offer.responded_at = now()
    offer.save()
    Message.objects.create(
        sender=request.user,
        recipient=offer.seller,
        message=f"↩️ Buyer withdrew their offer of K{offer.amount}",
        message_type='status_update',
        related_status=offer.status,
    )
    return JsonResponse({"status": "success"})

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def take_listing(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    status_id = data.get('status_id')
    if not status_id:
        return JsonResponse({"error": "status_id required"}, status=400)
    try:
        status = UserStatus.objects.get(id=status_id)
    except UserStatus.DoesNotExist:
        return JsonResponse({"error": "Status not found"}, status=404)
    if not status.is_commercial:
        return JsonResponse({"error": "This status is not for sale"}, status=400)
    if status.availability != 'available':
        return JsonResponse({"error": "This item is not available"}, status=400)
    if status.user == request.user:
        return JsonResponse({"error": "You cannot buy your own listing"}, status=403)
    if status.price is None:
        return JsonResponse({"error": "This listing has no price set"}, status=400)
    active_deal = Deal.objects.filter(status=status).exclude(state='cancelled').first()
    if active_deal:
        return JsonResponse({"error": "This listing is already being negotiated"}, status=409)
    with transaction.atomic():
        deal = Deal.objects.create(
            status=status,
            buyer=request.user,
            seller=status.user,
            offer=None,
            final_price=status.price,
            collection_point_snapshot=status.collection_point,
            buyer_confirmed=True,
            buyer_confirmed_at=now(),
            seller_confirmed=False,
            state='pending_confirmation',
            payment_method=data.get('payment_method', '').strip(),
            delivery_address=data.get('delivery_address', '').strip(),
            delivery_instructions=data.get('delivery_instructions', '').strip(),
        )
        status.availability = 'reserved'
        status.save(update_fields=['availability'])
        Message.objects.create(
            sender=request.user,
            recipient=status.user,
            message=f"🛒 Buyer wants to buy K{status.price} – please confirm the deal",
            message_type='deal_confirmation',
            deal=deal,
            related_status=status,
        )
    return JsonResponse({
        "status": "success",
        "deal_id": deal.id,
        "message": "Your purchase request has been sent. The seller must confirm to complete the deal."
    })

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def confirm_deal(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    deal_id = data.get('deal_id')
    if not deal_id:
        return JsonResponse({"error": "deal_id required"}, status=400)
    try:
        deal = Deal.objects.get(id=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)
    if deal.state != 'pending_confirmation':
        return JsonResponse({"error": f"Deal cannot be confirmed (current state: {deal.state})"}, status=400)
    if request.user == deal.buyer:
        if deal.buyer_confirmed:
            return JsonResponse({"error": "You already confirmed this deal"}, status=409)
        deal.buyer_confirmed = True
        deal.buyer_confirmed_at = now()
    elif request.user == deal.seller:
        if deal.seller_confirmed:
            return JsonResponse({"error": "You already confirmed this deal"}, status=409)
        deal.seller_confirmed = True
        deal.seller_confirmed_at = now()
    else:
        return JsonResponse({"error": "You are not part of this deal"}, status=403)
    if deal.buyer_confirmed and deal.seller_confirmed:
        deal.state = 'confirmed'
        deal.status.availability = 'reserved'
        deal.status.save(update_fields=['availability'])
    deal.save()
    other = deal.seller if request.user == deal.buyer else deal.buyer
    Message.objects.create(
        sender=request.user,
        recipient=other,
        message=f"✅ Deal confirmed by {request.user.username} – ready to proceed!",
        message_type='status_update',
        deal=deal,
        related_status=deal.status,
    )
    return JsonResponse({"status": "success", "deal_state": deal.state})

@login_required
@require_POST
def complete_deal(request):
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, AttributeError):
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    deal_id = data.get('deal_id')
    payment_method = data.get('payment_method', '').strip()
    payment_account = data.get('payment_account', '').strip()
    payment_reference = data.get('payment_reference', '').strip()
    if not deal_id:
        return JsonResponse({'error': 'deal_id is required'}, status=400)
    if not payment_method:
        return JsonResponse({'error': 'payment_method is required'}, status=400)
    try:
        deal = Deal.objects.select_related('buyer', 'seller', 'status').get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({'error': 'Deal not found'}, status=404)
    me = request.user
    if me not in (deal.buyer, deal.seller):
        return JsonResponse({'error': 'Not a participant in this deal'}, status=403)
    if deal.state != 'confirmed':
        return JsonResponse({'error': f'Deal must be in "confirmed" state to complete (currently: {deal.state})'}, status=400)
    deal.state = 'completed'
    deal.payment_method = payment_method
    if hasattr(deal, 'payment_account'):
        deal.payment_account = payment_account
        deal.payment_reference = payment_reference
    deal.save()
    status_obj = deal.status
    if status_obj:
        status_obj.availability = 'sold'
        status_obj.save(update_fields=['availability'])
    METHOD_LABELS = {
        'airtel_money':   'Airtel Money',
        'mtn_money':      'MTN MoMo',
        'zamtel_kwacha':  'Zamtel Kwacha',
        'bank_transfer':  'Bank Transfer',
        'cash':           'Cash',
    }
    method_label = METHOD_LABELS.get(payment_method, payment_method)
    note_parts = [f'✅ Payment confirmed via {method_label}']
    if payment_account:
        note_parts.append(f'Account: {payment_account}')
    if payment_reference:
        note_parts.append(f'Ref: {payment_reference}')
    other = deal.seller if me == deal.buyer else deal.buyer
    Message.objects.create(
        sender=me,
        recipient=other,
        message=' · '.join(note_parts),
        message_type='status_update',
        deal=deal,
        related_status=status_obj,
    )
    return JsonResponse({
        'status':  'success',
        'message': 'Deal completed.',
        'deal': {
            'id':             deal.pk,
            'state':          deal.state,
            'payment_method': deal.payment_method,
            'final_price':    str(deal.final_price),
        }
    })

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def cancel_deal(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    deal_id = data.get('deal_id')
    if not deal_id:
        return JsonResponse({"error": "deal_id required"}, status=400)
    try:
        deal = Deal.objects.get(id=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)
    if deal.state not in ('pending_confirmation', 'confirmed'):
        return JsonResponse({"error": f"Cannot cancel a deal in state {deal.state}"}, status=400)
    if request.user not in (deal.buyer, deal.seller):
        return JsonResponse({"error": "You are not part of this deal"}, status=403)
    with transaction.atomic():
        deal.state = 'cancelled'
        deal.save()
        deal.status.availability = 'available'
        deal.status.save(update_fields=['availability'])
        other = deal.seller if request.user == deal.buyer else deal.buyer
        Message.objects.create(
            sender=request.user,
            recipient=other,
            message=f"❌ Deal cancelled by {request.user.username}",
            message_type='status_update',
            deal=deal,
            related_status=deal.status,
        )
    return JsonResponse({"status": "success"})

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def advance_delivery(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    deal_id = data.get('deal_id')
    new_stage = data.get('stage', '').strip()
    notes = str(data.get('notes', '')).strip()[:500]
    if not deal_id or not new_stage:
        return JsonResponse({"error": "deal_id and stage are required"}, status=400)
    try:
        deal = Deal.objects.select_related('buyer', 'seller', 'status').get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)
    me = request.user
    if me not in (deal.buyer, deal.seller):
        return JsonResponse({"error": "Not a participant in this deal"}, status=403)
    tracker, _ = DeliveryTracking.objects.get_or_create(deal=deal, defaults={'stage': 'order_placed'})
    current = tracker.stage
    if new_stage == 'disputed':
        if current == 'payment_released':
            return JsonResponse({"error": "Cannot dispute a closed delivery"}, status=400)
    elif new_stage in _STAGE_ORDER:
        ci = _STAGE_ORDER.index(current) if current in _STAGE_ORDER else -1
        ni = _STAGE_ORDER.index(new_stage)
        if ni != ci + 1:
            expected = _STAGE_ORDER[ci + 1] if ci + 1 < len(_STAGE_ORDER) else 'none'
            return JsonResponse({"error": f"Cannot jump from {current} to {new_stage}. Next expected: {expected}"}, status=400)
    else:
        return JsonResponse({"error": f"Unknown stage: {new_stage}"}, status=400)
    allowed = _STAGE_ACTOR.get(new_stage, 'both')
    if allowed == 'seller' and me != deal.seller:
        return JsonResponse({"error": "Only the seller can mark this stage"}, status=403)
    if allowed == 'buyer' and me != deal.buyer:
        return JsonResponse({"error": "Only the buyer can mark this stage"}, status=403)
    ts = now()
    with transaction.atomic():
        tracker.stage = new_stage
        if notes:
            tracker.notes = notes
        if new_stage == 'seller_confirmed':  tracker.seller_confirmed_at  = ts
        elif new_stage == 'in_transit':      tracker.in_transit_at        = ts
        elif new_stage == 'delivered':       tracker.delivered_at         = ts
        elif new_stage == 'payment_released':
            tracker.payment_released_at = ts
            SellerRating.objects.get_or_create(deal=deal)
        elif new_stage == 'disputed':        tracker.disputed_at          = ts
        tracker.save()
        note_suffix = f' · "{notes}"' if notes else ''
        other = deal.seller if me == deal.buyer else deal.buyer
        Message.objects.create(
            sender=me, recipient=other,
            message=_STAGE_LABELS.get(new_stage, new_stage) + note_suffix,
            message_type='status_update',
            deal=deal, related_status=deal.status,
        )
    return JsonResponse({"status": "success", "stage": tracker.stage, "updated": _utc_iso(ts)})

@login_required
def get_delivery_status(request):
    deal_id = request.GET.get('deal_id', '').strip()
    if not deal_id:
        return JsonResponse({"error": "deal_id required"}, status=400)
    try:
        deal = Deal.objects.get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)
    if request.user not in (deal.buyer, deal.seller):
        return JsonResponse({"error": "Not a participant"}, status=403)
    try:
        t = deal.delivery_tracking
    except DeliveryTracking.DoesNotExist:
        return JsonResponse({"error": "No tracking info yet"}, status=404)
    ci = _STAGE_ORDER.index(t.stage) if t.stage in _STAGE_ORDER else -1
    next_s = _STAGE_ORDER[ci + 1] if ci + 1 < len(_STAGE_ORDER) else None
    return JsonResponse({
        "deal_id":             deal.pk,
        "stage":               t.stage,
        "notes":               t.notes,
        "seller_confirmed_at": _utc_iso(t.seller_confirmed_at) if t.seller_confirmed_at else None,
        "in_transit_at":       _utc_iso(t.in_transit_at)       if t.in_transit_at       else None,
        "delivered_at":        _utc_iso(t.delivered_at)        if t.delivered_at        else None,
        "payment_released_at": _utc_iso(t.payment_released_at) if t.payment_released_at else None,
        "disputed_at":         _utc_iso(t.disputed_at)         if t.disputed_at         else None,
        "next_stage":          next_s,
        "next_actor":          _STAGE_ACTOR.get(next_s, '') if next_s else '',
        "my_role":             "buyer" if request.user == deal.buyer else "seller",
    })

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def submit_rating(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    deal_id = data.get('deal_id')
    note = str(data.get('note', '')).strip()[:200]
    try:
        score = int(data.get('score', 0))
    except (TypeError, ValueError):
        return JsonResponse({"error": "score must be an integer"}, status=400)
    if not deal_id:
        return JsonResponse({"error": "deal_id required"}, status=400)
    if not 1 <= score <= 5:
        return JsonResponse({"error": "score must be 1–5"}, status=400)
    try:
        deal = Deal.objects.select_related('buyer', 'seller').get(pk=deal_id)
    except Deal.DoesNotExist:
        return JsonResponse({"error": "Deal not found"}, status=404)
    me = request.user
    if me not in (deal.buyer, deal.seller):
        return JsonResponse({"error": "Not a participant"}, status=403)
    try:
        if deal.delivery_tracking.stage != 'payment_released':
            return JsonResponse({"error": "Ratings unlock after payment is released"}, status=400)
    except DeliveryTracking.DoesNotExist:
        return JsonResponse({"error": "Delivery tracking not started"}, status=400)
    rating, _ = SellerRating.objects.get_or_create(deal=deal)
    ts = now()
    if me == deal.buyer:
        if rating.seller_score is not None:
            return JsonResponse({"error": "Already rated this seller"}, status=409)
        rating.seller_score = score
        rating.seller_note = note
        rating.seller_rated_at = ts
        rated_user = deal.seller
    else:
        if rating.buyer_score is not None:
            return JsonResponse({"error": "Already rated this buyer"}, status=409)
        rating.buyer_score = score
        rating.buyer_note = note
        rating.buyer_rated_at = ts
        rated_user = deal.buyer
    rating.save()
    _update_rating_cache(rated_user)
    return JsonResponse({"status": "success", "score": score, "rated_user": rated_user.username})

@login_required
def get_seller_ratings(request):
    username = request.GET.get('username', '').strip()
    if not username:
        return JsonResponse({"error": "username required"}, status=400)
    try:
        seller = User.objects.get(username=username)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)
    agg = SellerRating.objects.filter(deal__seller=seller, seller_score__isnull=False).aggregate(avg=Avg('seller_score'), total=Count('id'))
    dist_rows = SellerRating.objects.filter(deal__seller=seller, seller_score__isnull=False).values('seller_score').annotate(n=Count('id'))
    dist = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    for r in dist_rows:
        dist[r['seller_score']] = r['n']
    reviews = [
        {
            "buyer":    r.deal.buyer.username,
            "score":    r.seller_score,
            "note":     r.seller_note or '',
            "rated_at": _utc_iso(r.seller_rated_at) if r.seller_rated_at else None,
        }
        for r in SellerRating.objects.filter(deal__seller=seller, seller_score__isnull=False).select_related('deal__buyer').order_by('-seller_rated_at')[:10]
    ]
    return JsonResponse({
        "username":      seller.username,
        "avg_score":     round(agg['avg'], 1) if agg['avg'] else None,
        "total_ratings": agg['total'] or 0,
        "star_counts":   dist,
        "reviews":       reviews,
    })

def _update_rating_cache(user):
    try:
        agg = SellerRating.objects.filter(deal__seller=user, seller_score__isnull=False).aggregate(avg=Avg('seller_score'))
        if agg['avg'] and hasattr(user.profile, 'avg_rating'):
            user.profile.avg_rating = round(agg['avg'], 2)
            user.profile.save(update_fields=['avg_rating'])
    except Exception:
        pass

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def extend_listing(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    status_id = data.get('status_id')
    if not status_id:
        return JsonResponse({"error": "status_id required"}, status=400)
    try:
        status = UserStatus.objects.get(pk=status_id, user=request.user)
    except UserStatus.DoesNotExist:
        return JsonResponse({"error": "Listing not found or not yours"}, status=404)
    if status.availability == 'sold':
        return JsonResponse({"error": "Cannot extend a sold listing"}, status=400)
    ext_count = ListingBump.objects.filter(status=status, bump_type='extend').count()
    if ext_count >= _MAX_EXTENSIONS:
        return JsonResponse({"error": f"Maximum {_MAX_EXTENSIONS} extensions reached. Delete and repost."}, status=400)
    with transaction.atomic():
        current_expiry = getattr(status, 'expires_at', None) or (status.created_at + timedelta(hours=24))
        new_expiry = max(current_expiry, now()) + timedelta(hours=24)
        if hasattr(status, 'expires_at'):
            status.expires_at = new_expiry
            status.save(update_fields=['expires_at'])
        ListingBump.objects.create(status=status, user=request.user, bump_type='extend')
    return JsonResponse({
        "status":       "success",
        "expires_at":   _utc_iso(new_expiry),
        "extends_used": ext_count + 1,
        "extends_left": _MAX_EXTENSIONS - (ext_count + 1),
    })

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def bump_listing(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    status_id = data.get('status_id')
    if not status_id:
        return JsonResponse({"error": "status_id required"}, status=400)
    try:
        status = UserStatus.objects.get(pk=status_id, user=request.user)
    except UserStatus.DoesNotExist:
        return JsonResponse({"error": "Listing not found or not yours"}, status=404)
    if status.availability == 'sold':
        return JsonResponse({"error": "Cannot bump a sold listing"}, status=400)
    today_start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    if ListingBump.objects.filter(user=request.user, bump_type='bump', created_at__gte=today_start).count() >= _MAX_FREE_BUMPS_PER_DAY:
        return JsonResponse({
            "error": "Daily free bump used. Come back tomorrow!",
            "next_bump_at": _utc_iso(today_start + timedelta(days=1)),
        }, status=429)
    ts = now()
    with transaction.atomic():
        if hasattr(status, 'bumped_at'):
            status.bumped_at = ts
            status.bump_count = (getattr(status, 'bump_count', 0) or 0) + 1
            status.save(update_fields=['bumped_at', 'bump_count'])
        ListingBump.objects.create(status=status, user=request.user, bump_type='bump')
    return JsonResponse({
        "status":     "success",
        "bumped_at":  _utc_iso(ts),
        "bump_count": getattr(status, 'bump_count', 1),
    })
'''

# 9. views_proxy.py
PROXY = '''"""
views_proxy.py – media proxy for Cloudinary
"""
import re
import os
import logging
from urllib.parse import urlparse
from django.http import HttpResponse, JsonResponse
from django.contrib.auth.decorators import login_required
import requests as req_lib
import cloudinary
import cloudinary.utils
from .views_utils import _fix_content_type

logger = logging.getLogger(__name__)

@login_required
def proxy_status_media(request):
    url = request.GET.get('url', '').strip()
    if not url:
        return JsonResponse({'error': 'url parameter required.'}, status=400)
    if url.startswith('http://'):
        url = 'https://' + url[7:]
    allowed_hosts = ('res.cloudinary.com', 'cloudinary.com', 'pythonanywhere.com')
    parsed = urlparse(url)
    if not any(parsed.netloc == h or parsed.netloc.endswith('.' + h) for h in allowed_hosts):
        return JsonResponse({'error': 'URL host not permitted.'}, status=403)
    def _try_fetch(fetch_url):
        return req_lib.get(fetch_url, timeout=30, headers={'User-Agent': 'AsterixChat/1.0'})
    fetch_url = url
    if 'res.cloudinary.com' in url:
        try:
            path = parsed.path
            m = re.search(r'/(?:image|raw|video)/upload/(?:s--[\w-]+--/)?(?:v\d+/)?(.+)$', path)
            if m:
                full_public_id = m.group(1)
                base_id, ext = os.path.splitext(full_public_id)
                fmt = ext.lstrip('.') if ext else None
                for resource_type in ('raw', 'image'):
                    try:
                        pid = full_public_id if resource_type == 'raw' else base_id
                        kwargs = {
                            'resource_type': resource_type,
                            'type': 'upload',
                            'sign_url': True,
                            'secure': True,
                        }
                        if resource_type == 'image' and fmt:
                            kwargs['format'] = fmt
                        signed_url, _ = cloudinary.utils.cloudinary_url(pid, **kwargs)
                        resp = _try_fetch(signed_url)
                        if resp.status_code == 200:
                            content_type = resp.headers.get('Content-Type', 'application/octet-stream').split(';')[0].strip()
                            filename = full_public_id.split('/')[-1] or 'file'
                            content_type = _fix_content_type(filename, content_type)
                            http_resp = HttpResponse(resp.content, content_type=content_type)
                            http_resp['Cache-Control'] = 'private, max-age=3600'
                            http_resp['Content-Disposition'] = f'inline; filename="{filename}"'
                            return http_resp
                        logger.debug(f"proxy: {resource_type} signed URL failed with status → {resp.status_code}")
                    except Exception as ex:
                        logger.debug(f"proxy: signed URL ({resource_type}) exception: {ex}")
                        continue
                logger.warning(f"proxy: all signed URL attempts failed for {url}")
        except Exception as e:
            logger.warning(f"proxy: Cloudinary URL parse/sign error: {e}")
    try:
        resp = _try_fetch(fetch_url)
        resp.raise_for_status()
        content_type = resp.headers.get('Content-Type', 'application/octet-stream').split(';')[0].strip()
        filename = fetch_url.split('/')[-1].split('?')[0] or 'file'
        content_type = _fix_content_type(filename, content_type)
        http_resp = HttpResponse(resp.content, content_type=content_type)
        http_resp['Cache-Control'] = 'private, max-age=3600'
        http_resp['Content-Disposition'] = f'inline; filename="{filename}"'
        return http_resp
    except req_lib.exceptions.HTTPError as e:
        logger.error(f"proxy_status_media HTTP error {fetch_url}: {e}")
        return JsonResponse({'error': 'Remote server error: ' + str(e)}, status=502)
    except req_lib.exceptions.ConnectionError as e:
        logger.error(f"proxy_status_media connection error {fetch_url}: {e}")
        return JsonResponse({'error': 'Could not connect to media host.'}, status=502)
    except req_lib.exceptions.Timeout:
        logger.error(f"proxy_status_media timeout {fetch_url}")
        return JsonResponse({'error': 'Media host timed out.'}, status=504)
    except Exception as e:
        logger.error(f"proxy_status_media unexpected error {fetch_url}: {e}", exc_info=True)
        return JsonResponse({'error': 'Could not fetch media: ' + str(e)}, status=502)
'''

# 10. views_ringtone.py
RINGTONE = '''"""
views_ringtone.py – ringtone sync (session based)
"""
import json
import logging
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)

@csrf_exempt
@login_required
def sync_ringtone(request):
    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        data = json.loads(request.body)
        base64_data = data.get('base64', '')
        filename = data.get('filename', 'custom_ringtone.m4a')
        if not base64_data:
            return JsonResponse({"error": "No ringtone data."}, status=400)
        request.session['_ringtone'] = {
            'data': base64_data,
            'filename': filename
        }
        return JsonResponse({"status": "success", "message": "Ringtone synced."})
    except Exception as e:
        logger.error(f"sync_ringtone: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)
'''

# 11. views_online.py
ONLINE = '''"""
views_online.py – online presence ping
"""
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.timezone import now

@login_required
def get_online_users(request):
    return JsonResponse({"online": []})

@csrf_exempt
@login_required
def update_online_status(request):
    if request.method == 'POST':
        request.user.last_seen = now()
        request.user.save(update_fields=['last_seen'])
        return JsonResponse({'status': 'updated'})
    return JsonResponse({'error': 'Method not allowed'}, status=405)
'''

# 12. views_serviceworker.py
SERVICE_WORKER = '''"""
views_serviceworker.py – serve service-worker.js
"""
import os
from django.conf import settings
from django.http import HttpResponse

def service_worker(request):
    sw_path = os.path.join(settings.BASE_DIR, 'static', 'service-worker.js')
    with open(sw_path, 'rb') as f:
        content = f.read()
    response = HttpResponse(content, content_type='application/javascript')
    response['Service-Worker-Allowed'] = '/'
    return response
'''

# 13. New main views.py (re‑exporter)
MAIN_VIEWS = '''"""
views.py – re‑exporter for modular views.
All functions are imported from the views/ subfolder.
"""
from .views_utils import *
from .views_auth import *
from .views_messages import *
from .views_profile import *
from .views_contacts import *
from .views_status import *
from .views_events import *
from .views_commerce import *
from .views_proxy import *
from .views_ringtone import *
from .views_online import *
from .views_serviceworker import *
'''

# -------- Main execution ----------
def main():
    # Backup original views.py if it exists
    if os.path.exists('views.py'):
        shutil.copy('views.py', 'views_backup.py')
        print("Backed up original views.py to views_backup.py")

    # Create views/ folder
    os.makedirs('views', exist_ok=True)

    # Write each module
    write_file('views/views_utils.py', UTILS)
    write_file('views/views_auth.py', AUTH)
    write_file('views/views_messages.py', MESSAGES)
    write_file('views/views_profile.py', PROFILE)
    write_file('views/views_contacts.py', CONTACTS)
    write_file('views/views_status.py', STATUS)
    write_file('views/views_events.py', EVENTS)
    write_file('views/views_commerce.py', COMMERCE)
    write_file('views/views_proxy.py', PROXY)
    write_file('views/views_ringtone.py', RINGTONE)
    write_file('views/views_online.py', ONLINE)
    write_file('views/views_serviceworker.py', SERVICE_WORKER)

    # Write the new main views.py
    write_file('views.py', MAIN_VIEWS)

    # Create __init__.py to make the folder a package
    with open('views/__init__.py', 'w') as f:
        f.write('# views package\n')
    print("Created views/__init__.py")

    print("\nModularization complete! Your original views.py is backed up as views_backup.py.")
    print("The new views/ folder contains all split modules. Your urls.py imports will still work.")
    print("Please restart your server to apply changes.")

if __name__ == '__main__':
    main()