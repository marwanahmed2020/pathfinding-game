class MultiplayerGame {
    constructor() {
        console.log("Initializing MultiplayerGame...");
        
        // Get canvas and context
        this.canvas = document.getElementById('world-map-canvas');
        if (!this.canvas) {
            console.error("Canvas not found!");
            return;
        }
        console.log("Canvas found:", this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        
        // Set fixed canvas dimensions
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        // Grid settings
        this.gridSize = 40;
        this.gridWidth = Math.floor(this.canvas.width / this.gridSize);
        this.gridHeight = Math.floor(this.canvas.height / this.gridSize);
        
        // Initialize game state
        this.gameState = {
            phase: 'waiting',
            roomCode: '',
            isHost: false,
            currentPlayer: null,
            playerPositions: {
                player1: null,
                player2: null
            },
            endPositions: {
                player1: null,
                player2: null
            },
            walls: [],
            currentSelection: 'player1',
            readyPlayers: new Set()
        };
        
        // Initialize WebSocket
        this.initializeWebSocket();
        
        // Initialize UI elements
        this.initializeUI();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Draw initial grid
        this.drawGrid();
        
        // Add window resize handler
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
        
        console.log("MultiplayerGame initialized successfully");
    }
    
    initializeWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/game/`;
        console.log("Attempting WebSocket connection to:", wsUrl);

        try {
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log("WebSocket connection established");
                this.updateStatus("Connected to server");
            };

            this.socket.onclose = () => {
                console.log("WebSocket connection closed");
                this.updateStatus("Disconnected from server");
            };

            this.socket.onerror = (error) => {
                console.error("WebSocket error:", error);
            };

            this.socket.onmessage = (event) => {
                console.log("WebSocket message received:", event.data);
                this.handleWebSocketMessage(event.data);
            };
        } catch (error) {
            console.error("Failed to initialize WebSocket:", error);
        }
    }
    
    initializeUI() {
        console.log("Initializing UI elements...");
        
        // Get phase containers
        this.waitingRoom = document.getElementById('waiting-room');
        this.setupPhase = document.getElementById('setup-phase');
        this.gamePhase = document.getElementById('game-phase');
        
        // Get buttons
        this.createRoomBtn = document.getElementById('create-room');
        this.joinRoomBtn = document.getElementById('join-room');
        this.readyBtn = document.getElementById('ready');
        
        // Get input fields
        this.roomCodeInput = document.getElementById('room-code-input');
        this.roomCodeDisplay = document.getElementById('room-code-display');
        this.currentPlayerDisplay = document.getElementById('current-player');
        
        console.log("UI elements initialized");
    }
    
    setupEventListeners() {
        console.log("Setting up event listeners...");
        
        // Create room button
        this.createRoomBtn.addEventListener('click', () => {
            console.log("Create room button clicked");
            this.createRoom();
        });
        
        // Join room button
        this.joinRoomBtn.addEventListener('click', () => {
            console.log("Join room button clicked");
            const roomCode = this.roomCodeInput.value.toUpperCase();
            if (roomCode.length === 4) {
                this.joinRoom(roomCode);
            }
        });
        
        // Ready button
        this.readyBtn.addEventListener('click', () => {
            console.log("Ready button clicked");
            this.playerReady();
        });
        
        // Canvas click event
        this.canvas.addEventListener('click', (event) => this.handleCanvasClick(event));
        
        // Keyboard events for mode selection and movement
        document.addEventListener('keydown', (event) => {
            if (this.gameState.phase === 'setup') {
                switch (event.key.toLowerCase()) {
                    case '1':
                        if (this.gameState.isHost) {
                            this.gameState.currentSelection = 'player1';
                            console.log("Selected Player 1 start position");
                        }
                        break;
                    case '2':
                        if (this.gameState.isHost) {
                            this.gameState.currentSelection = 'player2';
                            console.log("Selected Player 2 start position");
                        }
                        break;
                    case 'w':
                        if (this.gameState.isHost) {
                            this.gameState.currentSelection = 'wall';
                            console.log("Selected wall placement");
                        }
                        break;
                    case 'e':
                        if (this.gameState.isHost) {
                            this.gameState.currentSelection = this.gameState.currentSelection === 'end1' ? 'end2' : 'end1';
                            console.log(`Selected end position for Player ${this.gameState.currentSelection === 'end1' ? '1' : '2'}`);
                        }
                        break;
                }
            } else if (this.gameState.phase === 'game') {
                this.handleMovement(event.key);
            }
        });
        
        console.log("Event listeners set up");
    }
    
    createRoom() {
        console.log("Creating room...");
        if (this.socket.readyState === WebSocket.OPEN) {
            this.createRoomBtn.disabled = true;
            this.createRoomBtn.textContent = "Creating...";
            
            this.socket.send(JSON.stringify({
                type: 'create_room'
            }));
        } else {
            console.error("WebSocket is not open");
            this.updateStatus("Connection error. Please refresh the page.");
        }
    }
    
    joinRoom(roomCode) {
        console.log("Joining room:", roomCode);
        if (this.socket.readyState === WebSocket.OPEN) {
            this.joinRoomBtn.disabled = true;
            this.joinRoomBtn.textContent = "Joining...";
            
            this.socket.send(JSON.stringify({
                type: 'join_room',
                room_code: roomCode
            }));
        } else {
            console.error("WebSocket is not open");
            this.updateStatus("Connection error. Please refresh the page.");
        }
    }
    
    playerReady() {
        console.log("Player ready");
        if (this.socket.readyState === WebSocket.OPEN) {
            // Validate that required elements are placed
            if (this.gameState.isHost) {
                if (!this.gameState.playerPositions.player1 || 
                    !this.gameState.playerPositions.player2 || 
                    !this.gameState.endPositions.player1 || 
                    !this.gameState.endPositions.player2) {
                    alert("Please place both players and end positions before starting!");
                    return;
                }
            }
            
            this.readyBtn.disabled = true;
            this.readyBtn.textContent = "Waiting for other player...";
            
            this.socket.send(JSON.stringify({
                type: 'player_ready',
                room_code: this.gameState.roomCode,
                player: this.gameState.currentPlayer
            }));
        }
    }
    
    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log("Received message:", message);
            
            switch (message.type) {
                case 'connection_established':
                    console.log("WebSocket connected");
                    break;
                    
                case 'room_created':
                    this.gameState.roomCode = message.room_code;
                    this.gameState.isHost = true;
                    this.gameState.currentPlayer = 'player1';
                    this.updateRoomCode(message.room_code);
                    this.updateGamePhase('setup');
                    break;
                    
                case 'room_joined':
                    this.gameState.roomCode = message.room_code;
                    this.gameState.isHost = false;
                    this.gameState.currentPlayer = 'player2';
                    this.updateRoomCode(message.room_code);
                    this.updateGamePhase('setup');
                    break;

                case 'game_state_update':
                    if (message.gameState) {
                        // Update game state while preserving structure
                        if (message.gameState.playerPositions) {
                            this.gameState.playerPositions = {
                                player1: message.gameState.playerPositions.player1 || null,
                                player2: message.gameState.playerPositions.player2 || null
                            };
                        }
                        if (message.gameState.endPositions) {
                            this.gameState.endPositions = {
                                player1: message.gameState.endPositions.player1 || null,
                                player2: message.gameState.endPositions.player2 || null
                            };
                        }
                        if (message.gameState.walls) {
                            this.gameState.walls = [...message.gameState.walls];
                        }
                        this.drawGrid();
                    }
                    break;
                    
                case 'player_ready':
                    this.gameState.readyPlayers.add(message.player);
                    if (this.gameState.readyPlayers.size === 2) {
                        // Ensure we preserve the game state when transitioning
                        const currentState = { ...this.gameState };
                        this.updateGamePhase('game');
                        // Restore the important state after phase update
                        this.gameState.playerPositions = currentState.playerPositions;
                        this.gameState.endPositions = currentState.endPositions;
                        this.gameState.walls = currentState.walls;
                        this.drawGrid();
                    }
                    break;
                    
                case 'error':
                    console.error("Server error:", message.message);
                    this.updateStatus(message.message);
                    break;
            }
        } catch (error) {
            console.error("Error handling message:", error);
        }
    }
    
    updateRoomCode(code) {
        console.log("Updating room code to:", code);
        // Update all room code displays
        const roomCodeDisplays = document.querySelectorAll('.room-code');
        roomCodeDisplays.forEach(display => {
            display.textContent = code || '----';
            if (code) {
                display.style.animation = 'pulse 0.5s ease-in-out';
                setTimeout(() => {
                    display.style.animation = '';
                }, 500);
            }
        });
    }
    
    updateGamePhase(phase) {
        console.log("Updating game phase to:", phase);
        
        // Hide all phases
        [this.waitingRoom, this.setupPhase, this.gamePhase].forEach(el => {
            if (el) el.classList.remove('active');
        });
        
        // Show active phase
        switch (phase) {
            case 'waiting':
                if (this.waitingRoom) this.waitingRoom.classList.add('active');
                break;
            case 'setup':
                if (this.setupPhase) {
                    this.setupPhase.classList.add('active');
                    this.updateStatus(this.gameState.isHost ? 
                        "Set up the game board (Use 1, 2, E, and W keys)" : 
                        "Waiting for host to set up the game board");
                }
                break;
            case 'game':
                if (this.gamePhase) {
                    this.gamePhase.classList.add('active');
                    this.updateStatus("Game started! Use WASD to move.");
                }
                break;
        }
        
        this.gameState.phase = phase;
        
        // Ensure canvas is properly sized and visible
        requestAnimationFrame(() => {
            if (this.canvas) {
                // Force a reflow
                this.canvas.style.display = 'none';
                this.canvas.offsetHeight; // trigger reflow
                this.canvas.style.display = 'block';
                
                // Redraw after ensuring visibility
                this.drawGrid();
            }
        });
        
        // Update room code display
        this.updateRoomCode(this.gameState.roomCode);
    }
    
    updateStatus(message) {
        console.log("Status update:", message);
        const statusDisplay = document.getElementById('game-status');
        if (statusDisplay) {
            statusDisplay.textContent = message;
        }
    }
    
    drawGrid() {
        if (!this.ctx || !this.canvas) {
            console.error("Cannot draw grid: missing context or canvas");
            return;
        }
        
        // Ensure canvas dimensions are correct
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = 800;
            this.canvas.height = 600;
        }
        
        console.log("Drawing grid with state:", this.gameState);
        
        // Clear canvas with white background
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid lines
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;
        
        // Draw vertical lines
        for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        // Draw walls
        if (this.gameState.walls && this.gameState.walls.length > 0) {
            this.ctx.fillStyle = '#333';
            this.gameState.walls.forEach(wall => {
                if (wall && typeof wall.x === 'number' && typeof wall.y === 'number') {
                    this.ctx.fillRect(
                        wall.x * this.gridSize,
                        wall.y * this.gridSize,
                        this.gridSize,
                        this.gridSize
                    );
                }
            });
        }
        
        // Draw players
        if (this.gameState.playerPositions) {
            const { player1, player2 } = this.gameState.playerPositions;
            if (player1) {
                console.log("Drawing Player 1:", player1);
                this.drawPlayerPosition(1, player1);
            }
            if (player2) {
                console.log("Drawing Player 2:", player2);
                this.drawPlayerPosition(2, player2);
            }
        }
        
        // Draw end positions
        if (this.gameState.endPositions) {
            const { player1, player2 } = this.gameState.endPositions;
            if (player1) {
                console.log("Drawing End 1:", player1);
                this.drawEndPosition(1, player1);
            }
            if (player2) {
                console.log("Drawing End 2:", player2);
                this.drawEndPosition(2, player2);
            }
        }
    }
    
    drawPlayerPosition(playerNumber, position) {
        const { x, y } = position;
        this.ctx.fillStyle = playerNumber === 1 ? '#ff0000' : '#0000ff';
        this.ctx.beginPath();
        this.ctx.arc(
            x * this.gridSize + this.gridSize / 2,
            y * this.gridSize + this.gridSize / 2,
            this.gridSize / 2 - 2,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            playerNumber.toString(),
            x * this.gridSize + this.gridSize / 2,
            y * this.gridSize + this.gridSize / 2
        );
    }
    
    drawEndPosition(playerNumber, position) {
        const { x, y } = position;
        this.ctx.fillStyle = playerNumber === 1 ? '#ff9999' : '#9999ff';
        this.ctx.beginPath();
        this.ctx.arc(
            x * this.gridSize + this.gridSize / 2,
            y * this.gridSize + this.gridSize / 2,
            this.gridSize / 2 - 2,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            'E',
            x * this.gridSize + this.gridSize / 2,
            y * this.gridSize + this.gridSize / 2
        );
    }
    
    handleCanvasClick(event) {
        if (this.gameState.phase !== 'setup') return;
        
        // Only host can place items during setup
        if (!this.gameState.isHost) {
            this.updateStatus("Only Player 1 (host) can set up the game");
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = Math.floor(((event.clientX - rect.left) * scaleX) / this.gridSize);
        const y = Math.floor(((event.clientY - rect.top) * scaleY) / this.gridSize);
        
        console.log("Click at grid position:", x, y);
        
        if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) return;
        
        let stateUpdated = false;
        
        switch (this.gameState.currentSelection) {
            case 'player1':
                this.gameState.playerPositions.player1 = { x, y };
                stateUpdated = true;
                break;
            case 'player2':
                this.gameState.playerPositions.player2 = { x, y };
                stateUpdated = true;
                break;
            case 'wall':
                const wallExists = this.gameState.walls.some(wall => wall.x === x && wall.y === y);
                if (!wallExists) {
                    this.gameState.walls.push({ x, y });
                    stateUpdated = true;
                }
                break;
            case 'end1':
                this.gameState.endPositions.player1 = { x, y };
                stateUpdated = true;
                break;
            case 'end2':
                this.gameState.endPositions.player2 = { x, y };
                stateUpdated = true;
                break;
        }
        
        if (stateUpdated) {
            this.drawGrid();
            console.log("State updated, sending to other player");
            this.sendGameStateUpdate();
        }
    }

    sendGameStateUpdate() {
        if (this.socket.readyState === WebSocket.OPEN) {
            console.log("Sending game state update:", this.gameState);
            const gameState = {
                startPositions: this.gameState.startPositions,
                endPositions: this.gameState.endPositions,
                walls: this.gameState.walls,
                playerPositions: this.gameState.playerPositions
            };
            
            this.socket.send(JSON.stringify({
                type: 'game_state_update',
                room_code: this.gameState.roomCode,
                gameState: gameState
            }));
        } else {
            console.error("WebSocket is not open");
        }
    }

    // Update movement to sync positions
    handleMovement(key) {
        if (this.gameState.phase !== 'game') return;
        
        const currentPlayer = this.gameState.currentPlayer;
        const currentPos = this.gameState.playerPositions[currentPlayer];
        if (!currentPos) return;

        let newX = currentPos.x;
        let newY = currentPos.y;

        switch (key.toLowerCase()) {
            case 'w': newY = Math.max(0, currentPos.y - 1); break;
            case 's': newY = Math.min(this.gridHeight - 1, currentPos.y + 1); break;
            case 'a': newX = Math.max(0, currentPos.x - 1); break;
            case 'd': newX = Math.min(this.gridWidth - 1, currentPos.x + 1); break;
            default: return;
        }

        // Check if the new position is valid (not a wall)
        const isWall = this.gameState.walls.some(wall => wall.x === newX && wall.y === newY);
        if (!isWall) {
            this.gameState.playerPositions[currentPlayer] = { x: newX, y: newY };
            this.drawGrid();
            this.sendGameStateUpdate();
            
            // Check if player reached their end point
            const endPos = this.gameState.endPositions[currentPlayer];
            if (endPos && newX === endPos.x && newY === endPos.y) {
                this.updateStatus(`${currentPlayer} has reached their end point!`);
                // TODO: Implement win condition
            }
        }
    }

    resizeCanvas() {
        // Maintain aspect ratio while fitting to container
        const container = this.canvas.parentElement;
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const aspectRatio = this.canvas.width / this.canvas.height;

        let width = containerWidth;
        let height = width / aspectRatio;

        if (height > containerHeight) {
            height = containerHeight;
            width = height * aspectRatio;
        }

        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        
        // Redraw the grid after resize
        this.drawGrid();
    }
}

// Initialize the game when the window loads
window.addEventListener('load', () => {
    console.log("Window loaded, initializing game...");
    try {
        new MultiplayerGame();
    } catch (error) {
        console.error("Error initializing game:", error);
    }
});