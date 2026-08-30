"""
views_status.py – status feed, upload, edit, delete
(with multi-image / StatusMedia support — backward compatible)
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
from django.db import transaction
from ..models import StatusCategory, UserStatus, AdCampaign, StatusMedia
from .views_utils import _utc_iso, _profile_pic, _get_file_url, _delete_file, _fetch_file_bytes

logger = logging.getLogger(__name__)


# ─── Watermark helper ────────────────────────────────────────────────
def _get_watermarked_url(status, media_field=None):
    media = media_field if media_field is not None else status.media
    if not media:
        return None

    if not status.is_commercial:
        return _get_file_url(media)

    public_id = getattr(media, 'public_id', None) or str(media)
    if not public_id:
        return _get_file_url(media)

    if 'auto/upload/' in public_id:
        public_id = public_id.split('auto/upload/')[-1]
    elif 'image/upload/' in public_id:
        public_id = public_id.split('image/upload/')[-1]

    # ── Preserve decimals (e.g. 12.50, not 13) ────────────────────────
    price_text = f"K{status.price:,.2f}" if status.price is not None else ''
    phone = str(status.user.phone_number) if status.user and status.user.phone_number else ''

    transform = [{'width': 800, 'crop': 'limit'}]

    if price_text:
        transform.append({
            'overlay': {
                'font_family': 'Arial',
                'font_size': 20,                     # fixed: no "px"
                'font_weight': 'bold',
                'text': price_text,
                'width': 'auto',                    # let the text decide
                'height': 'auto',
                'crop': 'fit',                      # ensures no clipping
                'flags': 'relative'                # scales with text
            },
            'color': 'black',
            'background': 'white',
            'border': '10px_solid_white',
            'radius': 'max',
            'gravity': 'north_west',
            'x': 20, 'y': 20,
        })

    if phone:
        transform.append({
            'overlay': {
                'font_family': 'Arial',
                'font_size': 18,
                'text': phone,
                'width': 'auto',
                'height': 'auto',
                'crop': 'fit',
                'flags': 'relative'
            },
            'color': 'white',
            'gravity': 'north_west',
            'x': 20, 'y': 90,          # below price (adjust if needed)
        })

    try:
        import cloudinary
        import cloudinary.utils
        url, _ = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type='image',
            type='upload',
            sign_url=True,
            secure=True,
            transformation=transform,
        )
        return url
    except Exception as e:
        logger.warning(f"Could not generate watermarked URL for status {status.id}: {e}")
        return _get_file_url(media)
        return _get_file_url(media)


# ─── Feed ─────────────────────────────────────────────────────────────
@login_required
def get_categorized_status_feed(request, category_name):
    try:
        category, _ = StatusCategory.objects.get_or_create(name=category_name)
        threshold = now() - timedelta(hours=24)
        user_statuses = UserStatus.objects.filter(
            category=category, created_at__gte=threshold
        ).select_related('user', 'user__profile').prefetch_related('media_items').order_by('created_at')

        ad = AdCampaign.objects.filter(category=category, is_active=True).first()
        ad_media_url = _get_file_url(ad.media) if ad else None

        playlist = []
        for idx, status in enumerate(user_statuses):
            try:
                # ── Build media_list from StatusMedia rows (single source of truth) ──
                media_list = []
                extra_items = list(status.media_items.all().order_by('order', 'id'))

                if extra_items:
                    for m in extra_items:
                        item_url = (
                            _get_watermarked_url(status, media_field=m.file)
                            or _get_file_url(m.file)
                        )
                        if item_url:
                            media_list.append({
                                'url': item_url,
                                'original_url': _get_file_url(m.file) or item_url,
                                'caption': status.caption or '',
                                'type': 'image',
                            })

                # Fallback for old rows that predate StatusMedia
                if not media_list:
                    primary_url = (
                        _get_watermarked_url(status)
                        or _get_file_url(status.media)
                    )
                    if primary_url:
                        media_list.append({
                            'url': primary_url,
                            'original_url': _get_file_url(status.media) or primary_url,
                            'caption': status.caption or '',
                            'type': 'image',
                        })

                if not media_list:
                    continue

                display_url = media_list[0]['url']

                item = {
                    'type': 'user_status',
                    'status_id': status.id,
                    'username': status.user.username,
                    'profile_picture': _profile_pic(status.user) or '',
                    'media_url': display_url,
                    'media_list': media_list,
                    'media_count': len(media_list),
                    'caption': status.caption or '',
                    'category': category.name,
                    'market_link': status.market_link or '',
                    'timestamp': _utc_iso(status.created_at),
                }
                if status.is_commercial:
                    item.update({
                        'is_commercial': True,
                        'price': str(status.price) if status.price is not None else None,
                        'is_negotiable': status.is_negotiable,
                        'availability': status.availability or 'available',
                        'product_category': status.product_category or '',
                        'custom_tag': status.custom_tag or '',
                        'collection_point': status.collection_point or '',
                    })
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


# ─── Upload (supports multiple files) ──────────────────────────────
@csrf_exempt
@login_required
def upload_status(request):
    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed."}, status=405)

    media_files = request.FILES.getlist('media')
    if not media_files:
        return JsonResponse({"error": "At least one media file required."}, status=400)

    caption = request.POST.get('caption', '').strip()[:255]
    market_link = request.POST.get('market_link', '').strip()[:500] or None
    category_name = (request.POST.get('category') or 'General').strip()

    is_commercial = request.POST.get('is_commercial', '').strip().lower() == 'true'

    price_raw = request.POST.get('price', '').strip()
    price = None
    if price_raw:
        try:
            price = float(price_raw)
            if price < 0:
                return JsonResponse({"error": "price cannot be negative."}, status=400)
        except ValueError:
            return JsonResponse({"error": "price must be a number."}, status=400)

    is_negotiable = request.POST.get('is_negotiable', '').strip().lower() == 'true'
    availability = request.POST.get('availability', 'available').strip()
    if availability not in ('available', 'reserved', 'sold'):
        availability = 'available'

    valid_product_categories = {'clothing', 'shoes', 'cosmetics', 'bags', 'household', 'other'}
    product_category = request.POST.get('product_category', '').strip()
    if product_category and product_category not in valid_product_categories:
        product_category = 'other'

    custom_tag = request.POST.get('custom_tag', '').strip()[:50]
    collection_point = request.POST.get('collection_point', '').strip()[:255]

    MAX_MEDIA_PER_STATUS = 10
    media_files = media_files[:MAX_MEDIA_PER_STATUS]

    try:
        with transaction.atomic():
            category, _ = StatusCategory.objects.get_or_create(name=category_name)

            first_file = media_files[0]
            if hasattr(first_file, 'seek'):
                first_file.seek(0)

            status = UserStatus.objects.create(
                user=request.user,
                category=category,
                media=first_file,
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

            saved_media = []

            # Row 0: Extract public_id reference safely to avoid duplicate uploads
            try:
                media_ref = getattr(status.media, 'public_id', str(status.media))
                sm0 = StatusMedia.objects.create(status=status, file=media_ref, order=0)
                saved_media.append(sm0)
            except Exception as e:
                logger.warning(f"Failed to create StatusMedia row 0 for status {status.id}: {e}")

            # Rows 1..N: Save remaining files into StatusMedia
            for i, f in enumerate(media_files[1:], start=1):
                try:
                    if hasattr(f, 'seek'):
                        f.seek(0)
                    sm = StatusMedia.objects.create(status=status, file=f, order=i)
                    saved_media.append(sm)
                except Exception as e:
                    logger.warning(f"Failed to save media item {i} for status {status.id}: {e}")

            if not saved_media:
                raise ValueError("Could not save any of the provided media files.")

        # Build comprehensive multi-media list for JSON response
        media_items = []
        for item in saved_media:
            url = (
                _get_watermarked_url(status, media_field=item.file)
                if status.is_commercial
                else _get_file_url(item.file)
            )
            if url:
                media_items.append({
                    "id": item.id,
                    "url": url,
                    "original_url": _get_file_url(item.file) or url,
                    "order": item.order
                })

        return JsonResponse({
            "status": "success",
            "message": "Status live for 24 hours.",
            "status_id": status.id,
            "media_url": media_items[0]["url"] if media_items else _get_file_url(status.media),
            "media_files": media_items,
            "media_count": len(media_items),
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


# ─── Other endpoints ──────────────────────────────────────────────────
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
    statuses = (
        UserStatus.objects.filter(user=request.user, created_at__gte=threshold)
        .select_related('category')
        .prefetch_related('media_items')
        .order_by('-created_at')
    )
    grouped = {}
    for s in statuses:
        cat = s.category.name if s.category else 'General'
        media_url = _get_file_url(s.media)

        extra_items = list(s.media_items.all())
        media_urls = [_get_file_url(m.file) for m in extra_items if _get_file_url(m.file)]
        if not media_urls and media_url:
            media_urls = [media_url]

        grouped.setdefault(cat, []).append({
            'status_id': s.id,
            'media_url': media_url,
            'media_urls': media_urls,
            'media_count': len(media_urls) or (1 if media_url else 0),
            'caption': s.caption,
            'timestamp': _utc_iso(s.created_at),
            'expires_in_minutes': max(0, int((s.created_at + timedelta(hours=24) - now()).total_seconds() // 60)),
            'market_link': s.market_link,
            'is_commercial': s.is_commercial,
            'price': str(s.price) if s.price is not None else '',
            'is_negotiable': s.is_negotiable,
            'availability': s.availability or 'available',
            'product_category': s.product_category or '',
            'custom_tag': s.custom_tag or '',
            'collection_point': s.collection_point or '',
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

    content_type = request.content_type or ''
    if 'multipart/form-data' in content_type:
        data = request.POST
        media_files = request.FILES.getlist('media')
    else:
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid request body.'}, status=400)
        media_files = []

    caption = (data.get('caption') or '').strip()
    if len(caption) > 255:
        return JsonResponse({'error': 'Caption too long (max 255 chars).'}, status=400)

    update_fields = ['caption']
    status.caption = caption

    if 'price' in data:
        price_raw = (data.get('price') or '').strip()
        if price_raw:
            try:
                price = float(price_raw)
                if price < 0:
                    return JsonResponse({'error': 'price cannot be negative.'}, status=400)
                status.price = price
                update_fields.append('price')
            except ValueError:
                return JsonResponse({'error': 'price must be a number.'}, status=400)

    if 'is_negotiable' in data:
        status.is_negotiable = data.get('is_negotiable') == 'true'
        update_fields.append('is_negotiable')

    if 'availability' in data:
        avail = data.get('availability', 'available')
        if avail not in ('available', 'reserved', 'sold'):
            avail = 'available'
        status.availability = avail
        update_fields.append('availability')

    valid_product_categories = {'clothing', 'shoes', 'cosmetics', 'bags', 'household', 'other'}
    if 'product_category' in data:
        pc = data.get('product_category', '').strip()
        if pc and pc not in valid_product_categories:
            pc = 'other'
        status.product_category = pc
        update_fields.append('product_category')

    if 'custom_tag' in data:
        status.custom_tag = (data.get('custom_tag') or '').strip()[:50]
        update_fields.append('custom_tag')

    if 'collection_point' in data:
        status.collection_point = (data.get('collection_point') or '').strip()[:255]
        update_fields.append('collection_point')

    if 'market_link' in data:
        status.market_link = (data.get('market_link') or '').strip()[:500] or None
        update_fields.append('market_link')

    if media_files:
        MAX_MEDIA_PER_STATUS = 10
        media_files = media_files[:MAX_MEDIA_PER_STATUS]
        for m in status.media_items.all():
            _delete_file(m.file)
        status.media_items.all().delete()

        saved_media = []
        for i, f in enumerate(media_files):
            try:
                if hasattr(f, 'seek'):
                    f.seek(0)
                sm = StatusMedia.objects.create(status=status, file=f, order=i)
                saved_media.append(sm)
            except Exception as e:
                logger.warning(f"Failed to save media item {i} for status {status.id} on edit: {e}")

        if saved_media:
            status.media = saved_media[0].file
            update_fields.append('media')

    status.save(update_fields=list(set(update_fields)))

    return JsonResponse({
        'status': 'success',
        'caption': status.caption,
        'price': str(status.price) if status.price is not None else '',
        'availability': status.availability,
        'product_category': status.product_category,
    })

@csrf_exempt
@login_required
def delete_status(request, status_id):
    if request.method not in ('POST', 'DELETE'):
        return JsonResponse({"error": "Method not allowed."}, status=405)
    try:
        status = UserStatus.objects.get(id=status_id, user=request.user)
    except UserStatus.DoesNotExist:
        return JsonResponse({"error": "Not found or not yours."}, status=404)

    for m in status.media_items.all():
        _delete_file(m.file)
    _delete_file(status.media)

    status.delete()
    return JsonResponse({"status": "success", "message": "Status deleted."})