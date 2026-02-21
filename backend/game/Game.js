import Player from './Player.js';

class Game {
  constructor() {
    this.players = new Map();
    this.gameWidth = 800;
    this.gameHeight = 600;
    this.gameRunning = false;
  }

  addPlayer(socketId, playerName) {
    const player = new Player(socketId, playerName);
    this.players.set(socketId, player);
    console.log(`Player ${playerName} joined. Total: ${this.players.size}`);
    return player;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      this.players.delete(socketId);
      console.log(`Player ${player.name} left. Total: ${this.players.size}`);
    }
  }

  getPlayer(socketId) {
    return this.players.get(socketId);
  }

  updatePlayer(socketId, direction) {
    const player = this.getPlayer(socketId);
    if (player) {
      player.setDirection(direction);
    }
  }

  updateGame() {
    // Update all players
    for (const player of this.players.values()) {
      player.update();
    }

    // Check collisions between players
    this.checkCollisions();
  }

  checkCollisions() {
    const playerArray = Array.from(this.players.values());

    for (let i = 0; i < playerArray.length; i++) {
      for (let j = i + 1; j < playerArray.length; j++) {
        const p1 = playerArray[i];
        const p2 = playerArray[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < p1.radius + p2.radius) {
          // Simple collision: larger player absorbs smaller
          if (p1.radius > p2.radius) {
            p1.radius += p2.radius * 0.5;
            p1.score += 10;
            this.removePlayer(p2.id);
          } else {
            p2.radius += p1.radius * 0.5;
            p2.score += 10;
            this.removePlayer(p1.id);
          }
        }
      }
    }
  }

  getGameState() {
    const players = Array.from(this.players.values()).map(p => p.getState());
    return {
      players,
    };
  }

  start() {
    this.gameRunning = true;
  }

  stop() {
    this.gameRunning = false;
  }
}

export default Game;
