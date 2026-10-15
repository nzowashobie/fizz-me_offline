from django.apps import AppConfig


class ChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'chat'

class AsterixVideosConfig(AppConfig):
    name = "asterix_videos"

    def ready(self):
        from .signals import connect
        connect(apps.get_model(settings.ASTERIX_MESSAGE_MODEL))