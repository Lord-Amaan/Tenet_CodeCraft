// ── API Service ──────────────────────────────────────────────────────
// Handles all HTTP calls to the backend with Clerk JWT auth.

const API_BASE = 'http://localhost:3000/api';

async function getAuthHeaders(getToken) {
  const headers = { 'Content-Type': 'application/json' };
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
  return headers;
}

// Save score (authenticated)
export async function saveScore(getToken, data) {
  const headers = await getAuthHeaders(getToken);
  const res = await fetch(`${API_BASE}/save-score`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
}

// Get my stats (authenticated)
export async function getMyStats(getToken) {
  const headers = await getAuthHeaders(getToken);
  const res = await fetch(`${API_BASE}/my-stats`, { headers });
  return res.json();
}

// Sync guest stats after login (authenticated)
export async function syncGuestStats(getToken, guestGames, username) {
  const headers = await getAuthHeaders(getToken);
  const res = await fetch(`${API_BASE}/sync-guest`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ guestGames, username }),
  });
  return res.json();
}

// Get public leaderboard
export async function getLeaderboard() {
  const res = await fetch(`${API_BASE}/leaderboard`);
  return res.json();
}
