"""
views_profile.py — Profile, contacts, and social controls:
  upload_profile_picture, update_profile,
  add_contact, add_contact_by_phone, remove_contact,
  get_contact_info, get_contact_info_by_phone,
  get_my_contacts, sync_contacts, check_phones,
  check_phones_on_asterix, search_user,
  block_user, unblock_user,
  update_online_status, get_online_users.
"""

import json
import logging
import re

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import BlockedUser, Contact, CustomUser, Profile
from .helpers import _profile_pic, _secure_url

User   = get_user_model()
logger = logging.getLogger(__name__)


# ─── Phone normalisation (fixed) ──────────────────────────────────────────

def normalize_phone(number):
    """
    Convert any Zambian phone format to E.164 (+260...).
    Strips all non-digits, handles leading zero, and prepends country code if missing.
    """
    if not number:
        return None
    digits = re.sub(r'\D', '', str(number))   # remove everything except digits
    if not digits:
        return None

    # Remove leading zero (local format)
    if digits.startswith('0'):
        digits = digits[1:]

    # If it already starts with 260, just prepend '+'
    if digits.startswith('260'):
        return '+' + digits

    # If exactly 9 digits → assume local number without country code
    if len(digits) == 9:
        return '+' + '260' + digits

    # Fallback – prepend '+' as‑is (unlikely but safe)
    return '+' + digits


# ─── Profile picture ───────────────────────────────────────────────────────

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
        result    = cloudinary.uploader.upload(
            file, folder='profile_pictures', resource_type='image', overwrite=True
        )
        public_id = result.get('public_id')
        url       = result.get('secure_url') or result.get('url', '')

        if not public_id or not url:
            return JsonResponse(
                {'error': 'Cloudinary upload succeeded but returned no valid URL.'}, status=500
            )

        profile.profile_picture = public_id
        profile.save()
        return JsonResponse({'profile_picture_url': _secure_url(url)})
    except Exception as e:
        logger.error(f'upload_profile_picture error: {e}', exc_info=True)
        return JsonResponse({'error': f'Upload failed: {str(e)}'}, status=500)


# ─── Update username ───────────────────────────────────────────────────────

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
        return JsonResponse(
            {"status": "error", "message": "Username may only contain letters, digits, spaces, and underscores."},
            status=400,
        )
    if CustomUser.objects.exclude(pk=request.user.pk).filter(username=new_username).exists():
        return JsonResponse({"status": "error", "message": "That username is already taken."}, status=409)

    request.user.username = new_username
    request.user.save(update_fields=["username"])
    return JsonResponse({
        "status":              "success",
        "username":            new_username,
        "profile_picture_url": _profile_pic(request.user) or '',
    })


# ─── Contacts ─────────────────────────────────────────────────────────────

def _contact_payload(user):
    return {
        "id":              user.id,
        "username":        user.username,
        "profile_picture": _profile_pic(user),
        "phone_number":    str(user.phone_number),
    }


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
            "status":  "not_registered",
            "message": f"{username} hasn't joined Asterix yet. Invite them to sign up first.",
        }, status=404)

    if target.id == request.user.id:
        return JsonResponse({"status": "error", "message": "You cannot add yourself."}, status=403)

    _, created = Contact.objects.get_or_create(owner=request.user, contact_user=target)
    if not created:
        return JsonResponse(
            {"status": "error", "message": f"{target.username} is already in your contacts."},
            status=409,
        )

    return JsonResponse({
        "status":  "success",
        "message": f"{target.username} added to your contacts.",
        "contact": _contact_payload(target),
    })


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
    if not normalized:
        return JsonResponse({"status": "error", "message": "Invalid phone number format."}, status=400)

    try:
        target = CustomUser.objects.get(phone_number=normalized)
    except CustomUser.DoesNotExist:
        return JsonResponse({
            "status":  "not_registered",
            "message": f"No Asterix account is registered with {phone_number}. Invite them to sign up first.",
        }, status=404)

    if target.id == request.user.id:
        return JsonResponse({"status": "error", "message": "You cannot add yourself as a contact."}, status=403)

    contact, created = Contact.objects.get_or_create(owner=request.user, contact_user=target)
    if not created:
        return JsonResponse({
            "status":  "already_exists",
            "message": f"{target.username} is already in your contacts.",
            "contact": _contact_payload(target),
        }, status=200)

    return JsonResponse({
        "status":  "success",
        "message": f"{target.username} added to your contacts.",
        "contact": _contact_payload(target),
    }, status=201)


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

    Contact.objects.filter(owner=request.user, contact_user=target).delete()
    
    # Clear chat history for the current user so it disappears from the sidebar
    from ..models import Message
    Message.objects.filter(sender=request.user, recipient=target).update(cleared_by_sender=True)
    Message.objects.filter(sender=target, recipient=request.user).update(cleared_by_recipient=True)

    return JsonResponse({"status": "success", "message": f"Removed {target.username} from your contacts."})


