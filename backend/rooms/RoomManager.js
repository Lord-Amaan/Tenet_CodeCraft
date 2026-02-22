import Game from '../game/Game.js';

const MAX_PLAYERS_PER_ROOM = 6;

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

  createRoom(options = {}) {
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
      isPrivate: !!options.isPrivate,
    };

    this.rooms.set(roomCode, room);
    console.log(`Room created: ${roomCode} (${room.isPrivate ? 'private' : 'public'})`);
    return roomCode;
  }

  joinRoom(roomCode, socketId, playerName, colorIndex) {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };

    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      return { error: 'Room is full (max 6 players)' };
    }

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
      if (room.isPrivate) continue; // Skip private rooms
      rooms.push({
        code,
        playerCount: room.players.size,
        maxPlayers: MAX_PLAYERS_PER_ROOM,
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

    const totalTiles = room.game.cols * room.game.rows;

    return Array.from(room.players.values())
      .map(p => ({
        name: p.name,
        kills: p.kills,
        deaths: p.deaths,
        score: p.score,
        colorIndex: p.colorIndex,
        territory: totalTiles > 0 ? Math.round((p.owned.size / totalTiles) * 100) : 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export default RoomManager;
