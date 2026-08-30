# signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Profile

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
