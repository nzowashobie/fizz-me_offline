# route.py
#
# DISABLED FOR PYTHONANYWHERE FREE TIER - see routing.py / consumers.py for
# the full explanation. This file looked like an alternate/duplicate of
# routing.py; it's neutralized the same way so nothing accidentally wires
# ChatConsumer back up.
#
# from django.urls import path, include
# from chat.consumers import ChatConsumer
#
# websocket_urlpatterns = [
#     path("", ChatConsumer.as_asgi()),
# ]

websocket_urlpatterns = []