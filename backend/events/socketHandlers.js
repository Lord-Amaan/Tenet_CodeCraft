export function setupSocketHandlers(io, game) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Player joins game
    socket.on('player:join', (playerName) => {
      const player = game.addPlayer(socket.id, playerName);
      
      // Notify all clients
      io.emit('player:joined', {
        player: player.getState(),
        totalPlayers: game.players.size,
      });

      // Send current game state to new player
      socket.emit('game:state', game.getGameState());
    });

    // Player movement
    socket.on('player:move', (direction) => {
      game.updatePlayer(socket.id, direction);
    });

    // Player disconnects
    socket.on('disconnect', () => {
      game.removePlayer(socket.id);
      io.emit('player:left', {
        playerId: socket.id,
        totalPlayers: game.players.size,
      });
      console.log(`User disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });
}
