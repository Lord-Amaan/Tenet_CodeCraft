import express from 'express';
import mongoose from 'mongoose';
import { requireClerkAuth, getClerkUserId } from '../middleware/auth.js';
import User from '../models/User.js';
import GameStats from '../models/GameStats.js';

const router = express.Router();

// Helper to check DB connection
function dbReady() {
  return mongoose.connection.readyState === 1;
}

// ── POST /api/save-score ─────────────────────────────────────────────
// Protected: saves or updates a game session for the authenticated user.
// If sessionId is provided, upserts the same record (for periodic saves).
router.post('/save-score', requireClerkAuth, async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: 'Database not connected' });

    const clerkUserId = getClerkUserId(req);
    const { score, kills, deaths, territoryPercent, username, sessionId } = req.body;

    if (!clerkUserId) return res.status(401).json({ error: 'Not authenticated' });

    // Upsert user record
    await User.findOneAndUpdate(
      { clerkUserId },
      { clerkUserId, username: username || 'Player' },
      { upsert: true, new: true }
    );

    const statsData = {
      clerkUserId,
      score: score || 0,
      kills: kills || 0,
      deaths: deaths || 0,
      territoryPercent: territoryPercent || 0,
    };

    let stats;
    if (sessionId) {
      // Upsert: update existing session record or create new
      stats = await GameStats.findOneAndUpdate(
        { clerkUserId, sessionId },
        { ...statsData, sessionId },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`📊 Session ${sessionId} saved for ${clerkUserId}: score=${score} kills=${kills} deaths=${deaths}`);
    } else {
      // No session — create a new record (legacy / one-off save)
      stats = await GameStats.create(statsData);
      console.log(`📊 Score saved for ${clerkUserId}: score=${score} kills=${kills} deaths=${deaths}`);
    }

    res.json({ success: true, statsId: stats._id });
  } catch (err) {
    console.error('Error saving score:', err);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

// ── GET /api/my-stats ────────────────────────────────────────────────
// Protected: returns the authenticated user's stats
router.get('/my-stats', requireClerkAuth, async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: 'Database not connected' });

    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Not authenticated' });

    const games = await GameStats.find({ clerkUserId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const totalGames = await GameStats.countDocuments({ clerkUserId });
    const bestScore = games.length > 0
      ? Math.max(...games.map(g => g.score))
      : 0;
    const totalKills = games.reduce((sum, g) => sum + (g.kills || 0), 0);
    const totalDeaths = games.reduce((sum, g) => sum + (g.deaths || 0), 0);
    const avgTerritory = games.length > 0
      ? Math.round(games.reduce((sum, g) => sum + (g.territoryPercent || 0), 0) / games.length)
      : 0;

    res.json({
      success: true,
      summary: {
        totalGames,
        bestScore,
        totalKills,
        totalDeaths,
        avgTerritory,
        kd: totalDeaths > 0 ? (totalKills / totalDeaths) : totalKills,
      },
      recentGames: games.slice(0, 20),
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── POST /api/sync-guest ────────────────────────────────────────────
// Protected: syncs guest stats from localStorage after sign-in
router.post('/sync-guest', requireClerkAuth, async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: 'Database not connected' });

    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Not authenticated' });
    const { guestGames, username } = req.body;

    // Upsert user
    await User.findOneAndUpdate(
      { clerkUserId },
      { clerkUserId, username: username || 'Player' },
      { upsert: true, new: true }
    );

    // Save each guest game as a real record
    if (Array.isArray(guestGames) && guestGames.length > 0) {
      const docs = guestGames.map(g => ({
        clerkUserId,
        score: g.score || 0,
        kills: g.kills || 0,
        deaths: g.deaths || 0,
        territoryPercent: g.territoryPercent || 0,
        createdAt: g.createdAt ? new Date(g.createdAt) : new Date(),
      }));
      await GameStats.insertMany(docs);
      console.log(`📊 Synced ${docs.length} guest games for ${clerkUserId}`);
    }

    res.json({ success: true, synced: guestGames?.length || 0 });
  } catch (err) {
    console.error('Error syncing guest stats:', err);
    res.status(500).json({ error: 'Failed to sync guest stats' });
  }
});

// ── GET /api/leaderboard ────────────────────────────────────────────
// Public: returns top players by best score
router.get('/leaderboard', async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: 'Database not connected' });

    const leaders = await GameStats.aggregate([
      {
        $group: {
          _id: '$clerkUserId',
          bestScore: { $max: '$score' },
          totalKills: { $sum: '$kills' },
          totalGames: { $sum: 1 },
        },
      },
      { $sort: { bestScore: -1 } },
      { $limit: 20 },
    ]);

    // Attach usernames
    const userIds = leaders.map(l => l._id);
    const users = await User.find({ clerkUserId: { $in: userIds } });
    const userMap = {};
    users.forEach(u => { userMap[u.clerkUserId] = u.username; });

    const leaderboard = leaders.map((l, i) => ({
      rank: i + 1,
      username: userMap[l._id] || 'Player',
      bestScore: l.bestScore,
      totalKills: l.totalKills,
      totalGames: l.totalGames,
    }));

    res.json({ success: true, leaderboard });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ── GET /api/wallet ──────────────────────────────────────────────────
