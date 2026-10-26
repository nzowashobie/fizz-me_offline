"""
views_broadcast.py: staff broadcast to all users, and the app-version check.
"""
import json
import logging
import time
from pathlib import Path

from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_http_methods

from ..models import Message

logger = logging.getLogger(__name__)
VERSION_FILE = Path(settings.BASE_DIR) / "app_version.json"


def _read_version():
    try:
        data = json.loads(VERSION_FILE.read_text(encoding="utf-8"))
        return {"version": int(data.get("version", 0)), "message": str(data.get("message", ""))}
    except Exception:
        return {"version": 0, "message": ""}


def _push(user, text):
    try:
        from ..push_utils import send_push_notification
        send_push_notification(user, "Fizzme update", text, url="/")
    except Exception:
        logger.exception("push failed for %s", user)


@staff_member_required
@require_http_methods(["GET", "POST"])
def staff_broadcast(request):
    ctx = {"current": _read_version(), "sent": None, "error": ""}
    if request.method == "POST":
        text = (request.POST.get("message") or "").strip()[:300]
        if not text:
            ctx["error"] = "Write a short message first."
        else:
            version = int(time.time())
            VERSION_FILE.write_text(
                json.dumps({"version": version, "message": text}, ensure_ascii=False),
                encoding="utf-8",
            )
            body = "📢 Fizzme update: " + text + "\n\nTap the menu (⋮) and choose Reload app to get the latest version."
            sent = 0
            users = get_user_model().objects.filter(is_active=True).exclude(pk=request.user.pk)
            for user in users.iterator():
                Message.objects.create(sender=request.user, recipient=user,
                                       message=body, message_type="status_update")
                _push(user, text)
                sent += 1
            ctx["sent"] = sent
            ctx["current"] = {"version": version, "message": text}
    return render(request, "staff_broadcast.html", ctx)


@login_required
def app_version(request):
    return JsonResponse(_read_version())
