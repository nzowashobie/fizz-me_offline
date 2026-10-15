"""
models.py  —  Asterix Chat
All models in one file; each section is clearly delimited.
"""
import os
import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.core.validators import RegexValidator
from phonenumber_field.modelfields import PhoneNumberField
from cloudinary.models import CloudinaryField
from django.utils import timezone  # added for expiry calculations


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════════════════════

class CustomUser(AbstractUser):
    username = models.CharField(
        max_length=150,
        unique=True,
        validators=[RegexValidator(
            regex=r'^[a-zA-Z0-9_ ]*$',
            message='Username can only contain letters, digits, spaces, and underscores.'
        )],
    )
    phone_number = PhoneNumberField(unique=True, region="US", blank=False, null=False)
    public_key   = models.TextField(blank=True, null=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    USERNAME_FIELD  = 'username'
    REQUIRED_FIELDS = ['phone_number']

    def __str__(self):
        return self.username


class Contact(models.Model):
    owner        = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='contacts_owned',    on_delete=models.CASCADE)
    contact_user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='contacts_added_by', on_delete=models.CASCADE)
    display_name = models.CharField(max_length=150, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('owner', 'contact_user')


# ═══════════════════════════════════════════════════════════════════════════════
# PROFILE
# ═══════════════════════════════════════════════════════════════════════════════

class Profile(models.Model):
    user            = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    phone_number    = models.CharField(max_length=15, blank=True, null=True)
    profile_picture = CloudinaryField('profile_picture', blank=True, null=True)

    def __str__(self):
        return f"Profile of {self.user.username}"

    @property
    def profile_picture_url(self):
        try:
            pp = self.profile_picture
            pid = getattr(pp, 'public_id', None) or getattr(pp, 'name', None)
            if pid:
                url = pp.url
                if url and url.startswith('http://'):
                    url = url.replace('http://', 'https://', 1)
                return url or ''
        except Exception:
            pass
        return ''


# ═══════════════════════════════════════════════════════════════════════════════
# MESSAGING
# ═══════════════════════════════════════════════════════════════════════════════

MESSAGE_TYPE_CHOICES = [
    ('text',              'Text'),
    ('offer',             'Offer'),
    ('deal_confirmation', 'Deal Confirmation'),
    ('status_update',     'Status Update'),
]

class Message(models.Model):
    sender    = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='sent_messages',     on_delete=models.CASCADE)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='received_messages', on_delete=models.CASCADE)
    message   = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read   = models.BooleanField(default=False)
    cleared_by_recipient = models.BooleanField(default=False)
    cleared_by_sender    = models.BooleanField(default=False)
    reply_to_msg = models.ForeignKey('self', null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name='replies')
    reply_sender = models.CharField(max_length=150, blank=True)
    reply_text   = models.TextField(blank=True)
    reply_media  = models.TextField(blank=True)

    # ── Commerce extension ──────────────────────────────────────────────
    related_status = models.ForeignKey(
        'UserStatus', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='conversations'
    )

    # New fields for deal/offer messages
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, default='text')
    offer = models.ForeignKey('Offer', null=True, blank=True, on_delete=models.SET_NULL, related_name='messages')
    deal  = models.ForeignKey('Deal',  null=True, blank=True, on_delete=models.SET_NULL, related_name='messages')

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"From {self.sender} to {self.recipient} @ {self.timestamp:%Y-%m-%d %H:%M}"


class Attachment(models.Model):
    message     = models.ForeignKey(Message, related_name='attachments', on_delete=models.CASCADE, null=True, blank=True)
    file        = CloudinaryField('attachment', resource_type='auto', blank=True, null=True)
    file_type   = models.CharField(max_length=100)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    original_filename = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"Attachment for Message #{self.message_id}"


# ═══════════════════════════════════════════════════════════════════════════════
# SOCIAL CONTROLS
# ═══════════════════════════════════════════════════════════════════════════════

class BlockedUser(models.Model):
    user         = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_users')
    blocked_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_by')
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'blocked_user')

    def __str__(self):
        return f"{self.user.username} blocked {self.blocked_user.username}"


# ═══════════════════════════════════════════════════════════════════════════════
# STATUS & ADVERTISING
# ═══════════════════════════════════════════════════════════════════════════════

