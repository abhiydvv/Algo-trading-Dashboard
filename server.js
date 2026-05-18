import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
import Portfolio from "./models/Portfolio.js";
import Trade from "./models/Trade.js";
import MarketSnapshot from "./models/MarketSnapshot.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const JWT_SECRET = process.env.JWT_SECRET || "quantum-forge-jwt-secret";
const API_KEY = process.env.TWELVEDATA_API_KEY || "90ff14df06ec4e0ab4f861ff008b41c1";

// ============================================
// MONGODB CONNECTION
// ============================================
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.log("❌ MongoDB connection error:", err.message));
} else {
  console.log("⚠️  No MONGODB_URI set — running without database (data will not persist)");
}

// ============================================
// JWT MIDDLEWARE
// ============================================
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ============================================
// AUTH ROUTES
// ============================================
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const user = new User({ name, email, password });
    await user.save();

    // Create default portfolio for user
    const portfolio = new Portfolio({ userId: user._id });
    await portfolio.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ user: user.toJSON(), token });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ error: "Server error during signup" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ user: user.toJSON(), token });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Server error during login" });
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: user.toJSON() });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// PORTFOLIO ROUTES
// ============================================
app.get("/api/portfolio", authMiddleware, async (req, res) => {
  try {
    let portfolio = await Portfolio.findOne({ userId: req.userId });
    if (!portfolio) {
      portfolio = new Portfolio({ userId: req.userId });
      await portfolio.save();
    }
    // Convert Mongoose Maps to plain objects for frontend
    res.json({
      usd: portfolio.usd,
      holdings: Object.fromEntries(portfolio.holdings),
      avgCost: Object.fromEntries(portfolio.avgCost),
      realizedPnl: portfolio.realizedPnl,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

app.put("/api/portfolio", authMiddleware, async (req, res) => {
  try {
    const { usd, holdings, avgCost, realizedPnl } = req.body;
    let portfolio = await Portfolio.findOne({ userId: req.userId });
    if (!portfolio) {
      portfolio = new Portfolio({ userId: req.userId });
    }
    if (usd !== undefined) portfolio.usd = usd;
    if (holdings) portfolio.holdings = new Map(Object.entries(holdings));
    if (avgCost) portfolio.avgCost = new Map(Object.entries(avgCost));
    if (realizedPnl !== undefined) portfolio.realizedPnl = realizedPnl;
    await portfolio.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save portfolio" });
  }
});

// ============================================
// TRADE ROUTES
// ============================================
app.get("/api/trades", authMiddleware, async (req, res) => {
  try {
    const trades = await Trade.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(trades);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trades" });
  }
});

app.post("/api/trades", authMiddleware, async (req, res) => {
  try {
    const trade = new Trade({ ...req.body, userId: req.userId });
    await trade.save();
    res.status(201).json(trade);
  } catch (err) {
    res.status(500).json({ error: "Failed to save trade" });
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get("/", (req, res) => {
  res.json({
    status: "running",
    name: "Quantum Forge Backend",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: Math.floor(process.uptime()) + "s",
  });
});

// ============================================
// MARKET DATA FETCHER
// ============================================
let currentMarketData = {
  AAPL: { price: 0, change: 0 },
  TSLA: { price: 0, change: 0 },
  BTC: { price: 0, change: 0 },
  ETH: { price: 0, change: 0 },
};

async function fetchMarketData() {
  try {
    // STOCK DATA
    try {
      const stockResponse = await fetch(
        `https://api.twelvedata.com/quote?symbol=AAPL,TSLA&apikey=${API_KEY}`
      );
      const stockData = await stockResponse.json();

      if (stockData.AAPL && stockData.AAPL.close) {
        currentMarketData.AAPL = {
          price: parseFloat(stockData.AAPL.close),
          change: parseFloat(stockData.AAPL.percent_change),
          high: parseFloat(stockData.AAPL.high) || 0,
          low: parseFloat(stockData.AAPL.low) || 0,
          open: parseFloat(stockData.AAPL.open) || 0,
          volume: parseInt(stockData.AAPL.volume) || 0,
        };
      }
      if (stockData.TSLA && stockData.TSLA.close) {
        currentMarketData.TSLA = {
          price: parseFloat(stockData.TSLA.close),
          change: parseFloat(stockData.TSLA.percent_change),
          high: parseFloat(stockData.TSLA.high) || 0,
          low: parseFloat(stockData.TSLA.low) || 0,
          open: parseFloat(stockData.TSLA.open) || 0,
          volume: parseInt(stockData.TSLA.volume) || 0,
        };
      } else if (stockData.code === 429) {
        console.log("TwelveData Rate Limit Exceeded");
      }
    } catch (e) {
      console.log("Stock API Error:", e.message);
    }

    // CRYPTO DATA
    try {
      const cryptoResponse = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true"
      );
      const crypto = await cryptoResponse.json();

      if (crypto.bitcoin) {
        currentMarketData.BTC = {
          price: crypto.bitcoin.usd || currentMarketData.BTC.price,
          change: parseFloat((crypto.bitcoin.usd_24h_change ?? 0).toFixed(2)),
        };
      }
      if (crypto.ethereum) {
        currentMarketData.ETH = {
          price: crypto.ethereum.usd || currentMarketData.ETH.price,
          change: parseFloat((crypto.ethereum.usd_24h_change ?? 0).toFixed(2)),
        };
      }
    } catch (e) {
      console.log("Crypto API Error:", e.message);
    }

    // Save market snapshots to DB (if connected)
    if (mongoose.connection.readyState === 1) {
      try {
        const snapshots = Object.entries(currentMarketData)
          .filter(([, d]) => d.price > 0)
          .map(([symbol, data]) => ({
            symbol,
            price: data.price,
            change: data.change,
            high: data.high || 0,
            low: data.low || 0,
            open: data.open || 0,
            volume: data.volume || 0,
          }));
        if (snapshots.length > 0) {
          await MarketSnapshot.insertMany(snapshots);
        }
      } catch (e) {
        // Don't crash on snapshot save failure
      }
    }

    io.emit("marketData", currentMarketData);
  } catch (err) {
    console.log("ERROR:", err.message);
  }
}

// ============================================
// SOCKET.IO
// ============================================
io.on("connection", (socket) => {
  console.log("Client connected");
  fetchMarketData();
  const interval = setInterval(fetchMarketData, 10000);
  socket.on("disconnect", () => {
    clearInterval(interval);
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Quantum Forge Backend running on port ${PORT}`);
});