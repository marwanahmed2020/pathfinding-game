from django.urls import re_path
from .consumers import GameConsumer  # Import GameConsumer directly

websocket_urlpatterns = [
    re_path(r'ws/game/$', GameConsumer.as_asgi()),  # Use GameConsumer directly
]