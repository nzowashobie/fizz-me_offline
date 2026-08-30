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
    path('admin/', admin.site.urls),
    path('', include('chat.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)