# WebSocket API Documentation

## Overview

This document defines all WebSocket events for the Tenet CodeCraft Territory Wars game.

## Connection

- **Server URL**: `http://localhost:3000`
- **Client connects from**: Frontend (React + Vite on port 5173)

---

## Client → Server Events

### `player:join`

**Description**: Player joins the game
**Payload**:

```javascript
{
  playerName: string; // Player's display name
}
```

**Example**:

```javascript
socketService.emit("player:join", "PlayerName");
```

### `player:move`

**Description**: Player movement input (sent continuously)
**Payload**:

```javascript
{
  up: boolean,      // W or Arrow Up
  down: boolean,    // S or Arrow Down
  left: boolean,    // A or Arrow Left
  right: boolean    // D or Arrow Right
}
```

**Example**:

```javascript
socketService.emit("player:move", {
  up: true,
  down: false,
  left: false,
  right: true,
});
```

---

## Server → Client Events

### `game:state`

**Description**: Initial game state sent when player joins
**Payload**:

```javascript
{
  players: [
    {
      id: string, // Socket ID
      name: string, // Player name
      x: number, // X position (0-800)
      y: number, // Y position (0-600)
      radius: number, // Player size
      color: string, // Hex color (#RRGGBB)
      score: number, // Player score
    },
    // ... more players
  ];
}
```

### `game:update`

**Description**: Game state update (60 times per second)
**Payload**: Same as `game:state`
**Frequency**: Every ~16ms (60 FPS)

### `player:joined`

**Description**: Notification when a new player joins (broadcast to all)
**Payload**:

```javascript
{
  player: {
    id: string,
    name: string,
    x: number,
    y: number,
    radius: number,
    color: string,
    score: number
  },
  totalPlayers: number
}
```

### `player:left`

**Description**: Notification when a player disconnects
**Payload**:

```javascript
{
  playerId: string,
  totalPlayers: number
}
```

---

## Game Mechanics (Backend - Person B's Focus)

- **Canvas**: 800×600 pixels
- **Player spawn**: Random position
- **Movement speed**: 5 pixels per frame
- **Collision**: Larger player absorbs smaller player
- **Score**: +10 points per collision win
- **Boundary**: Players bounce off edges

---

## Frontend Implementation (Person A's Focus)

- **Rendering**: Canvas API at 60 FPS
- **Input**: Keyboard (Arrow keys or WASD)
- **State**: React hooks (useState, useRef, useEffect)
- **Connection**: SocketService singleton pattern

---

## Code Structure

```
backend/
├── game/
│   ├── Game.js          # Main game loop & state
│   └── Player.js        # Player class
├── events/
│   └── socketHandlers.js # WebSocket event handlers
└── server.js            # Express + Socket.io setup

frontend/
├── components/
│   └── GameCanvas.jsx   # Game rendering & input
├── services/
│   └── socket.js        # Socket connection service
└── App.jsx              # Main app component
```

---

## Running the Project

**Terminal 1 (Backend)**:

```bash
cd backend
npm start   # or npm run dev for watch mode
```

**Terminal 2 (Frontend)**:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in browser to play!

---

## Next Steps for Development

**Person B (Backend)**:

- [ ] Implement territory system (grid-based land ownership)
- [ ] Add leaderboard logic
- [ ] Implement power-ups
- [ ] Add database for persistent data

**Person A (Frontend)**:

- [ ] Enhance UI (buttons, menus)
- [ ] Add leaderboard display
- [ ] Improve graphics/animations
- [ ] Add sound effects
- [ ] Mobile responsiveness

---

## Testing

1. Open two browsers and join as different players
2. Move around and collide
3. One player should absorb the other and gain points
4. Check console for errors
