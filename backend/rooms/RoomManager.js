import Game from '../game/Game.js';

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.leaderboard = new Map(); // Global leaderboard
    this.CLEANUP_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  createRoom() {
    let roomCode;
    do {
      roomCode = this.generateRoomCode();
    } while (this.rooms.has(roomCode));

    const room = {
      code: roomCode,
      game: new Game(),
      players: new Map(),
      createdAt: Date.now(),
      cleanupTimer: null,
    };

    this.rooms.set(roomCode, room);
    console.log(`Room created: ${roomCode}`);
    return roomCode;
  }

  joinRoom(roomCode, socketId, playerName, colorIndex) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.game.addPlayer(socketId, playerName, colorIndex);
    room.players.set(socketId, player);

    // Clear cleanup timer if room was empty
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }

    console.log(`Player ${playerName} joined room ${roomCode}`);
    return { room, player };
  }

  leaveRoom(roomCode, socketId) {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const player = room.players.get(socketId);
    if (player) {
      room.game.removePlayer(socketId);
      room.players.delete(socketId);
      console.log(`Player left room ${roomCode}`);

      // Schedule cleanup if room is empty
      if (room.players.size === 0) {
        room.cleanupTimer = setTimeout(() => {
          this.rooms.delete(roomCode);
          console.log(`Room ${roomCode} cleaned up (empty)`);
        }, this.CLEANUP_TIMEOUT);
      }

      return true;
    }

    return false;
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  getRoomState(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    return {
      code: roomCode,
      playerCount: room.players.size,
      gameState: room.game.getGameState(),
    };
  }

  getRoomsInfo() {
    const rooms = [];
    for (const [code, room] of this.rooms) {
      rooms.push({
        code,
        playerCount: room.players.size,
        createdAt: room.createdAt,
      });
    }
    return rooms;
  }

  updateLeaderboard(playerName, kills, deaths) {
    const leaderboardEntry = this.leaderboard.get(playerName) || {
      name: playerName,
      kills: 0,
      deaths: 0,
    };

    leaderboardEntry.kills += kills;
    leaderboardEntry.deaths += deaths;
    this.leaderboard.set(playerName, leaderboardEntry);
  }

  getLeaderboard(limit = 10) {
    return Array.from(this.leaderboard.values())
      .sort((a, b) => b.kills - a.kills)
      .slice(0, limit);
  }

  getRoomLeaderboard(roomCode, limit = 10) {
    const room = this.rooms.get(roomCode);
    if (!room) return [];

    return Array.from(room.players.values())
      .map(p => ({
        name: p.name,
        kills: p.kills,
        deaths: p.deaths,
        score: p.score,
      }))
      .sort((a, b) => b.kills - a.kills)
      .slice(0, limit);
  }
}

export default RoomManager;