class StatusCategory(models.Model):
    name = models.CharField(max_length=50, unique=True)
    icon = models.CharField(max_length=50, default='fa-circle')

    def __str__(self):
        return self.name


PRODUCT_CATEGORY_CHOICES = [
    ('clothing',   'Clothing'),
    ('shoes',      'Shoes'),
    ('cosmetics',  'Cosmetics'),
    ('bags',       'Bags'),
    ('household',  'Household'),
    ('other',      'Other'),
]

AVAILABILITY_CHOICES = [
    ('available', 'Available'),
    ('reserved',  'Reserved'),
    ('sold',      'Sold'),
]

class UserStatus(models.Model):
    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='statuses')
    category    = models.ForeignKey(StatusCategory, on_delete=models.SET_NULL, null=True, related_name='statuses')
    media       = CloudinaryField('status_media', resource_type='auto')
    market_link = models.URLField(max_length=500, blank=True, null=True)
    caption     = models.CharField(max_length=255, blank=True, null=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    # ── Commerce extension ──────────────────────────────────────────────
    is_commercial     = models.BooleanField(default=False, db_index=True)
    price             = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_negotiable     = models.BooleanField(default=False)
    availability      = models.CharField(max_length=20, choices=AVAILABILITY_CHOICES, default='available', blank=True)
    product_category  = models.CharField(max_length=20, choices=PRODUCT_CATEGORY_CHOICES, blank=True, db_index=True)
    custom_tag        = models.CharField(max_length=50, blank=True)
    collection_point  = models.CharField(max_length=255, blank=True)

    # ── Extension & Bump support (NEW) ──────────────────────────────────
    expires_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Overrides the default 24-hour window when set."
    )
    bumped_at  = models.DateTimeField(
        null=True, blank=True,
        help_text="Last time this listing was bumped to the top."
    )
    bump_count = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        cat = self.category.name if self.category else 'No Category'
        return f"{self.user.username} — {cat}"


