import json
import random
import string
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import async_to_sync

class GameConsumer(AsyncWebsocketConsumer):
    rooms = {}
    
    async def connect(self):
        await self.accept()
        await self.send(json.dumps({
            'type': 'connection_established'
        }))
    
    async def disconnect(self, close_code):
        # Remove room if host disconnects
        for room_code, room_info in list(self.rooms.items()):
            if room_info['host'] == self.channel_name:
                del self.rooms[room_code]
                break
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'create_room':
                room_code = ''.join(random.choices(string.ascii_uppercase, k=4))
                while room_code in self.rooms:
                    room_code = ''.join(random.choices(string.ascii_uppercase, k=4))
                
                # Create new room
                self.rooms[room_code] = {
                    'host': self.channel_name,
                    'players': [self.channel_name],
                    'game_state': None
                }
                
                # Store the room code
                self.room_code = room_code
                
                # Join the room group
                await self.channel_layer.group_add(
                    f'game_{room_code}',
                    self.channel_name
                )
                
                await self.send(json.dumps({
                    'type': 'room_created',
                    'room_code': room_code
                }))
            
            elif message_type == 'join_room':
                room_code = data.get('room_code')
                if room_code not in self.rooms:
                    await self.send(json.dumps({
                        'type': 'error',
                        'message': 'Room not found'
                    }))
                    return
                
                room = self.rooms[room_code]
                if len(room['players']) >= 2:
                    await self.send(json.dumps({
                        'type': 'error',
                        'message': 'Room is full'
                    }))
                    return
                
                # Store the room code
                self.room_code = room_code
                
                # Add player to room
                room['players'].append(self.channel_name)
                
                # Join the room group
                await self.channel_layer.group_add(
                    f'game_{room_code}',
                    self.channel_name
                )
                
                await self.send(json.dumps({
                    'type': 'room_joined',
                    'room_code': room_code
                }))
                
                # If there's a game state, send it immediately
                if room['game_state']:
                    await self.send(json.dumps({
                        'type': 'game_state_update',
                        'gameState': room['game_state']
                    }))
                    
                # Notify host that player 2 has joined
                await self.channel_layer.group_send(
                    f'game_{room_code}',
                    {
                        'type': 'player_joined',
                        'player': 2
                    }
                )
            
            elif message_type == 'game_state_update':
                room_code = data.get('room_code')
                if room_code in self.rooms:
                    room = self.rooms[room_code]
                    game_state = data.get('gameState')
                    room['game_state'] = game_state
                    
                    # Broadcast to the room group
                    await self.channel_layer.group_send(
                        f'game_{room_code}',
                        {
                            'type': 'broadcast_game_state',
                            'gameState': game_state,
                            'sender': self.channel_name
                        }
                    )
            
            elif message_type == 'player_ready':
                room_code = data.get('room_code')
                if room_code in self.rooms:
                    await self.channel_layer.group_send(
                        f'game_{room_code}',
                        {
                            'type': 'player_ready_update',
                            'player': self.channel_name
                        }
                    )
        
        except Exception as e:
            print(f"Error in receive: {str(e)}")
            await self.send(json.dumps({
                'type': 'error',
                'message': str(e)
            }))
    
    async def broadcast_game_state(self, event):
        """
        Handler for game state updates
        """
        if event['sender'] != self.channel_name:  # Don't send back to sender
            await self.send(json.dumps({
                'type': 'game_state_update',
                'gameState': event['gameState']
            }))
    
    async def player_ready_update(self, event):
        """
        Handler for player ready updates
        """
        await self.send(json.dumps({
            'type': 'player_ready',
            'player': event['player']
        }))
    
    async def player_joined(self, event):
        """
        Handler for player joined notification
        """
        await self.send(json.dumps({
            'type': 'player_joined',
            'player': event['player']
        })) 