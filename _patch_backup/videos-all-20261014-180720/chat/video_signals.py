import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Message, VideoEmbed
from .video_links import extract_video_embeds

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Message, dispatch_uid="chat_video_embeds")
def detect_video_links(sender, instance, created, **kwargs):
    if not created or not isinstance(instance.message, str):
        return
    try:
        for item in extract_video_embeds(instance.message):
            VideoEmbed.objects.create(message=instance, **item)
    except Exception:
        logger.exception("video embed detection failed")