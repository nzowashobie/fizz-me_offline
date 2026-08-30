"""
ASGI config for projec project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/

DISABLED FOR PYTHONANYWHERE FREE TIER
--------------------------------------
PythonAnywhere's free tier only serves plain WSGI, so this file isn't even
used there - `wsgi.py` is the real entry point (that's what you point
PythonAnywhere's "WSGI configuration file" at). The Channels/WebSocket
routing that used to live here has been commented out; chat now works over
plain HTTP + polling (see chat/consumers.py and chat/views.py for details).

If you later move to a host that supports ASGI (Railway, Render, Fly.io, a
VPS, etc.) and want real-time WebSocket push again, uncomment the block
below and re-enable chat/consumers.py + chat/routing.py.
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat.settings')

# from channels.auth import AuthMiddlewareStack
# from channels.routing import ProtocolTypeRouter, URLRouter
# from chat import routing
#
# application = ProtocolTypeRouter(
#     {
#         "http": get_asgi_application(),
#         "websocket": AuthMiddlewareStack(
#             URLRouter(
#                 routing.websocket_urlpatterns
#             )
#         )
#     }
# )

application = get_asgi_application()