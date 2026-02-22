import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import RoomManager from './rooms/RoomManager.js';
import { setupSocketHandlers } from './events/socketHandlers.js';
import { clerkAuth } from './middleware/auth.js';
import { getAuth } from '@clerk/express';
import apiRoutes from './routes/api.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3000;
const GAME_TICK = 16; // ~60 FPS
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gameoflands';

// ── Connect to MongoDB ───────────────────────────────────────────────
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected to', MONGODB_URI.replace(/\/\/.*@/, '//***@')))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Server will run without database — stats will NOT persist');
  });

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

// Clerk middleware — attaches auth state to every request (does NOT block)
app.use(clerkAuth);

// Routes
app.get('/api/health', (req, res) => {
  const auth = getAuth(req);
  res.json({
    status: 'Server is running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    auth: auth?.userId ? `authenticated as ${auth.userId}` : 'not authenticated',
  });
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

    // Check if round is over
    if (room.game.isRoundOver() && !room.game.roundEnded) {
      room.game.roundEnded = true;
      room.game.roundEndedAt = Date.now();
      const results = room.game.getRoundResults();
      io.to(roomCode).emit('game:roundEnd', { results, restartIn: 9 });

      // Auto-reset after 9 seconds so players can see results
      setTimeout(() => {
        const r = roomManager.getRoom(roomCode);
        if (r && r.players.size > 0) {
          r.game.resetRound();
          io.to(roomCode).emit('game:roundReset');
        }
      }, 9000);
    }

    // Don't update game during round-end cooldown
    if (room.game.roundEnded) {
      // Still broadcast state so timer shows 0
      const gameState = room.game.getGameState();
      io.to(roomCode).emit('game:update', {
        roomCode,
        gameState,
        playerCount: room.players.size,
      });
      continue;
    }

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
