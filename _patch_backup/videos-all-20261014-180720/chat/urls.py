"""
urls.py  —  Asterix Chat (app-level)
"""
from django.urls import path
from django.contrib.auth.views import LoginView, LogoutView
from . import views
from .views import get_online_users, service_worker, save_push_subscription, delete_push_subscription
from django.contrib.auth.decorators import login_required
from django.views.generic import TemplateView
from chat.video_views import video_feed, videos_page, videos_list, videos_add

urlpatterns = [
    # ── Pages ─────────────────────────────────────────────────────────────
    path('',             views.chat_view,   name='chat-page'),
    path('auth/login/',  LoginView.as_view(template_name='Loginpage.html'), name='login-user'),
    path('auth/logout/', LogoutView.as_view(), name='logout-user'),
    path('auth/signup/', views.signup_view, name='signup-user'),

    # ── Encryption ────────────────────────────────────────────────────────
    path('api/key/',     views.get_public_key, name='get-public-key'),

    # ── Messages (HTTP polling — no WebSocket) ────────────────────────────
    path('api/messages/',                         views.get_messages,             name='get-messages'),
    path('api/messages/send/',                    views.send_message_http,        name='send-message'),
    path('api/messages/mark_as_read/',            views.mark_messages_as_read,    name='mark-read'),
    path('api/messages/unread_count/',            views.get_unread_message_count, name='unread-count'),
    path('api/messages/delete/<int:message_id>/', views.delete_message,           name='delete-message'),
    path('api/messages/poll/',                    views.poll_messages,            name='poll-messages'),

    # ── Profile ───────────────────────────────────────────────────────────
    path('api/upload-profile-picture/', views.upload_profile_picture, name='upload-profile-picture'),
    path('api/profile/update/',         views.update_profile,          name='update-profile'),
    path('api/clear-chat/',             views.clear_chat,              name='clear-chat'),
    path('api/block-user/',             views.block_user,              name='block-user'),
    path('api/unblock-user/',           views.unblock_user,            name='unblock-user'),

    # ── Attachments (legacy staging) ──────────────────────────────────────
    path('api/upload-attachments/',     views.upload_attachments, name='upload-attachments'),
    path('api/get-attachments/',        views.get_attachments,    name='get-attachments'),
    path('api/delete-attachment/',      views.delete_attachment,  name='delete-attachment'),

    # ── Status & Ads ──────────────────────────────────────────────────────
    path('api/status/feed/<str:category_name>/', views.get_categorized_status_feed, name='status-feed'),
    path('api/status/upload/',                   views.upload_status,               name='status-upload'),
    path('api/status/mine/',                     views.my_status_page,              name='my-status'),
    path('api/status/<int:status_id>/delete/',   views.delete_status,               name='delete-status'),
    path('api/status/<int:status_id>/edit/',     views.edit_status,                 name='edit-status'),
    path('api/status/share-file/',               views.share_status_to_external,    name='share-status-file'),
    path('api/status/proxy-media/',              views.proxy_status_media,          name='proxy-status-media'),

    # ── Contacts ──────────────────────────────────────────────────────────
    path('api/contacts/sync/',         views.sync_contacts,        name='sync-contacts'),
    path('api/contacts/',              views.get_my_contacts,      name='get-contacts'),
    path('api/contacts/search/',       views.search_user,          name='search-contact'),
    path('api/contacts/add/',          views.add_contact,          name='add-contact'),
    path('api/contacts/add-by-phone/', views.add_contact_by_phone, name='add-contact-by-phone'),
    path('api/contacts/remove/',       views.remove_contact,       name='remove-contact'),
    path('api/contacts/info/',         views.get_contact_info,     name='contact-info'),
    path('api/contacts/check-phones/', views.check_phones,         name='check-phones'),

    # ── Zambian Events ────────────────────────────────────────────────────
    path('api/events/create/',                          views.create_event,           name='event-create'),
    path('api/events/<int:event_id>/invite/',           views.invite_to_event,        name='event-invite'),
    path('api/events/<int:event_id>/rsvp/',             views.rsvp_event,             name='event-rsvp'),
    path('api/events/<int:event_id>/guests/',           views.event_guest_list,       name='event-guests'),
    path('api/events/<int:event_id>/share-to-status/', views.share_event_to_status,  name='event-share-status'),
    path('api/events/mine/',                            views.get_my_events,          name='my-events'),
    path('events/invite/<uuid:invite_token>/',          views.event_invite_view,      name='event-invite-card'),

    # ── Offers & Deals (Zambian bargaining engine) ────────────────────────
    path('api/offers/create/',   views.create_offer,    name='create_offer'),
    path('api/offers/respond/',  views.respond_to_offer, name='respond_to_offer'),
    path('api/offers/withdraw/', views.withdraw_offer,   name='withdraw_offer'),
    path('api/deals/take/',      views.take_listing,     name='take_listing'),
    path('api/deals/confirm/',   views.confirm_deal,     name='confirm_deal'),
    path('api/deals/complete/',  views.complete_deal,    name='complete_deal'),
    path('api/deals/cancel/',    views.cancel_deal,      name='cancel_deal'),
    path('api/negotiate/chat/',  views.negotiate_chat,   name='negotiate_chat'),

    # ── Delivery & Ratings ────────────────────────────────────────────────
    path('api/delivery/advance/', views.advance_delivery,    name='delivery-advance'),
    path('api/delivery/status/',  views.get_delivery_status, name='delivery-status'),
    path('api/ratings/submit/',   views.submit_rating,       name='ratings-submit'),
    path('api/ratings/seller/',   views.get_seller_ratings,  name='ratings-seller'),

    # ── Listing management ────────────────────────────────────────────────
    path('api/listings/extend/', views.extend_listing, name='listings-extend'),
    path('api/listings/bump/',   views.bump_listing,   name='listings-bump'),

    # ── Misc ──────────────────────────────────────────────────────────────
    path('api/users/online/',          get_online_users,            name='get_online_users'),
    path('api/update-online/',         views.update_online_status,  name='update-online'),
    path('api/conversation-previews/', views.get_conversation_previews, name='conversation_previews'),

    # ── PWA / Service Worker ──────────────────────────────────────────────
    path('service-worker.js',         service_worker,              name='service-worker'),
    path('api/push/subscribe/',        save_push_subscription,      name='push-subscribe'),
    path('api/push/unsubscribe/',      delete_push_subscription,    name='push-unsubscribe'),
    path("videos/", login_required(TemplateView.as_view(template_name="videos.html")), name="video_page"),
    path("videos/", videos_page, name="video_page"),
    path("videos/feed/", video_feed, name="video_feed"),
    path("videos/list/", videos_list, name="video_list"),
    path("videos/add/", videos_add, name="video_add"),

]