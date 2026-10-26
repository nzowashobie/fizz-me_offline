"""
views_attachments.py — Attachment upload, retrieval, and deletion.
"""

import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..models import Attachment
from .helpers import _get_file_url, _get_cloudinary_filename, _delete_file

logger = logging.getLogger(__name__)


@csrf_exempt
@login_required
def upload_attachments(request):
    """Stage attachments (no message yet) for later send."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)

    saved = []
    for f in request.FILES.getlist("files"):
        try:
            att = Attachment.objects.create(
                file=f,
                file_type=f.content_type or "application/octet-stream",
                original_filename=f.name,
            )
            url = _get_file_url(att.file)
            if url:
                saved.append({"id": att.id, "url": url, "name": f.name, "type": f.content_type})
        except Exception as e:
            logger.error(f"Staging attachment failed: {e}", exc_info=True)

    return JsonResponse(saved, safe=False)


@login_required
def get_attachments(request, message_id=None):
    qs = Attachment.objects.filter(message_id=message_id) if message_id else Attachment.objects.all()
    data = []
    for a in qs:
        url = _get_file_url(a.file)
        if url:
            data.append({
                "id":   a.id,
                "url":  url,
                "name": _get_cloudinary_filename(a.file),
                "type": a.file_type,
            })
    return JsonResponse(data, safe=False)


@csrf_exempt
@login_required
def delete_attachment(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)
    att_id = request.POST.get("id")
    try:
        att = Attachment.objects.get(id=att_id)
    except Attachment.DoesNotExist:
        return JsonResponse({"error": "Not found."}, status=404)
    if att.message and att.message.sender != request.user:
        return JsonResponse({"error": "Permission denied."}, status=403)
    _delete_file(att.file)
    att.delete()
    return JsonResponse({"message": "Deleted."})
