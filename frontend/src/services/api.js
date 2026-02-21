// ── API Service ──────────────────────────────────────────────────────
// Handles all HTTP calls to the backend with Clerk JWT auth.

const API_BASE = 'http://localhost:3000/api';

async function authFetch(path, options = {}, getToken) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (getToken) {
    try {
      const token = await getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('Failed to get auth token:', err);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Save score (authenticated)
  saveScore(data, getToken) {
    return authFetch('/save-score', {
      method: 'POST',
      body: JSON.stringify(data),
    }, getToken);
  },

  // Get my stats (authenticated)
  getMyStats(getToken) {
    return authFetch('/my-stats', {}, getToken);
  },

  // Sync guest stats after login (authenticated)
  syncGuest(guestGames, username, getToken) {
    return authFetch('/sync-guest', {
      method: 'POST',
      body: JSON.stringify({ guestGames, username }),
    }, getToken);
  },

  // Get public leaderboard
  getLeaderboard() {
    return authFetch('/leaderboard');
  },
};
