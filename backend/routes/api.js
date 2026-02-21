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

export default router;
