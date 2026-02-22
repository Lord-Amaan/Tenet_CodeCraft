import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  clerkUserId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  username: {
    type: String,
    default: 'Player',
  },
  coins: {
    type: Number,
    default: 0,
  },
  unlockedSkins: {
    type: [String],
    default: ['lava', 'ocean', 'fungi', 'earth'],  // 4 free starter skins
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('User', userSchema);
