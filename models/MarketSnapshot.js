import mongoose from "mongoose";

const marketSnapshotSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },
  price: { type: Number, required: true },
  change: { type: Number, default: 0 },
  high: { type: Number, default: 0 },
  low: { type: Number, default: 0 },
  open: { type: Number, default: 0 },
  volume: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
});

// Auto-delete snapshots older than 7 days to keep DB size small
marketSnapshotSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

// Compound index for fast symbol + time queries
marketSnapshotSchema.index({ symbol: 1, timestamp: -1 });

export default mongoose.model("MarketSnapshot", marketSnapshotSchema);
