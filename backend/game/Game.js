import Player from './Player.js';

class Game {
  constructor() {
    this.players = new Map();
    this.cols = 90;
    this.rows = 60;
    this.nextColorIndex = 0;
    this.totalColors = 6;
    this.moveInterval = 150; // ms between moves (controls player speed)
    this.lastMoveTime = 0;

    this.spawnPositions = [
      { x: 10, y: 10 },
      { x: 75, y: 50 },
      { x: 10, y: 50 },
      { x: 75, y: 10 },
      { x: 45, y: 30 },
      { x: 45, y: 10 },
      { x: 20, y: 30 },
      { x: 70, y: 30 },
      { x: 30, y: 45 },
      { x: 60, y: 15 },
    ];
  }

  getUsedColors() {
    const used = new Set();
    for (const player of this.players.values()) {
      used.add(player.colorIndex);
    }
    return used;
  }

  _getAvailableColor(preferredIndex) {
    const used = this.getUsedColors();
    if (preferredIndex !== undefined && preferredIndex !== null && !used.has(preferredIndex)) {
      return preferredIndex;
    }
    for (let i = 0; i < this.totalColors; i++) {
      if (!used.has(i)) return i;
    }
    return this.nextColorIndex++ % this.totalColors;
  }

  addPlayer(socketId, playerName, preferredColorIndex) {
    const spawn = this._getSpawnPosition();
    const colorIndex = this._getAvailableColor(preferredColorIndex);
    const player = new Player(socketId, playerName, spawn.x, spawn.y, this.cols, this.rows, colorIndex);
    this.players.set(socketId, player);
    console.log(`Player ${playerName} joined with color ${colorIndex}. Total: ${this.players.size}`);
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

  _getSpawnPosition() {
    for (const spawn of this.spawnPositions) {
      const key = `${spawn.x},${spawn.y}`;
      let occupied = false;
      for (const player of this.players.values()) {
        if (player.owned.has(key) || (`${player.x},${player.y}` === key)) {
          occupied = true;
          break;
        }
      }
      if (!occupied) return spawn;
    }
    return {
      x: 2 + Math.floor(Math.random() * (this.cols - 4)),
      y: 2 + Math.floor(Math.random() * (this.rows - 4)),
    };
  }

  updateGame() {
    const now = Date.now();
    if (now - this.lastMoveTime < this.moveInterval) return;
    this.lastMoveTime = now;

    const alive = Array.from(this.players.values()).filter(p => !p.dead);

    // Move all alive players
    for (const player of alive) {
      this._movePlayer(player);
    }

    // Check cross-trail collisions
    this._checkCrossCollisions();
  }

  _movePlayer(player) {
    const nx = player.x + player.dir.x;
    const ny = player.y + player.dir.y;
    const nk = `${nx},${ny}`;

    // Wall boundary — stop movement, don't kill
    if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) {
      return;
    }

    // Self-trail collision
    if (player.trail.has(nk)) {
      this._killPlayer(player);
      return;
    }

    if (player.owned.has(nk)) {
      // Returned to owned territory
      if (player.trail.size > 0) {
        // Include current position in the trail to close the path
        const currentKey = `${player.x},${player.y}`;
        if (!player.owned.has(currentKey)) {
          player.trail.add(currentKey);
        }

        // Add all trail tiles to owned first
        player.trail.forEach(k => player.owned.add(k));

        // Also add the destination tile (the owned tile we're stepping onto)
        // to make sure the boundary is fully closed
        player.owned.add(nk);

        // Flood fill enclosed areas using the updated owned set
        const enclosed = this._floodFillEnclosed(player.owned);
        enclosed.forEach(k => {
          // Steal territory from other players
          for (const other of this.players.values()) {
            if (other.id !== player.id) {
              other.owned.delete(k);
              other.score = other.owned.size;
            }
          }
          player.owned.add(k);
        });

        player.trail.clear();
      }

      player.x = nx;
      player.y = ny;
      player.score = player.owned.size;
    } else {
      // Moving through neutral/enemy territory — add current pos to trail
      const currentKey = `${player.x},${player.y}`;
      if (!player.owned.has(currentKey)) {
        // Only add to trail if we're already outside owned territory
        player.trail.add(currentKey);
      } else if (player.trail.size === 0) {
        // First step out of owned territory — mark it as trail start
        player.trail.add(currentKey);
      }
      player.x = nx;
      player.y = ny;
    }
  }

  _killPlayer(player, killer) {
    player.dead = true;
    player.deaths++;
    player.trail.clear();
    player.owned.clear();
    player.score = 0;

    if (killer) {
      killer.kills++;
    }

    // Auto-respawn after 2 seconds
    setTimeout(() => {
      if (this.players.has(player.id)) {
        const spawn = this._getSpawnPosition();
        player.respawn(spawn.x, spawn.y);
      }
    }, 2000);
  }

  _checkCrossCollisions() {
    const alive = Array.from(this.players.values()).filter(p => !p.dead);
    const toKill = [];

    for (const player of alive) {
      const pk = `${player.x},${player.y}`;

      for (const other of alive) {
        if (other.id === player.id) continue;

        // Player stepped on other's trail → other dies
        if (other.trail.has(pk)) {
          toKill.push({ victim: other, killer: player });
        }
      }
    }

    // Apply kills (deferred to avoid mutation during iteration)
    for (const { victim, killer } of toKill) {
      if (!victim.dead) {
        this._killPlayer(victim, killer);
      }
    }
  }

  _floodFillEnclosed(ownedSet) {
    const outside = new Set();
    const queue = [];
    let head = 0;

    const key = (x, y) => `${x},${y}`;
    const addIfValid = (x, y) => {
      if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
      const k = key(x, y);
      if (ownedSet.has(k) || outside.has(k)) return;
      outside.add(k);
      queue.push({ x, y });
    };

    // Seed from all border cells
    for (let x = 0; x < this.cols; x++) {
      addIfValid(x, 0);
      addIfValid(x, this.rows - 1);
    }
    for (let y = 0; y < this.rows; y++) {
      addIfValid(0, y);
      addIfValid(this.cols - 1, y);
    }

    while (head < queue.length) {
      const { x, y } = queue[head++];
      addIfValid(x + 1, y);
      addIfValid(x - 1, y);
      addIfValid(x, y + 1);
      addIfValid(x, y - 1);
    }

    const enclosed = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const k = key(x, y);
        if (!outside.has(k) && !ownedSet.has(k)) {
          enclosed.push(k);
        }
      }
    }
    return enclosed;
  }

  getGameState() {
    return {
      players: Array.from(this.players.values()).map(p => p.getState()),
      cols: this.cols,
      rows: this.rows,
    };
  }
}

export default Game;
