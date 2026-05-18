import mongoose from "mongoose";

const portfolioSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  usd: { type: Number, default: 10000 },
  holdings: {
    type: Map,
    of: Number,
    default: { AAPL: 0, TSLA: 0, BTC: 0, ETH: 0 },
  },
  avgCost: {
    type: Map,
    of: Number,
    default: { AAPL: 0, TSLA: 0, BTC: 0, ETH: 0 },
  },
  realizedPnl: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

portfolioSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Portfolio", portfolioSchema);
