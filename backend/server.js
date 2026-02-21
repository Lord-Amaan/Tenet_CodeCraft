import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import RoomManager from './rooms/RoomManager.js';
import { setupSocketHandlers } from './events/socketHandlers.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins in development
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3000;
const GAME_TICK = 16; // ~60 FPS

// Initialize room manager
const roomManager = new RoomManager();

// Setup socket handlers
setupSocketHandlers(io, roomManager);

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.get('/api/rooms', (req, res) => {
  const rooms = roomManager.getRoomsInfo();
  res.json({ rooms });
});

// Game loop - move players and broadcast state each tick
setInterval(() => {
  for (const [roomCode, room] of roomManager.rooms) {
    if (room.players.size === 0) continue;

    room.game.updateGame();
    const gameState = room.game.getGameState();

    io.to(roomCode).emit('game:update', {
      roomCode,
      gameState,
      playerCount: room.players.size,
    });
  }
}, GAME_TICK);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket ready for connections`);
});
