// ── Guest Stats Service ──────────────────────────────────────────────
// Stores game stats in localStorage for unauthenticated (guest) users.
// Once a guest signs in, these stats are synced to the backend and cleared.

const GUEST_STATS_KEY = 'gol_guest_stats';

// Get all stored guest game records
export function getGuestGames() {
  try {
    const data = localStorage.getItem(GUEST_STATS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save a game result
export function saveGuestGame({ score, kills, deaths, territoryPercent }) {
  const records = getGuestGames();
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
}

// Get summary stats
export function getGuestSummary() {
  const records = getGuestGames();
  if (records.length === 0) {
    return { totalGames: 0, bestScore: 0, totalKills: 0, totalDeaths: 0, avgTerritory: 0, kd: '0.00' };
  }
  const totalGames = records.length;
  const bestScore = Math.max(...records.map(r => r.score));
  const totalKills = records.reduce((s, r) => s + r.kills, 0);
  const totalDeaths = records.reduce((s, r) => s + r.deaths, 0);
  const avgTerritory = Math.round(records.reduce((s, r) => s + (r.territoryPercent || 0), 0) / records.length);
  const kd = totalDeaths > 0 ? (totalKills / totalDeaths) : totalKills;
  return { totalGames, bestScore, totalKills, totalDeaths, avgTerritory, kd, recentGames: records.slice(-10).reverse() };
}

// Check if there are guest stats to sync
export function hasGuestStats() {
  return getGuestGames().length > 0;
}

// Clear all guest stats (after sync)
export function clearGuestStats() {
  localStorage.removeItem(GUEST_STATS_KEY);
}
