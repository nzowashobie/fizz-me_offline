from chat.video_views import video_feed, videos_page, videos_list, videos_add, videos_unseen
"""
projec/urls.py  —  Project-level URL config
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# If you have a custom admin site, swap the import below:
# from chat.admin import custom_admin_site

urlpatterns = [
    path("videos/", videos_page, name="video_page"),
    path("videos/feed/", video_feed, name="video_feed"),
    path("videos/list/", videos_list, name="video_list"),
    path("videos/add/", videos_add, name="video_add"),
    path("videos/unseen/", videos_unseen, name="video_unseen"),
    path('admin/', admin.site.urls),
    path('', include('chat.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)