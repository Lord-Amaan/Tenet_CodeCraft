import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Game from './game/Game.js';
import { setupSocketHandlers } from './events/socketHandlers.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173', // Vite dev server
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;
const GAME_TICK = 1000 / 60; // 60 FPS

// Initialize game
const game = new Game();

// Setup socket handlers
setupSocketHandlers(io, game);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Game loop
game.start();
setInterval(() => {
  if (game.gameRunning) {
    game.updateGame();
    // Broadcast game state to all connected clients
    io.emit('game:update', game.getGameState());
  }
}, GAME_TICK);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket ready for connections`);
});