// Protected: returns the user's coins + unlocked skins
router.get('/wallet', requireClerkAuth, async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: 'Database not connected' });
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Not authenticated' });

    const user = await User.findOneAndUpdate(
      { clerkUserId },
      { clerkUserId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      coins: user.coins,
      unlockedSkins: user.unlockedSkins,
    });
  } catch (err) {
    console.error('Error fetching wallet:', err);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// ── POST /api/reward-coins ──────────────────────────────────────────
// Protected: add or subtract coins (server-authoritative)
// body: { kills, deaths, isWinner }
router.post('/reward-coins', requireClerkAuth, async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: 'Database not connected' });
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Not authenticated' });

    const { kills = 0, deaths = 0, isWinner = false } = req.body;

    // Economy: +2 per kill, -1 per death, +10 for round win
    let delta = (kills * 2) - (deaths * 1) + (isWinner ? 10 : 0);

    const user = await User.findOneAndUpdate(
      { clerkUserId },
      { $inc: { coins: delta } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Floor at 0
    if (user.coins < 0) {
      user.coins = 0;
      await user.save();
    }

    console.log(`💰 ${clerkUserId}: ${delta >= 0 ? '+' : ''}${delta} coins → ${user.coins}`);
    res.json({ success: true, coins: user.coins, delta });
  } catch (err) {
    console.error('Error rewarding coins:', err);
    res.status(500).json({ error: 'Failed to reward coins' });
  }
});

// ── POST /api/coin-event ────────────────────────────────────────────
// Protected: lightweight real-time coin update for a single event
// body: { type: 'kill' | 'death' | 'win' }
router.post('/coin-event', requireClerkAuth, async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: 'Database not connected' });
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Not authenticated' });

    const { type } = req.body;
    const deltas = { kill: 2, death: -1, win: 10 };
    const delta = deltas[type];
    if (delta === undefined) return res.status(400).json({ error: 'Invalid event type' });

    const user = await User.findOneAndUpdate(
      { clerkUserId },
      { $inc: { coins: delta } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Floor at 0
    if (user.coins < 0) {
      user.coins = 0;
      await user.save();
    }

    res.json({ success: true, coins: user.coins, delta });
  } catch (err) {
    console.error('Error processing coin event:', err);
    res.status(500).json({ error: 'Failed to process coin event' });
  }
});

// ── POST /api/buy-skin ──────────────────────────────────────────────
// Protected: spend coins to unlock a skin
// body: { skinId }
router.post('/buy-skin', requireClerkAuth, async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: 'Database not connected' });
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Not authenticated' });

    const { skinId } = req.body;
    const { SKIN_CATALOG } = await import('./api.js');      // self-import for catalog
    const skin = SKIN_CATALOG.find(s => s.id === skinId);
    if (!skin) return res.status(400).json({ error: 'Unknown skin' });

    const user = await User.findOne({ clerkUserId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.unlockedSkins.includes(skinId)) {
      return res.json({ success: true, already: true, coins: user.coins, unlockedSkins: user.unlockedSkins });
    }

    if (user.coins < skin.price) {
      return res.status(400).json({ error: 'Not enough coins', coins: user.coins, price: skin.price });
    }

    user.coins -= skin.price;
    user.unlockedSkins.push(skinId);
    await user.save();

    console.log(`🛒 ${clerkUserId} bought skin "${skinId}" for ${skin.price} coins. Remaining: ${user.coins}`);
    res.json({ success: true, coins: user.coins, unlockedSkins: user.unlockedSkins });
  } catch (err) {
    console.error('Error buying skin:', err);
    res.status(500).json({ error: 'Failed to buy skin' });
  }
});

// ── POST /api/buy-coins ─────────────────────────────────────────────
// Protected: simulate in-app purchase (dev mode — no real payment)
// body: { packId }
router.post('/buy-coins', requireClerkAuth, async (req, res) => {
  try {
    if (!dbReady()) return res.status(503).json({ error: 'Database not connected' });
    const clerkUserId = getClerkUserId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'Not authenticated' });

    const { packId } = req.body;
    const { COIN_PACKS } = await import('./api.js');
    const pack = COIN_PACKS.find(p => p.id === packId);
    if (!pack) return res.status(400).json({ error: 'Unknown coin pack' });

    const user = await User.findOneAndUpdate(
      { clerkUserId },
      { $inc: { coins: pack.coins } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log(`💳 ${clerkUserId} purchased "${pack.label}" → ${user.coins} coins`);
    res.json({ success: true, coins: user.coins, added: pack.coins });
  } catch (err) {
    console.error('Error buying coins:', err);
    res.status(500).json({ error: 'Failed to buy coins' });
  }
});

// ── GET /api/shop ────────────────────────────────────────────────────
// Public: returns skin + coin pack catalogs
router.get('/shop', (req, res) => {
  // Import catalogs from this same file
  import('./api.js').then(({ SKIN_CATALOG, COIN_PACKS }) => {
    res.json({ success: true, skins: SKIN_CATALOG, coinPacks: COIN_PACKS });
  });
});

export default router;

// ── Skin shop catalog ──────────────────────────────────────────────
// IDs match the ELEMENTS array on the frontend.
// The first 4 are free (unlocked by default); crystal & frost are premium.
export const SKIN_CATALOG = [
  { id: 'lava',    colorIndex: 0, price: 0,   label: 'Lava'    },
  { id: 'ocean',   colorIndex: 1, price: 0,   label: 'Ocean'   },
  { id: 'fungi',   colorIndex: 2, price: 0,   label: 'Fungi'   },
  { id: 'earth',   colorIndex: 3, price: 0,   label: 'Earth'   },
  { id: 'crystal', colorIndex: 4, price: 50,  label: 'Crystal' },
  { id: 'frost',   colorIndex: 5, price: 100, label: 'Frost'   },
];

// ── Coin‐pack catalog (in‐app purchase) ────────────────────────────
export const COIN_PACKS = [
  { id: 'pack_small',  coins: 50,  price: '$0.99',  label: '50 Coins'  },
  { id: 'pack_medium', coins: 150, price: '$2.49',  label: '150 Coins' },
  { id: 'pack_large',  coins: 500, price: '$4.99',  label: '500 Coins' },
];
