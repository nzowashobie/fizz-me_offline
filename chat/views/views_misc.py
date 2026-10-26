"""
views_misc.py — Media proxy, service worker, and ringtone sync.

FIXES:
  - proxy_status_media: Cloudinary 'auto/upload/' URLs 404 because
    Cloudinary doesn't serve that resource_type path.  We now strip the
    'auto/upload/' prefix from the public_id and try resource_types in
    order: guessed from extension → image → video → raw.  This resolves
    the NS_ERROR_DOM_NETWORK_ERR / OpaqueResponseBlocking errors in the
    status viewer and the "Bad Gateway" 502 the frontend was hitting.
"""

import json
import logging
import os
import re
from urllib.parse import urlparse

import cloudinary
import cloudinary.utils
import requests as req_lib

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.http import FileResponse, Http404



logger = logging.getLogger(__name__)

# MIME type fix-up for Cloudinary 'raw' resources
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


def _guess_resource_type_from_ext(ext):
    """Return the most likely Cloudinary resource_type for a file extension."""
    ext = (ext or '').lower().lstrip('.')
    if ext in ('mp4', 'mov', 'webm', 'avi', 'mkv', 'flv', 'wmv', 'ogg'):
        return 'video'
    if ext in ('pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'csv', 'txt'):
        return 'raw'
    return 'image'


# ─── Media proxy ───────────────────────────────────────────────────────────

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

    # ── Cloudinary: always rebuild via signed URL to avoid auto/upload/ 404s ──
    if 'res.cloudinary.com' in url:
        try:
            path = parsed.path

            # Match any resource-type path (including auto/upload/)
            m = re.search(
                r'/(?:image|raw|video|auto)/upload/(?:s--[\w-]+--/)?(?:v\d+/)?(.+)$',
                path
            )

            if m:
                full_public_id = m.group(1)
                # Strip any leftover URL query from the captured id
                full_public_id = full_public_id.split('?')[0]

                base_id, ext = os.path.splitext(full_public_id)
                fmt = ext.lstrip('.') if ext else None

                guessed_type = _guess_resource_type_from_ext(fmt)

                # Build the ordered resource_type list to try:
                # guessed first, then the other two as fallback
                all_types = ['image', 'video', 'raw']
                order = [guessed_type] + [t for t in all_types if t != guessed_type]

                for resource_type in order:
                    try:
                        # raw resources keep their extension in the public_id
                        pid = full_public_id if resource_type == 'raw' else base_id
                        kwargs = {
                            'resource_type': resource_type,
                            'type':          'upload',
                            'sign_url':      True,
                            'secure':        True,
                        }
                        if resource_type in ('image',) and fmt:
                            kwargs['format'] = fmt

                        signed_url, _ = cloudinary.utils.cloudinary_url(pid, **kwargs)
                        resp = _try_fetch(signed_url)

                        if resp.status_code == 200:
                            content_type = (
                                resp.headers.get('Content-Type', 'application/octet-stream')
                                .split(';')[0].strip()
                            )
                            filename = full_public_id.split('/')[-1] or 'file'
                            content_type = _fix_content_type(filename, content_type)

                            http_resp = HttpResponse(resp.content, content_type=content_type)
                            http_resp['Cache-Control'] = 'private, max-age=3600'
                            http_resp['Content-Disposition'] = f'inline; filename="{filename}"'
                            return http_resp

                        logger.debug(
                            f"proxy: {resource_type} signed URL → {resp.status_code} "
                            f"for public_id={pid!r}"
                        )

                    except Exception as ex:
                        logger.debug(f"proxy: signed URL ({resource_type}) exception: {ex}")
                        continue

                logger.warning(f"proxy: all signed URL attempts failed for {url}")
                return JsonResponse(
                    {'error': 'Could not retrieve media from Cloudinary.'},
                    status=502
                )

        except Exception as e:
            logger.warning(f"proxy: Cloudinary URL parse/sign error: {e}")
            # Fall through to direct fetch below

    # ── Fallback: direct fetch for non-Cloudinary hosts ────────────────
    try:
        resp = _try_fetch(url)
        resp.raise_for_status()

        content_type = (
            resp.headers.get('Content-Type', 'application/octet-stream')
            .split(';')[0].strip()
        )
        filename = url.split('/')[-1].split('?')[0] or 'file'
        content_type = _fix_content_type(filename, content_type)

        http_resp = HttpResponse(resp.content, content_type=content_type)
        http_resp['Cache-Control'] = 'private, max-age=3600'
        http_resp['Content-Disposition'] = f'inline; filename="{filename}"'
        return http_resp

    except req_lib.exceptions.HTTPError as e:
        logger.error(f"proxy_status_media HTTP error {url}: {e}")
        return JsonResponse({'error': 'Remote server error: ' + str(e)}, status=502)
    except req_lib.exceptions.ConnectionError as e:
        logger.error(f"proxy_status_media connection error {url}: {e}")
        return JsonResponse({'error': 'Could not connect to media host.'}, status=502)
    except req_lib.exceptions.Timeout:
        logger.error(f"proxy_status_media timeout {url}")
        return JsonResponse({'error': 'Media host timed out.'}, status=504)
    except Exception as e:
        logger.error(f"proxy_status_media unexpected error {url}: {e}", exc_info=True)
        return JsonResponse({'error': 'Could not fetch media: ' + str(e)}, status=502)


# ─── Ringtone sync ─────────────────────────────────────────────────────────

@csrf_exempt
@login_required
def sync_ringtone(request):
    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        data        = json.loads(request.body)
        base64_data = data.get('base64', '')
        filename    = data.get('filename', 'custom_ringtone.m4a')

        if not base64_data:
            return JsonResponse({"error": "No ringtone data."}, status=400)

        request.session['_ringtone'] = {'data': base64_data, 'filename': filename}
        return JsonResponse({"status": "success", "message": "Ringtone synced."})
    except Exception as e:
        logger.error(f"sync_ringtone: {e}", exc_info=True)
        return JsonResponse({"error": str(e)}, status=500)


# ─── Service worker ────────────────────────────────────────────────────────

def service_worker(request):
    sw_path = os.path.join(settings.BASE_DIR, 'static', 'service-worker.js')
    with open(sw_path, 'rb') as f:
        content = f.read()
    response = HttpResponse(content, content_type='application/javascript')
    response['Service-Worker-Allowed'] = '/'
    return response




def download_apk(request):
    """
    Serves the Android APK with the correct MIME type so Android
    browsers don't rename it to .bin
    """
    file_path = os.path.join(settings.BASE_DIR, 'static', 'fizzme.apk')

    if not os.path.exists(file_path):
        raise Http404("APK file not found")

    response = FileResponse(
        open(file_path, 'rb'),
        content_type='application/vnd.android.package-archive'
    )
    response['Content-Disposition'] = 'attachment; filename="fizzme.apk"'
    return response