class AdCampaign(models.Model):
    advertiser_name = models.CharField(max_length=100)
    category        = models.ForeignKey(StatusCategory, on_delete=models.CASCADE, related_name='ads')
    media           = CloudinaryField('ad_media', resource_type='auto')
    website_link    = models.URLField()
    is_active       = models.BooleanField(default=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Ad: {self.advertiser_name} in {self.category.name}"


# ═══════════════════════════════════════════════════════════════════════════════
# COMMERCE: NEGOTIATION & DEALS
# ═══════════════════════════════════════════════════════════════════════════════

OFFER_STATE_CHOICES = [
    ('pending',   'Pending'),
    ('accepted',  'Accepted'),
    ('declined',  'Declined'),
    ('countered', 'Countered'),
    ('withdrawn', 'Withdrawn'),
]

class Offer(models.Model):
    status = models.ForeignKey('UserStatus', on_delete=models.CASCADE, related_name='offers')
    buyer  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='offers_made')
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='offers_received')
    proposed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='offers_proposed')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    state  = models.CharField(max_length=20, choices=OFFER_STATE_CHOICES, default='pending')
    parent_offer = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='counters'
    )
    note = models.CharField(max_length=280, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Offer K{self.amount} on status #{self.status_id} by {self.proposed_by.username} ({self.state})"


DEAL_STATE_CHOICES = [
    ('pending_confirmation', 'Pending Confirmation'),
    ('confirmed',            'Confirmed'),
    ('completed',            'Completed'),
    ('cancelled',            'Cancelled'),
]

class Deal(models.Model):
    status = models.ForeignKey('UserStatus', on_delete=models.CASCADE, related_name='deals')
    buyer  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='deals_as_buyer')
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='deals_as_seller')
    offer  = models.ForeignKey(Offer, null=True, blank=True, on_delete=models.SET_NULL, related_name='deal')
    final_price = models.DecimalField(max_digits=10, decimal_places=2)
    collection_point_snapshot = models.CharField(max_length=255, blank=True)

    buyer_confirmed     = models.BooleanField(default=False)
    buyer_confirmed_at  = models.DateTimeField(null=True, blank=True)
    seller_confirmed    = models.BooleanField(default=False)
    seller_confirmed_at = models.DateTimeField(null=True, blank=True)

    payment_method = models.CharField(max_length=50, blank=True, null=True)
    delivery_address = models.TextField(blank=True, null=True)
    delivery_instructions = models.TextField(blank=True, null=True)

    # ── NEW: payment account & reference ────────────────────────────────
    payment_account   = models.CharField(max_length=100, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    payment_instructions = models.TextField(blank=True, default='')

    state = models.CharField(max_length=25, choices=DEAL_STATE_CHOICES, default='pending_confirmation')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Deal K{self.final_price} — {self.buyer.username} ↔ {self.seller.username} ({self.state})"


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 1 — DELIVERY / ESCROW TRACKING
# ═══════════════════════════════════════════════════════════════════════════════

DELIVERY_STAGE_CHOICES = [
    ('order_placed',      '📦 Order Placed'),
    ('seller_confirmed',  '✅ Seller Confirmed'),
    ('in_transit',        '🚚 In Transit'),
    ('delivered',         '📬 Delivered'),
    ('payment_released',  '💰 Payment Released'),
    ('disputed',          '⚠️ Disputed'),
]


class DeliveryTracking(models.Model):
    """
    One row per deal — tracks where in the fulfilment process it is.
    Created automatically when a deal transitions to 'completed'.
    Both parties can advance the stage; only buyer can release payment.
    """
    deal  = models.OneToOneField(
        'Deal', on_delete=models.CASCADE, related_name='delivery_tracking'
    )
    stage = models.CharField(
        max_length=25, choices=DELIVERY_STAGE_CHOICES, default='order_placed'
    )
    notes = models.TextField(blank=True)  # optional stage-change note

    # Timestamps per stage (null = not reached yet)
    seller_confirmed_at  = models.DateTimeField(null=True, blank=True)
    in_transit_at        = models.DateTimeField(null=True, blank=True)
    delivered_at         = models.DateTimeField(null=True, blank=True)
    payment_released_at  = models.DateTimeField(null=True, blank=True)
    disputed_at          = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Delivery for Deal #{self.deal_id} — {self.stage}"


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 2 — SELLER REPUTATION / RATINGS
# ═══════════════════════════════════════════════════════════════════════════════

class SellerRating(models.Model):
    """
    Left by either party after a deal reaches 'payment_released'.
    One rating per (rater, deal) pair — enforced by unique_together.
    seller_rating  = what the buyer thought of the seller.
    buyer_rating   = what the seller thought of the buyer.
    We store both on the same row so one query fetches both sides.
    """
    deal   = models.OneToOneField(
        'Deal', on_delete=models.CASCADE, related_name='rating'
    )
    # Buyer → Seller
    seller_score = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="1–5 stars given by the buyer to the seller"
    )
    seller_note  = models.CharField(max_length=200, blank=True)
    seller_rated_at = models.DateTimeField(null=True, blank=True)

    # Seller → Buyer
    buyer_score  = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="1–5 stars given by the seller to the buyer"
    )
    buyer_note   = models.CharField(max_length=200, blank=True)
    buyer_rated_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Rating for Deal #{self.deal_id}"


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 3 — LISTING EXPIRY EXTENSION & BUMP
# ═══════════════════════════════════════════════════════════════════════════════

class ListingBump(models.Model):
    """
    Records every time a seller extended or bumped their listing.
    Useful for audit, analytics, and preventing abuse (rate-limiting).
    """
    BUMP_TYPE_CHOICES = [
        ('extend', '🕐 24-hour Extension'),
        ('bump',   '🚀 Feed Bump'),
    ]
    status    = models.ForeignKey(
        'UserStatus', on_delete=models.CASCADE, related_name='bumps'
    )
    user      = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='listing_bumps'
    )
    bump_type = models.CharField(max_length=10, choices=BUMP_TYPE_CHOICES, default='bump')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_bump_type_display()} on status #{self.status_id} by {self.user.username}"


# ═══════════════════════════════════════════════════════════════════════════════
# ZAMBIAN EVENTS — Wedding / Chilanga Mulilo / Kitchen Party / Lobola etc.
# ═══════════════════════════════════════════════════════════════════════════════

