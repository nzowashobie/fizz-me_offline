# signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Profile
import logging

from django.db.models.signals import post_save

from .models import VideoEmbed
from .video_links import extract_video_embeds

logger = logging.getLogger(__name__)




@receiver(post_save, sender=get_user_model())
def create_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=get_user_model())
def save_profile(sender, instance, **kwargs):
    instance.profile.save()

# apps.py (to make sure signals are connected)
from django.apps import AppConfig

class chatConfig(AppConfig):
    name = 'chat'

    def ready(self):
        import chat.signals  # Ensure signals are connected when app is ready





def _on_message_saved(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        text = instance.message if isinstance(instance.message, str) else ""
        for item in extract_video_embeds(text):
            VideoEmbed.objects.create(message=instance, **item)
    except Exception:
        # Never let video detection break a message send.
        logger.exception("asterix_videos: failed to extract video links")


def connect(message_model):
    post_save.connect(
        _on_message_saved,
        sender=message_model,
        dispatch_uid="asterix_videos_on_message_saved",
    )
