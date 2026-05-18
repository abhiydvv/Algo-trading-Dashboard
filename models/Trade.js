import mongoose from "mongoose";

const tradeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  symbol: { type: String, required: true },
  action: { type: String, required: true }, // BUY, SELL, LONG, SHORT, CLOSE LONG, CLOSE SHORT
  price: { type: Number, required: true },
  qty: { type: Number, required: true },
  total: { type: Number, required: true },
  pnl: { type: Number, default: 0 },
  source: { type: String, default: "MANUAL" }, // MANUAL, ALGO, FUTURES, MARGIN
  tradeMode: { type: String, default: "spot" }, // spot, futures, margin
  timestamp: { type: Date, default: Date.now },
});

// Index for fast user-specific queries sorted by time
tradeSchema.index({ userId: 1, timestamp: -1 });

export default mongoose.model("Trade", tradeSchema);