class ZambianEvent(models.Model):
    EVENT_TYPES = [
        ('wedding',         '💍 Wedding'),
        ('chilanga_mulilo', '🍲 Chilanga Mulilo'),
        ('kitchen_party',   '🎀 Kitchen Party'),
        ('lobola',          '🐄 Lobola'),
        ('baby_shower',     '🍼 Baby Shower'),
        ('funeral',         '🕊 Ziweto / Funeral'),
        ('graduation',      '🎓 Graduation'),
        ('other',           '🎉 Other Celebration'),
    ]

    VISIBILITY_CHOICES = [
        ('invite_only', 'Invite Only — only people I choose'),
        ('contacts',    'My Contacts Only'),
        ('public',      'Public — anyone with the link'),
    ]

    host            = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='hosted_events')
    event_type      = models.CharField(max_length=30, choices=EVENT_TYPES, default='wedding')
    title           = models.CharField(max_length=200)
    description     = models.TextField(blank=True)
    venue           = models.CharField(max_length=300, blank=True)
    event_date      = models.DateTimeField()
    visibility      = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='invite_only')
    invite_token    = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    cover_photo     = CloudinaryField('event_cover', resource_type='auto', blank=True, null=True)
    dress_code      = models.CharField(max_length=100, blank=True)
    rsvp_deadline   = models.DateField(blank=True, null=True)
    bride_name      = models.CharField(max_length=150, blank=True, help_text="For weddings")
    groom_name      = models.CharField(max_length=150, blank=True, help_text="For weddings")
    family_contact  = models.CharField(max_length=150, blank=True, help_text="Family contact person name")
    family_phone    = models.CharField(max_length=30,  blank=True, help_text="Family contact phone")
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-event_date']

    def __str__(self):
        return f"{self.get_event_type_display()} — {self.title} by {self.host.username}"

    @property
    def invite_url_path(self):
        return f"/events/invite/{self.invite_token}/"


class EventInvitee(models.Model):
    RSVP_CHOICES = [
        ('pending',  'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('maybe',    'Maybe'),
    ]

    event    = models.ForeignKey(ZambianEvent, on_delete=models.CASCADE, related_name='invitees')
    user     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='event_invitations')
    rsvp     = models.CharField(max_length=10, choices=RSVP_CHOICES, default='pending')
    invited_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        unique_together = ('event', 'user')

    def __str__(self):
        return f"{self.user.username} invited to {self.event.title} — RSVP: {self.rsvp}"


class EventStatusShare(models.Model):
    event      = models.ForeignKey(ZambianEvent, on_delete=models.CASCADE, related_name='status_shares')
    shared_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='event_status_shares')
    status     = models.ForeignKey(UserStatus, on_delete=models.CASCADE, related_name='event_shares')
    shared_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('event', 'shared_by')

    def __str__(self):
        return f"{self.shared_by.username} shared {self.event.title} to status"

class StatusMedia(models.Model):
    status = models.ForeignKey(UserStatus, related_name='media_items', on_delete=models.CASCADE)
    file   = CloudinaryField('status_media', resource_type='auto')  # ← was FileField
    order  = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

# ═══════════════════════════════════════════════════════════════════════════════
# WEB PUSH — add this section to models.py (anywhere below CustomUser is fine,
# e.g. right after the Profile section). Purely additive — nothing else changes.
# ═══════════════════════════════════════════════════════════════════════════════

class PushSubscription(models.Model):
    """
    One row per browser/device subscription (PushManager.subscribe() result).
    A user can have several — one per browser/device they installed the PWA on.
    endpoint is unique per browser+device, so re-subscribing (e.g. after
    clearing site data) just updates the existing row via endpoint lookup.
    """
    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint   = models.URLField(max_length=500, unique=True)
    p256dh     = models.CharField(max_length=255)
    auth       = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_ok_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Push sub for {self.user.username} ({self.endpoint[:40]}…)"

######online videos



class VideoEmbed(models.Model):
    message = models.ForeignKey(
        settings.ASTERIX_MESSAGE_MODEL,
        on_delete=models.CASCADE,   # deleting a message also removes its video rows
        related_name="+",
    )
    provider = models.CharField(max_length=20)
    source_url = models.URLField(max_length=500)
    embed_url = models.URLField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]


# ----- Videos pasted on the Videos page -----
class SharedVideo(models.Model):
    user = models.ForeignKey(
        "CustomUser",
        on_delete=models.CASCADE,
        related_name="shared_videos",
    )
    provider = models.CharField(max_length=20)
    source_url = models.URLField(max_length=500)
    embed_url = models.URLField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    note = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-id"]
