# Tenet_CodeCraft - Territory Wars

A multiplayer browser-based territory control game where players navigate a grid, draw trails, and capture territory by closing loops — inspired by games like Paper.io and Qix.

## Project Structure

```
Tenet_CodeCraft/
├── backend/                        # Node.js server
│   ├── game/
│   │   ├── Game.js                 # Game loop, grid logic & territory capture
│   │   └── Player.js               # Player class & spawn logic
│   ├── events/
│   │   └── socketHandlers.js       # WebSocket event handlers
│   ├── rooms/
│   │   └── RoomManager.js          # Room creation, joining & lifecycle
│   ├── models/
│   │   ├── User.js                 # User account schema (Mongoose)
│   │   └── GameStats.js            # Per-round game stats schema
│   ├── routes/
│   │   └── api.js                  # REST API (stats, leaderboard, shop)
│   ├── middleware/
│   │   └── auth.js                 # Clerk authentication middleware
│   ├── server.js                   # Express + Socket.io entry point
│   └── package.json
│
├── frontend/                       # React + Vite app
│   ├── src/
│   │   ├── components/
│   │   │   ├── GameCanvas.jsx      # Canvas rendering & keyboard input
│   │   │   ├── Menu.jsx            # Room browsing, creation & joining
│   │   │   ├── HUD.jsx             # In-game stats, minimap & room info
│   │   │   ├── Leaderboard.jsx     # Room & global leaderboards
│   │   │   └── Shop.jsx            # Skin shop & coin packs
│   │   ├── services/
│   │   │   ├── socket.js           # Socket.io client service
│   │   │   ├── api.js              # REST API client
│   │   │   ├── audioEngine.js      # Game audio effects
│   │   │   └── guestStats.js       # Guest stat persistence (localStorage)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
├── API_DOCUMENTATION.md            # WebSocket API specs
├── README.md                       # This file
└── .gitignore
```

## Tech Stack

- **Frontend**: React 19 + Vite + Socket.io-client
- **Backend**: Node.js + Express + Socket.io
- **Database**: MongoDB (Mongoose)
- **Authentication**: Clerk
- **Real-time Communication**: WebSocket (Socket.io)
- **Build Tool**: Vite

## Quick Start

### Prerequisites

- Node.js (v16+)
- npm
- MongoDB (local or remote)

### Installation

1. **Clone repository**:

```bash
git clone <repo-url>
cd Tenet_CodeCraft
```

2. **Backend setup**:

```bash
cd backend
npm install
npm start        # or `npm run dev` for watch mode
```

Server runs on `http://localhost:3000`

3. **Frontend setup** (new terminal):

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in browser

### Environment Variables

The backend supports the following optional environment variables:

- `PORT` — Server port (default: `3000`)
- `MONGODB_URI` — MongoDB connection string (default: `mongodb://localhost:27017/gameoflands`)
- Clerk environment variables for authentication (the app gracefully falls back if not configured)

## Game Rules

- The arena is a **90×60 tile grid**
- Each player controls a moving head that draws a **trail** on the grid
- When a player's trail returns to their own territory, all enclosed tiles are **captured** via flood fill
- Captured territory is worth **1 point per tile**
- Running into **another player's trail** eliminates them (earns a kill)
- Running into **your own trail** eliminates you
- Rounds last **3 minutes** — the player with the most territory at the end wins
- After death, players **respawn after 2 seconds** at a new location

## Controls

- **Arrow Keys** or **WASD** to move
- Game syncs across all connected clients in real-time

## Features

### Room System
- Create public or private rooms (6-character room codes)
- Up to **6 players** per room
- Browse and quick-join public rooms
- Share room codes with friends to play together

### Character Skins
Six elemental skins with unique visual effects on the game canvas:
- 🔥 **Lava** — Free
- 🌊 **Ocean** — Free
- 🍄 **Fungi** — Free
- 🌿 **Earth** — Free
- 💎 **Crystal** — 50 coins
- ❄️ **Frost** — 100 coins

### Economy
- Earn coins through gameplay: **+2** per kill, **+10** for winning a round, **−1** on death
- Spend coins in the shop to unlock premium skins
- Coin packs available for purchase

### Leaderboards
- **Room leaderboard** — live standings for current players ranked by territory %
- **Global leaderboard** — top 50 all-time players ranked by best score

### HUD & Minimap
- In-game sidebar displays player stats (score, kills, deaths, K/D ratio, coins)
- Room info with shareable room code
- Live minimap showing all players, trails, and territories

### Authentication
- Optional Clerk-based sign-in/sign-up for persistent accounts
- Guest play supported — stats are stored locally and can migrate to an account

## Development

### Git Workflow

1. Create feature branches: `git checkout -b feature/your-feature`
2. Push and create Pull Requests
3. Review before merging to main

### Debugging

- Backend: Check terminal for console logs
- Frontend: Open DevTools (F12) → Console tab
- Network tab to inspect WebSocket messages

### Linting

```bash
cd frontend
npm run lint
```

## API Documentation

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for the WebSocket event reference.

## Future Features

- [ ] Power-ups (speed boost, shield)
- [ ] Different game modes
- [ ] Mobile responsiveness

## License

MIT
