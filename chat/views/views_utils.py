"""
views_utils.py – shared helpers
"""
import os
import logging
import re
from urllib.parse import urlparse
from django.conf import settings
from ..models import Contact, EventInvitee
import cloudinary.utils

logger = logging.getLogger(__name__)
def _guess_resource_type(public_id_or_name):
    """
    Guess the Cloudinary resource_type from the file extension embedded in
    the public_id / filename. Defaults to 'image' (the most common case).
    """
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
    """
    Return the bare public_id (no resource-type prefix, no version segment)
    from a CloudinaryField or plain string.
    """
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

    public_id = re.sub(r'^v\d+/', '', public_id)
    return public_id or None

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
    """
    Return a signed HTTPS URL for any CloudinaryField value.

    CloudinaryField(resource_type='auto') stores the public_id and exposes
    a .url that contains 'auto/upload/' — Cloudinary rejects those requests
    with 404. We rebuild the URL via cloudinary_url() using the correct
    resource_type (guessed from the file extension), which produces a
    proper image/upload/ or video/upload/ signed URL.
    """
    if not file_field:
        return ''

    try:
        public_id = _clean_public_id(file_field)
        if not public_id:
            return ''

        resource_type = _guess_resource_type(public_id)

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
    from ..models import Contact
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