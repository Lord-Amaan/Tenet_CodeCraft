// ── Guest Stats Service ──────────────────────────────────────────────
// Stores game stats in localStorage for unauthenticated (guest) users.
// Once a guest signs in, these stats are synced to the backend and cleared.

const GUEST_STATS_KEY = 'gol_guest_stats';

export const guestStats = {
  // Get all stored guest game records
  getAll() {
    try {
      const data = localStorage.getItem(GUEST_STATS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Save a game result
  save({ score, kills, deaths, territoryPercent }) {
    const records = this.getAll();
    records.push({
      score: score || 0,
      kills: kills || 0,
      deaths: deaths || 0,
      territoryPercent: territoryPercent || 0,
      createdAt: new Date().toISOString(),
    });
    // Keep only last 50 games
    if (records.length > 50) records.splice(0, records.length - 50);
    localStorage.setItem(GUEST_STATS_KEY, JSON.stringify(records));
  },

  // Get summary stats
  getSummary() {
    const records = this.getAll();
    if (records.length === 0) {
      return { totalGames: 0, bestScore: 0, totalKills: 0, totalDeaths: 0, kd: '0.0' };
    }
    const totalGames = records.length;
    const bestScore = Math.max(...records.map(r => r.score));
    const totalKills = records.reduce((s, r) => s + r.kills, 0);
    const totalDeaths = records.reduce((s, r) => s + r.deaths, 0);
    const kd = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2);
    return { totalGames, bestScore, totalKills, totalDeaths, kd };
  },

  // Check if there are guest stats to sync
  hasStats() {
    return this.getAll().length > 0;
  },

  // Clear all guest stats (after sync)
  clear() {
    localStorage.removeItem(GUEST_STATS_KEY);
  },
};