@login_required
def get_my_contacts(request):
    contact_ids = Contact.objects.filter(owner=request.user).values_list('contact_user_id', flat=True)
    users = (
        CustomUser.objects
        .filter(id__in=contact_ids)
        .exclude(id=request.user.id)
        .select_related('profile')
    )
    return JsonResponse({"contacts": [_contact_payload(u) for u in users]})


@login_required
def get_contact_info(request):
    username = request.GET.get('username', '').strip()
    if not username:
        return JsonResponse({"error": "username is required."}, status=400)

    try:
        target = CustomUser.objects.select_related('profile').get(username=username)
    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    from ..models import Message
    from django.db.models import Q
    is_contact = Contact.objects.filter(owner=request.user, contact_user=target).exists()
    has_messages = Message.objects.filter(
        Q(sender=request.user, recipient=target) | Q(sender=target, recipient=request.user)
    ).exists()

    if not is_contact and not has_messages:
        return JsonResponse({"error": "That user isn't in your chats."}, status=403)

    online = False
    if target.last_seen:
        online = (now() - target.last_seen).total_seconds() < 60

    return JsonResponse({
        "username":        target.username,
        "phone_number":    str(target.phone_number),
        "profile_picture": _profile_pic(target),
        "online":          online,
        "last_seen":       target.last_seen.isoformat() if target.last_seen else None,
    })


@login_required
def get_contact_info_by_phone(request):
    phone = request.GET.get('phone', '').strip()
    if not phone:
        return JsonResponse({"error": "phone required."}, status=400)
    normalized = normalize_phone(phone)
    if not normalized:
        return JsonResponse({"error": "Invalid phone format."}, status=400)
    try:
        target = CustomUser.objects.select_related('profile').get(phone_number=normalized)
    except CustomUser.DoesNotExist:
        return JsonResponse({"registered": False}, status=404)
    return JsonResponse({
        "registered":      True,
        "username":        target.username,
        "phone_number":    str(target.phone_number),
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
        # Normalise each number
        normalized = [normalize_phone(n) for n in numbers if n]
        # Query using the normalised values
        for u in CustomUser.objects.filter(phone_number__in=normalized).select_related('profile'):
            registered[str(u.phone_number)] = {
                "username":        u.username,
                "profile_picture": _profile_pic(u),
            }
    return JsonResponse({"registered": registered})


@csrf_exempt
@login_required
def check_phones(request):
    """
    POST /api/contacts/check-phones/
    Body: { "phones": ["+260971234567", ...] }
    Returns: { "registered": {...}, "unregistered": [...] }
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    phone_numbers = data.get('phones', [])
    if not phone_numbers:
        return JsonResponse({"error": "phones list is required."}, status=400)

    # Normalise all numbers
    normalized_phones = []
    for p in phone_numbers:
        n = normalize_phone(p)
        if n:
            normalized_phones.append(n)

    if not normalized_phones:
        return JsonResponse({"registered": {}, "unregistered": phone_numbers})

    registered = {}
    for user in CustomUser.objects.filter(phone_number__in=normalized_phones).exclude(id=request.user.id):
        registered[str(user.phone_number)] = {
            "username":        user.username,
            "profile_picture": _profile_pic(user),
        }

    registered_numbers = set(registered.keys())
    unregistered = [p for p in phone_numbers if normalize_phone(p) not in registered_numbers]

    return JsonResponse({"registered": registered, "unregistered": unregistered})


@csrf_exempt
@login_required
def sync_contacts(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        data          = json.loads(request.body)
        phone_numbers = data.get('phone_numbers', [])
        normalized    = [n for n in (normalize_phone(p) for p in phone_numbers) if n]
        matched_users = CustomUser.objects.filter(phone_number__in=normalized).exclude(id=request.user.id)
        count = sum(
            1 for user in matched_users
            if Contact.objects.get_or_create(owner=request.user, contact_user=user)[1]
        )
        return JsonResponse({"status": "success", "added_contacts": count})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
def search_user(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({"error": "q is required."}, status=400)

    already_blocked = BlockedUser.objects.filter(
        Q(user=request.user) | Q(blocked_user=request.user)
    ).values_list('user_id', 'blocked_user_id')
    blocked_ids = {uid for pair in already_blocked for uid in pair}

    matches = (
        CustomUser.objects
        .filter(Q(username__icontains=query) | Q(phone_number__icontains=query))
        .exclude(id=request.user.id)
        .exclude(id__in=blocked_ids)[:10]
    )
    return JsonResponse({
        "results": [
            {"id": u.id, "username": u.username, "phone_number": str(u.phone_number)}
            for u in matches
        ]
    })


# ─── Social controls ───────────────────────────────────────────────────────

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


# ─── Online status ─────────────────────────────────────────────────────────

@csrf_exempt
@login_required
def update_online_status(request):
    if request.method == 'POST':
        request.user.last_seen = now()
        request.user.save(update_fields=['last_seen'])
        return JsonResponse({'status': 'updated'})
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@login_required
def get_online_users(request):
    from datetime import timedelta
    threshold = now() - timedelta(seconds=60)
    online = CustomUser.objects.filter(last_seen__gte=threshold).exclude(id=request.user.id)
    return JsonResponse({"online": [u.username for u in online]})