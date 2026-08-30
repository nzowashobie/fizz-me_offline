"""
DISABLED FOR PYTHONANYWHERE FREE TIER
======================================
PythonAnywhere's free (and most paid) tiers only serve plain WSGI - there is
no long-running process to hold WebSocket connections open, so Django
Channels consumers like ChatConsumer below never actually get invoked there.

The chat app now sends/receives messages over regular HTTP endpoints in
views.py (see `send_message_http`, `get_messages`, `get_unread_message_count`)
and the frontend polls those endpoints on an interval instead of opening a
WebSocket (see the polling code in index.html).

This file is kept (commented out) in case you later move to a host that
supports ASGI/WebSockets (Railway, Render, Fly.io, a VPS, etc.) and want to
re-enable real-time push instead of polling.
"""

# import json
# from channels.generic.websocket import AsyncWebsocketConsumer
# from asgiref.sync import sync_to_async
# from .models import Message, Attachment, CustomUser, Profile
# from django.core.files.base import ContentFile
# import base64
# import mimetypes


# class ChatConsumer(AsyncWebsocketConsumer):
#     async def connect(self):
#         self.sender = self.scope["user"].username
#         print(f"WebSocket connected: {self.sender}")

#         self.sender_group_name = f"chat_{self.sender.replace(' ', '_')}"

#         await self.channel_layer.group_add(
#             self.sender_group_name,
#             self.channel_name
#         )

#         await self.accept()

#     async def disconnect(self, close_code):
#         print(f"WebSocket disconnected: {self.sender}")

#         await self.channel_layer.group_discard(
#             self.sender_group_name,
#             self.channel_name
#         )

#     async def receive(self, text_data):
#         try:
#             data = json.loads(text_data)
#             print("Received data:", data)

#             message = data.get("message")
#             recipient = data.get("recipient")
#             attachments = data.get("attachments", [])

#             if not message or not recipient:
#                 print("Error: Missing 'message' or 'recipient' in data.")
#                 await self.send(text_data=json.dumps({
#                     "type": "error",
#                     "message": "Missing 'message' or 'recipient' in data."
#                 }))
#                 return

#             recipient_group_name = f"chat_{recipient.replace(' ', '_')}"

#             # Save the message and get its ID
#             message_id = await self.save_message(self.sender, recipient, message)

#             if message_id is None:
#                 print("Error: Failed to save message.")
#                 await self.send(text_data=json.dumps({
#                     "type": "error",
#                     "message": "Failed to save message."
#                 }))
#                 return

#             # Save attachments and get their details
#             saved_attachments = []
#             for attachment in attachments:
#                 print("Saving attachment:", attachment)
#                 attachment_data = await self.save_attachment(message_id, attachment)
#                 if attachment_data:
#                     saved_attachments.append(attachment_data)

#             # Get the sender's profile picture
#             sender_profile_picture = await self.get_profile_picture(self.sender)
#             print(f"Sender profile picture URL: {sender_profile_picture}")

#             # Prepare the message data to be sent
#             message_data = {
#                 "type": "chat_message",
#                 "message": message,
#                 "sender": self.sender,
#                 "sender_profile_picture": sender_profile_picture,
#                 "attachments": saved_attachments,  # Include attachments
#                 "unread_count": await self.get_unread_count(recipient),
#                 "recipient": recipient,
#             }

#             # Send the message to the recipient's group
#             await self.channel_layer.group_send(
#                 recipient_group_name,
#                 message_data
#             )

#             # Send the message to the sender's group
#             await self.channel_layer.group_send(
#                 self.sender_group_name,
#                 message_data
#             )

#             # Send a notification to the recipient
#             await self.channel_layer.group_send(
#                 f"notify_{recipient.replace(' ', '_')}",
#                 {
#                     "type": "notification",
#                     "sender": self.sender,
#                     "sender_profile_picture": sender_profile_picture,
#                     "message": "You have a new message",
#                     "unread_count": await self.get_unread_count(recipient),
#                     "recipient": self.sender,
#                 }
#             )

#         except Exception as e:
#             print(f"Error in receive method: {e}")
#             await self.send(text_data=json.dumps({
#                 "type": "error",
#                 "message": f"An error occurred: {str(e)}"
#             }))

#     async def chat_message(self, event):
#         # Send the message and attachments to the WebSocket client
#         await self.send(text_data=json.dumps({
#             "type": "chat_message",
#             "message": event["message"],
#             "sender": event["sender"],
#             "sender_profile_picture": event.get("sender_profile_picture"),
#             "attachments": event.get("attachments", []),  # Include attachments
#             "unread_count": event.get("unread_count", 0),
#             "recipient": event.get("recipient"),
#         }))

#     async def notification(self, event):
#         await self.send(text_data=json.dumps({
#             "type": "notification",
#             "sender": event["sender"],
#             "sender_profile_picture": event.get("sender_profile_picture"),
#             "message": event["message"],
#             "unread_count": event.get("unread_count", 0),
#             "recipient": event.get("recipient"),
#         }))

#     @sync_to_async
#     def save_message(self, sender, recipient, message):
#         try:
#             sender_user = CustomUser.objects.get(username=sender)
#             recipient_user = CustomUser.objects.get(username=recipient)
#             message_obj = Message.objects.create(
#                 sender=sender_user,
#                 recipient=recipient_user,
#                 message=message,
#                 is_read=False,
#             )
#             print(f"Message saved: {message_obj.id}")
#             return message_obj.id
#         except CustomUser.DoesNotExist:
#             print(f"User not found: sender={sender}, recipient={recipient}")
#             return None
#         except Exception as e:
#             print(f"Error saving message: {e}")
#             return None

#     @sync_to_async
#     def save_attachment(self, message_id, attachment):
#         try:
#             message = Message.objects.get(id=message_id)
#             file_data = base64.b64decode(attachment["file_data"])  # Decode base64 data
#             file_name = attachment["file_name"]
#             file = ContentFile(file_data, name=file_name)  # Create a ContentFile

#             # Determine file type using mimetypes
#             file_type, _ = mimetypes.guess_type(file_name)
#             file_type = file_type or "application/octet-stream"  # Default to binary if type is unknown

#             # Save the attachment
#             attachment_obj = Attachment.objects.create(
#                 message=message,
#                 file=file,
#                 file_type=file_type,  # Set the file_type here
#             )

#             # Construct the full file URL
#             file_url = attachment_obj.file.url  # This should include the /media/ prefix
#             print(f"Attachment saved: {file_url}")  # Log the file URL

#             return {
#                 "file_url": file_url,  # Ensure this is the full URL
#                 "file_name": file_name,
#                 "file_type": file_type,
#             }
#         except Exception as e:
#             print(f"Error saving attachment: {e}")
#             return None

#     @sync_to_async
#     def get_unread_count(self, recipient):
#         try:
#             return Message.objects.filter(recipient__username=recipient, is_read=False).count()
#         except Exception as e:
#             print(f"Error fetching unread count: {e}")
#             return 0

#     @sync_to_async
#     def get_profile_picture(self, username):
#         try:
#             user = CustomUser.objects.get(username=username)
#             profile = Profile.objects.get(user=user)
#             profile_picture_url = profile.profile_picture.url if profile.profile_picture else '/static/images/social.webp'
#             print(f"Profile picture URL for {username}: {profile_picture_url}")
#             return profile_picture_url
#         except Profile.DoesNotExist:
#             print(f"Profile not found for user: {username}")
#             return '/static/images/social.webp'
#         except Exception as e:
#             print(f"Error fetching profile picture: {e}")
#             return '/static/images/social.webp'