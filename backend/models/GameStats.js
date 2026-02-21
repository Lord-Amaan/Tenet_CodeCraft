import mongoose from 'mongoose';

const gameStatsSchema = new mongoose.Schema({
  clerkUserId: {
    type: String,
    required: true,
    index: true,
  },
  sessionId: {
    type: String,
    index: true,
    sparse: true,
  },
  score: {
    type: Number,
    default: 0,
  },
  kills: {
    type: Number,
    default: 0,
  },
  deaths: {
    type: Number,
    default: 0,
  },
  territoryPercent: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('GameStats', gameStatsSchema);
