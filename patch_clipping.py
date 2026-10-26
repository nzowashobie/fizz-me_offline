#!/usr/bin/env python3
import sys, shutil
from pathlib import Path

PROF = Path("/home/fizzme/fizzme/projec/chat/views/views_profile.py")

if not PROF.exists():
    print("ERROR: Could not find views_profile.py"); sys.exit(1)

NEW_VIEW = """@login_required
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
    })"""

text = PROF.read_text(encoding="utf-8")

# Find the exact start and end of get_contact_info
start_idx = text.find("@login_required\ndef get_contact_info(request):")
end_idx = text.find("@login_required\ndef get_contact_info_by_phone(request):")

if start_idx == -1 or end_idx == -1:
    print("❌ ERROR: Could not find get_contact_info boundaries in views_profile.py")
    sys.exit(1)

bak = PROF.with_suffix(".bak")
if not bak.exists(): shutil.copy2(PROF, bak)

new_text = text[:start_idx] + NEW_VIEW + "\n\n\n" + text[end_idx:]
PROF.write_text(new_text, encoding="utf-8")
print("✅ views_profile.py: Replaced get_contact_info successfully.")