# Tenet_CodeCraft - Territory Wars

A multiplayer browser-based game where players compete to expand their territory and absorb other players.

## Project Structure

```
Tenet_CodeCraft/
├── backend/                    # Node.js server
│   ├── game/
│   │   ├── Game.js            # Game logic & state
│   │   └── Player.js          # Player class
│   ├── events/
│   │   └── socketHandlers.js  # WebSocket handlers
│   ├── package.json
│   ├── server.js              # Express + Socket.io entry
│   └── node_modules/

├── frontend/                   # React + Vite app
│   ├── src/
│   │   ├── components/
│   │   │   └── GameCanvas.jsx # Game rendering
│   │   ├── services/
│   │   │   └── socket.js      # Socket client
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   └── node_modules/

├── API_DOCUMENTATION.md       # WebSocket API specs
├── README.md                  # This file
└── .gitignore
```

## Tech Stack

- **Frontend**: React 19 + Vite + Socket.io-client
- **Backend**: Node.js + Express + Socket.io
- **Real-time Communication**: WebSocket (Socket.io)
- **Build Tool**: Vite

## Quick Start

### Prerequisites

- Node.js (v14+)
- npm

### Installation

1. **Clone repository** (for collaborators):

```bash
git clone <repo-url>
cd Tenet_CodeCraft
```

2. **Backend setup**:

```bash
cd backend
npm install
npm start
```

Server runs on `http://localhost:3000`

3. **Frontend setup** (new terminal):

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in browser

## Game Rules

- Players are circles that move around an 800×600 arena
- Absorb smaller players to earn points (+10 per kill)
- When two players collide, the larger one absorbs the smaller
- Goal: Become the biggest and earn the highest score

## Controls

- **Arrow Keys** or **WASD** to move
- Game syncs across all browser tabs/windows in real-time

## Development

### Team Structure

- **Person A**: Frontend (React components, Canvas rendering, UI)
- **Person B**: Backend (Game logic, WebSocket, Database)

### Git Workflow

1. Create feature branches: `git checkout -b feature/your-feature`
2. Push and create Pull Requests
3. Review before merging to main

### Debugging

- Backend: Check terminal for console logs
- Frontend: Open DevTools (F12) → Console tab
- Network tab to see WebSocket messages

## API Documentation

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete WebSocket event reference.

## Future Features

- [ ] Territory system (claim grid squares)
- [ ] Leaderboard with persistent scores
- [ ] Power-ups (speed boost, shield)
- [ ] Different game modes
- [ ] User authentication
- [ ] Matchmaking system

## Contributors

- Team Member 1
- Team Member 2

## License

MIT
