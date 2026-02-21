import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import RoomManager from './rooms/RoomManager.js';
import { setupSocketHandlers } from './events/socketHandlers.js';
import { clerkAuth } from './middleware/auth.js';
import apiRoutes from './routes/api.js';

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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gameofllands';

// ── Connect to MongoDB ───────────────────────────────────────────────
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

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
app.use(clerkAuth); // Attach Clerk auth to all requests

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.get('/api/rooms', (req, res) => {
  const rooms = roomManager.getRoomsInfo();
  res.json({ rooms });
});

// Auth + Stats API routes
app.use('/api', apiRoutes);

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
