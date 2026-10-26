"""
views/__init__.py

Re-exports every public view from the sub-modules so that urls.py can
continue to do:

    from .views import signup_view, send_message_http, ...

without any changes.  Add new views in their own module and re-export
them here.
"""

# ── Auth ────────────────────────────────────────────────────────────────────
from .views_auth import (
    signup_view,
    chat_view,
    get_public_key,
)

# ── Messages ────────────────────────────────────────────────────────────────
from .views_messages import (
    get_messages,
    poll_messages,
    send_message_http,
    mark_messages_as_read,
    get_unread_message_count,
    get_conversation_previews,
    delete_message,
    clear_chat,
    send_typing,
    check_typing,
    read_status,
)

# ── Profile & contacts ──────────────────────────────────────────────────────
from .views_profile import (
    upload_profile_picture,
    update_profile,
    add_contact,
    add_contact_by_phone,
    remove_contact,
    get_my_contacts,
    get_contact_info,
    get_contact_info_by_phone,
    check_phones_on_asterix,
    check_phones,
    sync_contacts,
    search_user,
    block_user,
    unblock_user,
    update_online_status,
    get_online_users,
    normalize_phone,          # used by some URL-less helpers / management commands
)

# ── Attachments ─────────────────────────────────────────────────────────────
from .views_attachments import (
    upload_attachments,
    get_attachments,
    delete_attachment,
)

# ── Status & ads ────────────────────────────────────────────────────────────
from .views_status import (
    get_categorized_status_feed,
    upload_status,
    my_status_page,
    edit_status,
    delete_status,
    share_status_to_external,
    share_listing_view,
    record_status_view,
    get_status_views,
    get_unread_status_counts,
)

# ── Events ──────────────────────────────────────────────────────────────────
from .views_events import (
    create_event,
    invite_to_event,
    event_invite_view,
    rsvp_event,
    get_my_events,
    my_events,
    event_guest_list,
    share_event_to_status,
)

# ── Commerce (offers & deals) ────────────────────────────────────────────────
from .views_commerce import (
    create_offer,
    respond_to_offer,
    withdraw_offer,
    take_listing,
    confirm_deal,
    complete_deal,
    cancel_deal,
)
# ── Negotiation chat ─────────────────────────────────────────────────────────
from .negotiate_views import negotiate_chat

# ── Delivery, ratings & listing management ───────────────────────────────────
from .views_delivery import (
    advance_delivery,
    get_delivery_status,
    submit_rating,
    get_seller_ratings,
    extend_listing,
    bump_listing,

)

# ── Misc (proxy, service worker, ringtone) ───────────────────────────────────
from .views_misc import (
    proxy_status_media,
    sync_ringtone,
    service_worker,
    download_apk,
)

from .views_push import (
    save_push_subscription,
    delete_push_subscription,
)
from .views_fcm import fcm_register, fcm_unregister

__all__ = [
    # auth
    "signup_view", "chat_view", "get_public_key",
    # messages
    "get_messages", "poll_messages", "send_message_http",
    "mark_messages_as_read", "get_unread_message_count",
    "get_conversation_previews", "delete_message", "clear_chat",
    # profile & contacts
    "upload_profile_picture", "update_profile",
    "add_contact", "add_contact_by_phone", "remove_contact",
    "get_my_contacts", "get_contact_info", "get_contact_info_by_phone",
    "check_phones_on_asterix", "check_phones",
    "sync_contacts", "search_user",
    "block_user", "unblock_user",
    "update_online_status", "get_online_users",
    "normalize_phone",
    # attachments
    "upload_attachments", "get_attachments", "delete_attachment",
    # status
    "get_categorized_status_feed", "upload_status", "my_status_page",
    "edit_status", "delete_status", "share_status_to_external", "share_listing_view", "record_status_view", "get_status_views",
    # events
    "create_event", "invite_to_event", "event_invite_view", "rsvp_event",
    "get_my_events", "my_events", "event_guest_list", "share_event_to_status",
    # commerce
    "create_offer", "withdraw_offer",
    "take_listing", "confirm_deal", "complete_deal", "cancel_deal", "negotiate_chat",
    # delivery
    "advance_delivery", "get_delivery_status",
    "submit_rating", "get_seller_ratings",
    "extend_listing", "bump_listing",
    # misc
    "proxy_status_media", "sync_ringtone", "service_worker","respond_to_offer",
        # misc
    "proxy_status_media", "sync_ringtone", "service_worker",
    # push
    "save_push_subscription", "delete_push_subscription",
    "fcm_register", "fcm_unregister",
    "get_unread_status_counts",
]

