# routing.py
#
# DISABLED FOR PYTHONANYWHERE FREE TIER
# PythonAnywhere's free tier serves plain WSGI only, so there's no process
# available to keep WebSocket connections alive. The chat app now uses HTTP
# polling instead (see index.html + views.get_messages /
# views.get_unread_message_count / views.send_message_http). Nothing imports
# `websocket_urlpatterns` from here anymore (see asgi.py), but it's kept as
# an empty list so any stray import doesn't break.
#
# from django.urls import re_path
# from . import consumers
#
# websocket_urlpatterns = [
#     re_path(r"ws/chat/$", consumers.ChatConsumer.as_asgi()),
# ]

websocket_urlpatterns = []