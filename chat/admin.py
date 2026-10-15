"""
admin.py  —  Asterix Chat
Admin interface configuration for all models.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from .models import (
    CustomUser,
    Contact,
    Profile,
    Message,
    Attachment,
    BlockedUser,
    StatusCategory,
    UserStatus,
    AdCampaign,
    ZambianEvent,
    EventInvitee,
    EventStatusShare,
    Offer,
    Deal,
    DeliveryTracking,
    SellerRating,
    ListingBump,
    StatusMedia,         # ← NEW
    PushSubscription,    # ← NEW
)


# ═══════════════════════════════════════════════════════════════════════════════
# SHARED HELPER
# ═══════════════════════════════════════════════════════════════════════════════

def _media_url(obj_media):
    """Safely resolve a CloudinaryField's URL, or None."""
    try:
        return obj_media.url if obj_media else None
    except Exception:
        return None


def _media_extension(url):
    """Best‑effort extension guess from the resolved URL."""
    if not url:
        return ''
    try:
        path = url.split('?')[0]
        tail = path.rsplit('/', 1)[-1]
        if '.' in tail:
            return tail.rsplit('.', 1)[-1].lower()
    except Exception:
        pass
    return ''


def render_media_preview(url, max_size=100):
    """Shared preview renderer: image, video, or link."""
    if not url:
        return "No media"
    ext = _media_extension(url)
    if ext in ('jpg', 'jpeg', 'png', 'gif', 'webp'):
        return format_html(
            '<img src="{}" style="max-height: {}px; max-width: {}px;" />',
            url, max_size, max_size
        )
    if ext in ('mp4', 'mov', 'avi', 'webm'):
        return format_html(
            '<video src="{}" style="max-height: {}px; max-width: {}px;" controls></video>',
            url, max_size, max_size
        )
    return format_html('<a href="{}" target="_blank">View file</a>', url)


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ADMIN
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """Custom admin for CustomUser model."""
    list_display = ('username', 'email', 'phone_number', 'is_active', 'is_staff', 'date_joined')
    list_filter = ('is_active', 'is_staff', 'is_superuser', 'date_joined')
    search_fields = ('username', 'email', 'phone_number')
    ordering = ('-date_joined',)

    fieldsets = UserAdmin.fieldsets + (
        ('Additional Info', {
            'fields': ('phone_number', 'public_key'),
            'classes': ('wide',),
        }),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Additional Info', {
            'fields': ('phone_number', 'public_key'),
            'classes': ('wide',),
        }),
    )


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    """Admin for user contacts."""
    list_display = ('owner', 'contact_user', 'display_name', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('owner__username', 'contact_user__username', 'display_name')
    raw_id_fields = ('owner', 'contact_user')
    date_hierarchy = 'created_at'


# ═══════════════════════════════════════════════════════════════════════════════
# PROFILE ADMIN
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """Admin for user profiles."""
    list_display = ('user', 'phone_number', 'has_profile_picture', 'profile_picture_preview')
    list_filter = ('user__is_active',)
    search_fields = ('user__username', 'phone_number')
    raw_id_fields = ('user',)
    readonly_fields = ('profile_picture_preview',)

    fieldsets = (
        ('User Info', {
            'fields': ('user', 'phone_number')
        }),
        ('Profile Picture', {
            'fields': ('profile_picture', 'profile_picture_preview'),
            'classes': ('wide',),
        }),
    )

    def has_profile_picture(self, obj):
        return bool(obj.profile_picture)
    has_profile_picture.boolean = True
    has_profile_picture.short_description = 'Has Picture'

    def profile_picture_preview(self, obj):
        url = _media_url(obj.profile_picture)
        if url:
            return format_html(
                '<img src="{}" style="max-height: 150px; max-width: 150px;" />',
                url
            )
        return "No image"
    profile_picture_preview.short_description = 'Picture Preview'


# ═══════════════════════════════════════════════════════════════════════════════
# MESSAGING ADMIN
# ═══════════════════════════════════════════════════════════════════════════════

class AttachmentInline(admin.TabularInline):
    """Inline admin for attachments within a message."""
    model = Attachment
    extra = 0
    fields = ('file', 'file_type', 'uploaded_at')
    readonly_fields = ('uploaded_at',)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """Admin for chat messages."""
    list_display = (
        'id', 'sender', 'recipient', 'message_preview',
        'message_type', 'timestamp', 'is_read', 'clear_status'
    )
    list_filter = ('is_read', 'message_type', 'cleared_by_sender', 'cleared_by_recipient', 'timestamp')
    search_fields = ('sender__username', 'recipient__username', 'message')
    raw_id_fields = ('sender', 'recipient', 'reply_to_msg', 'related_status', 'offer', 'deal')
    date_hierarchy = 'timestamp'
    readonly_fields = ('timestamp',)
    inlines = [AttachmentInline]

    fieldsets = (
        ('Participants', {
            'fields': ('sender', 'recipient')
        }),
        ('Message Content', {
            'fields': ('message', 'reply_to_msg', 'reply_sender', 'reply_text', 'reply_media')
        }),
        ('Commerce', {
            'fields': ('message_type', 'related_status', 'offer', 'deal')
        }),
        ('Status', {
            'fields': ('is_read', 'cleared_by_sender', 'cleared_by_recipient')
        }),
        ('Metadata', {
            'fields': ('timestamp',),
            'classes': ('collapse',)
        }),
    )

    actions = ['mark_as_read', 'mark_as_unread', 'hard_delete_selected']

    def message_preview(self, obj):
        if len(obj.message) > 50:
            return f"{obj.message[:50]}..."
        return obj.message
    message_preview.short_description = 'Message Preview'

    def clear_status(self, obj):
        if obj.cleared_by_sender and obj.cleared_by_recipient:
            return "Cleared by Both"
        elif obj.cleared_by_sender:
            return "Cleared by Sender"
        elif obj.cleared_by_recipient:
            return "Cleared by Recipient"
        return "Not Cleared"
    clear_status.short_description = 'Clear Status'

    def mark_as_read(self, request, queryset):
        queryset.update(is_read=True)
    mark_as_read.short_description = "Mark selected messages as read"

    def mark_as_unread(self, request, queryset):
        queryset.update(is_read=False)
    mark_as_unread.short_description = "Mark selected messages as unread"

    def hard_delete_selected(self, request, queryset):
        count = queryset.count()
        queryset.delete()
        self.message_user(request, f"Hard deleted {count} message(s).")
    hard_delete_selected.short_description = "Hard delete selected messages (permanent)"


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    """Admin for file attachments."""
    list_display = ('id', 'message_link', 'file_preview', 'file_type', 'uploaded_at')
    list_filter = ('file_type', 'uploaded_at')
    search_fields = ('message__sender__username', 'message__recipient__username',)
    raw_id_fields = ('message',)
    date_hierarchy = 'uploaded_at'
    readonly_fields = ('uploaded_at', 'file_preview')

    def message_link(self, obj):
        if obj.message:
            return format_html(
                '<a href="/admin/{}/{}/{}/change/">{}</a>',
                obj.message._meta.app_label,
                obj.message._meta.model_name,
                obj.message.id,
                f"Message #{obj.message.id}"
            )
        return "No message"
    message_link.short_description = 'Message'

    def file_preview(self, obj):
        return render_media_preview(_media_url(obj.file), max_size=80)
    file_preview.short_description = 'File'


# ═══════════════════════════════════════════════════════════════════════════════
# SOCIAL CONTROLS ADMIN
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(BlockedUser)
class BlockedUserAdmin(admin.ModelAdmin):
    """Admin for blocked users."""
    list_display = ('user', 'blocked_user', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__username', 'blocked_user__username')
    raw_id_fields = ('user', 'blocked_user')
    date_hierarchy = 'created_at'


# ═══════════════════════════════════════════════════════════════════════════════
# STATUS & ADVERTISING ADMIN
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(StatusCategory)
class StatusCategoryAdmin(admin.ModelAdmin):
    """Admin for status categories."""
    list_display = ('name', 'icon', 'status_count', 'ad_count')
    search_fields = ('name',)

    def status_count(self, obj):
        return obj.statuses.count()
    status_count.short_description = 'Total Statuses'

    def ad_count(self, obj):
        return obj.ads.count()
    ad_count.short_description = 'Total Ads'


class StatusMediaInline(admin.TabularInline):
    """Inline admin for multi‑image StatusMedia rows within a UserStatus."""
    model = StatusMedia
    extra = 0
    fields = ('order', 'file', 'media_preview')
    readonly_fields = ('media_preview',)
    ordering = ('order', 'id')

    def media_preview(self, obj):
        return render_media_preview(_media_url(obj.file), max_size=80)
    media_preview.short_description = 'Preview'


@admin.register(UserStatus)
class UserStatusAdmin(admin.ModelAdmin):
    """Admin for user statuses."""
    list_display = (
        'id', 'user', 'category', 'is_commercial', 'price',
        'availability', 'product_category', 'media_preview', 'caption_preview',
        'created_at'
    )
    list_filter = (
        'is_commercial', 'availability', 'product_category', 'category', 'created_at'
    )
    search_fields = ('user__username', 'caption', 'category__name', 'custom_tag', 'collection_point')
    raw_id_fields = ('user', 'category')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'media_preview')
    inlines = [StatusMediaInline]   # ← NEW

    fieldsets = (
        ('Status Info', {
            'fields': ('user', 'category', 'media', 'media_preview')
        }),
        ('Content', {
            'fields': ('caption', 'market_link')
        }),
        ('Commerce Extension', {
            'fields': (
                'is_commercial', 'price', 'is_negotiable',
                'availability', 'product_category', 'custom_tag', 'collection_point'
            )
        }),
        ('Extension & Bump', {
            'fields': ('expires_at', 'bumped_at', 'bump_count'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )

    def caption_preview(self, obj):
        if obj.caption:
            return obj.caption[:50] + ('...' if len(obj.caption) > 50 else '')
        return "-"
    caption_preview.short_description = 'Caption'

    def media_preview(self, obj):
        return render_media_preview(_media_url(obj.media))
    media_preview.short_description = 'Media Preview'


@admin.register(StatusMedia)
class StatusMediaAdmin(admin.ModelAdmin):
    """Admin for the extra images attached to a UserStatus (multi‑image)."""
    list_display = ('id', 'status', 'order', 'media_preview')
    list_filter = ('status__category',)
    search_fields = ('status__caption', 'status__user__username')
    raw_id_fields = ('status',)
    ordering = ('status', 'order', 'id')
    readonly_fields = ('media_preview',)

    fieldsets = (
        ('Parent Status', {
            'fields': ('status',)
        }),
        ('Media', {
            'fields': ('file', 'order', 'media_preview')
        }),
    )

    def media_preview(self, obj):
        return render_media_preview(_media_url(obj.file))
    media_preview.short_description = 'Media Preview'


@admin.register(AdCampaign)
class AdCampaignAdmin(admin.ModelAdmin):
    """Admin for advertisement campaigns."""
    list_display = ('id', 'advertiser_name', 'category', 'is_active', 'media_preview', 'created_at')
    list_filter = ('is_active', 'category', 'created_at')
    search_fields = ('advertiser_name', 'category__name')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'media_preview')

    fieldsets = (
        ('Advertiser Info', {
            'fields': ('advertiser_name', 'category')
        }),
        ('Ad Content', {
            'fields': ('media', 'media_preview', 'website_link')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Metadata', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )

    def media_preview(self, obj):
        return render_media_preview(_media_url(obj.media))
    media_preview.short_description = 'Media Preview'

    def toggle_active(self, request, queryset):
        for ad in queryset:
            ad.is_active = not ad.is_active
            ad.save()
        self.message_user(request, f"Toggled active status for {queryset.count()} campaign(s).")
    toggle_active.short_description = "Toggle active status"


# ═══════════════════════════════════════════════════════════════════════════════
# ZAMBIAN EVENTS ADMIN
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(ZambianEvent)
class ZambianEventAdmin(admin.ModelAdmin):
    """Admin for Zambian social events."""
    list_display = ('title', 'host', 'event_type', 'event_date', 'visibility')
    list_filter = ('event_type', 'visibility', 'event_date')
    search_fields = ('title', 'host__username', 'venue', 'bride_name', 'groom_name')
    raw_id_fields = ('host',)
    date_hierarchy = 'event_date'
    readonly_fields = ('invite_token', 'created_at', 'updated_at')

    fieldsets = (
        ('Event Details', {
            'fields': ('host', 'event_type', 'title', 'description', 'venue', 'event_date', 'visibility', 'invite_token')
        }),
        ('Media & Settings', {
            'fields': ('cover_photo', 'dress_code', 'rsvp_deadline')
        }),
        ('Zambian Specifics', {
            'fields': ('bride_name', 'groom_name', 'family_contact', 'family_phone')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(EventInvitee)
class EventInviteeAdmin(admin.ModelAdmin):
    """Admin for tracking event invitees and RSVPs."""
    list_display = ('event', 'user', 'rsvp', 'invited_at', 'responded_at')
    list_filter = ('rsvp', 'invited_at')
    search_fields = ('event__title', 'user__username')
    raw_id_fields = ('event', 'user')
    date_hierarchy = 'invited_at'


@admin.register(EventStatusShare)
class EventStatusShareAdmin(admin.ModelAdmin):
    """Admin for events shared to user status feeds."""
    list_display = ('event', 'shared_by', 'status', 'shared_at')
    list_filter = ('shared_at',)
    search_fields = ('event__title', 'shared_by__username')
    raw_id_fields = ('event', 'shared_by', 'status')
    date_hierarchy = 'shared_at'


# ═══════════════════════════════════════════════════════════════════════════════
# COMMERCE ADMIN — OFFERS & DEALS
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(Offer)
class OfferAdmin(admin.ModelAdmin):
    """Admin for negotiation offers on commercial statuses."""
    list_display = ('id', 'status', 'buyer', 'seller', 'proposed_by', 'note', 'amount', 'state', 'created_at')
    list_filter = ('state', 'created_at')
    search_fields = ('status__caption', 'buyer__username', 'seller__username', 'proposed_by__username')
    raw_id_fields = ('status', 'buyer', 'seller', 'proposed_by', 'parent_offer')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'responded_at')

    fieldsets = (
        ('Related Status', {
            'fields': ('status',)
        }),
        ('Parties', {
            'fields': ('buyer', 'seller', 'proposed_by')
        }),
        # FIX: 'note' was missing from fieldsets even though it appears in
        # list_display — this made the bargain note un-editable via admin.
        ('Offer Details', {
            'fields': ('amount', 'state', 'parent_offer', 'note')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'responded_at')
        }),
    )


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    """Admin for confirmed deals."""
    list_display = (
        'id', 'status', 'buyer', 'seller', 'final_price', 'state',
        'buyer_confirmed', 'seller_confirmed', 'created_at'
    )
    list_filter = ('state', 'buyer_confirmed', 'seller_confirmed', 'created_at')
    search_fields = ('status__caption', 'buyer__username', 'seller__username')
    raw_id_fields = ('status', 'buyer', 'seller', 'offer')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Related Status & Offer', {
            'fields': ('status', 'offer')
        }),
        ('Parties', {
            'fields': ('buyer', 'seller')
        }),
        ('Financial', {
            'fields': ('final_price', 'payment_method', 'payment_account', 'payment_reference')
        }),
        ('Delivery', {
            'fields': ('collection_point_snapshot', 'delivery_address', 'delivery_instructions')
        }),
        ('Confirmation', {
            'fields': ('buyer_confirmed', 'buyer_confirmed_at', 'seller_confirmed', 'seller_confirmed_at')
        }),
        ('State & Metadata', {
            'fields': ('state', 'created_at', 'updated_at')
        }),
    )


@admin.register(DeliveryTracking)
class DeliveryTrackingAdmin(admin.ModelAdmin):
    """Admin for delivery / escrow tracking."""
    list_display = ('id', 'deal', 'stage', 'seller_confirmed_at', 'in_transit_at', 'delivered_at', 'payment_released_at')
    list_filter = ('stage', 'created_at')
    search_fields = ('deal__id', 'deal__status__caption')
    raw_id_fields = ('deal',)
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Deal', {
            'fields': ('deal',)
        }),
        ('Current Stage', {
            'fields': ('stage', 'notes')
        }),
        ('Stage Timestamps', {
            'fields': ('seller_confirmed_at', 'in_transit_at', 'delivered_at', 'payment_released_at', 'disputed_at')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(SellerRating)
class SellerRatingAdmin(admin.ModelAdmin):
    """Admin for post‑deal ratings (buyer→seller and seller→buyer)."""
    list_display = ('id', 'deal', 'seller_score', 'buyer_score', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('deal__id', 'deal__buyer__username', 'deal__seller__username')
    raw_id_fields = ('deal',)
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at',)

    fieldsets = (
        ('Deal', {
            'fields': ('deal',)
        }),
        ('Buyer → Seller', {
            'fields': ('seller_score', 'seller_note', 'seller_rated_at')
        }),
        ('Seller → Buyer', {
            'fields': ('buyer_score', 'buyer_note', 'buyer_rated_at')
        }),
        ('Metadata', {
            'fields': ('created_at',)
        }),
    )


@admin.register(ListingBump)
class ListingBumpAdmin(admin.ModelAdmin):
    """Admin for listing extensions and bumps."""
    list_display = ('id', 'status', 'user', 'bump_type', 'created_at')
    list_filter = ('bump_type', 'created_at')
    search_fields = ('status__caption', 'user__username')
    raw_id_fields = ('status', 'user')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at',)


# ═══════════════════════════════════════════════════════════════════════════════
# WEB PUSH ADMIN
# ═══════════════════════════════════════════════════════════════════════════════

@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    """
    Admin for browser/device Web Push subscriptions.
    Useful for debugging why a user isn't receiving notifications, and for
    cleaning up stale endpoints (e.g. if a device was reset).
    """
    list_display = (
        'id', 'user', 'endpoint_short', 'user_agent_short',
        'created_at', 'last_seen_ok_at'
    )
    list_filter = ('created_at', 'last_seen_ok_at')
    search_fields = ('user__username', 'endpoint', 'user_agent')
    raw_id_fields = ('user',)
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at', 'endpoint', 'p256dh', 'auth')

    fieldsets = (
        ('Owner', {
            'fields': ('user',)
        }),
        ('Device Info', {
            'fields': ('user_agent', 'last_seen_ok_at')
        }),
        ('Subscription Keys (read‑only)', {
            'fields': ('endpoint', 'p256dh', 'auth'),
            'classes': ('collapse',),
            'description': 'Raw Web Push subscription data. Do not edit manually.'
        }),
        ('Metadata', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )

    actions = ['delete_stale_subscriptions']

    def endpoint_short(self, obj):
        if not obj.endpoint:
            return '-'
        # Show the domain + a short tail so admins can tell devices apart
        # without dumping the full token-length URL into the list view.
        head = obj.endpoint.split('/')[2] if '/' in obj.endpoint else obj.endpoint[:40]
        tail = obj.endpoint[-16:]
        return f"{head}/…/{tail}"
    endpoint_short.short_description = 'Endpoint'

    def user_agent_short(self, obj):
        ua = obj.user_agent or ''
        if len(ua) > 40:
            return ua[:40] + '…'
        return ua or '-'
    user_agent_short.short_description = 'User Agent'

    def delete_stale_subscriptions(self, request, queryset):
        """
        Remove subscriptions that have never successfully received a push
        (last_seen_ok_at is null) and were created more than 30 days ago.
        """
        from django.utils import timezone
        from datetime import timedelta
        cutoff = timezone.now() - timedelta(days=30)
        stale = queryset.filter(last_seen_ok_at__isnull=True, created_at__lt=cutoff)
        count = stale.count()
        stale.delete()
        self.message_user(request, f"Deleted {count} stale subscription(s).")
    delete_stale_subscriptions.short_description = "Delete stale subscriptions (never used, >30 days old)"