export function setupSocketHandlers(io, roomManager) {
  // Broadcast updated room list to all connected clients
  function broadcastRoomList() {
    const rooms = roomManager.getRoomsInfo();
    io.emit('room:updated', { rooms });
  }

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    let currentRoom = null;

    // Create a new room
    socket.on('room:create', (options, callback) => {
      // Handle backward compatibility: room:create(callback) with no options
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      const roomCode = roomManager.createRoom(options || {});
      if (typeof callback === 'function') {
        callback({ roomCode });
      }
      broadcastRoomList();
    });

    // Get list of available rooms
    socket.on('room:list', (callback) => {
      const rooms = roomManager.getRoomsInfo();
      if (typeof callback === 'function') {
        callback({ rooms });
      }
    });

    // Join a room
    socket.on('room:join', (roomCode, playerName, colorIndex, callback) => {
      // Handle backward compatibility
      if (typeof colorIndex === 'function') {
        callback = colorIndex;
        colorIndex = undefined;
      }
      const result = roomManager.joinRoom(roomCode, socket.id, playerName, colorIndex);
      
      if (!result || result.error) {
        if (typeof callback === 'function') {
          callback({ success: false, error: result?.error || 'Room not found' });
        }
        return;
      }

      currentRoom = roomCode;
      socket.join(roomCode);

      const room = roomManager.getRoom(roomCode);
      const roomState = roomManager.getRoomState(roomCode);

      // Notify all players in the room
      io.to(roomCode).emit('room:playerJoined', {
        player: result.player.getState(),
        playerCount: room.players.size,
        gameState: roomState.gameState,
      });

      if (typeof callback === 'function') {
        callback({ 
          success: true, 
          roomCode, 
          playerId: socket.id,
          gameState: roomState.gameState 
        });
      }
      broadcastRoomList();
    });

    // Player direction change (auto-movement is server-side)
    socket.on('player:move', (direction) => {
      if (!currentRoom) return;

      const room = roomManager.getRoom(currentRoom);
      if (!room) return;

      const player = room.game.getPlayer(socket.id);
      if (player) {
        player.setDirection(direction);
      }
    });

    // Get leaderboard for the room
    socket.on('leaderboard:get', (callback) => {
      if (!currentRoom) {
        if (typeof callback === 'function') {
          callback({ leaderboard: [] });
        }
        return;
      }

      const leaderboard = roomManager.getRoomLeaderboard(currentRoom);
      if (typeof callback === 'function') {
        callback({ leaderboard });
      }
    });

    // Get global leaderboard
    socket.on('leaderboard:global', (callback) => {
      const leaderboard = roomManager.getLeaderboard();
      if (typeof callback === 'function') {
        callback({ leaderboard });
      }
    });

    // Leave room
    socket.on('room:leave', () => {
      if (!currentRoom) return;

      roomManager.leaveRoom(currentRoom, socket.id);
      socket.leave(currentRoom);
      
      const room = roomManager.getRoom(currentRoom);
      if (room) {
        io.to(currentRoom).emit('room:playerLeft', {
          playerId: socket.id,
          playerCount: room.players.size,
        });
      }

      currentRoom = null;
      broadcastRoomList();
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (currentRoom) {
        roomManager.leaveRoom(currentRoom, socket.id);
        const room = roomManager.getRoom(currentRoom);
        if (room) {
          io.to(currentRoom).emit('room:playerLeft', {
            playerId: socket.id,
            playerCount: room.players.size,
          });
        }
      }

      console.log(`User disconnected: ${socket.id}`);
      broadcastRoomList();
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });
}

