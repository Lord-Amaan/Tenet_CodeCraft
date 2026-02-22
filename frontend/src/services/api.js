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

// ── Wallet / Coins ──────────────────────────────────────────────────

// Get user's wallet (coins + unlocked skins)
export async function getWallet(getToken) {
  const headers = await getAuthHeaders(getToken);
  const res = await fetch(`${API_BASE}/wallet`, { headers });
  return res.json();
}

// Reward coins after round (kills / deaths / winner)
export async function rewardCoins(getToken, { kills, deaths, isWinner }) {
  const headers = await getAuthHeaders(getToken);
  const res = await fetch(`${API_BASE}/reward-coins`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ kills, deaths, isWinner }),
  });
  return res.json();
}

// Real-time coin event (single kill/death/win)
export async function coinEvent(getToken, type) {
  const headers = await getAuthHeaders(getToken);
  const res = await fetch(`${API_BASE}/coin-event`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type }),
  });
  return res.json();
}

// ── Shop ────────────────────────────────────────────────────────────

// Get shop catalog (skins + coin packs)
export async function getShopCatalog() {
  const res = await fetch(`${API_BASE}/shop`);
  return res.json();
}

// Buy a skin with coins
export async function buySkin(getToken, skinId) {
  const headers = await getAuthHeaders(getToken);
  const res = await fetch(`${API_BASE}/buy-skin`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ skinId }),
  });
  return res.json();
}

// Buy a coin pack (simulated in-app purchase)
export async function buyCoins(getToken, packId) {
  const headers = await getAuthHeaders(getToken);
  const res = await fetch(`${API_BASE}/buy-coins`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ packId }),
  });
  return res.json();
}
