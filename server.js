import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
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
const API_KEY = process.env.TWELVEDATA_API_KEY;
if (!API_KEY) console.warn("⚠️  No TWELVEDATA_API_KEY set — stock data will not load");

// ============================================
// IN-MEMORY FALLBACK DATABASE
// ============================================
const inMemoryUsers = [];
const inMemoryPortfolios = {}; // userId -> portfolio
const inMemoryTrades = {}; // userId -> trades array

const generateFakeId = () => new mongoose.Types.ObjectId().toString();

// ============================================
// MONGODB CONNECTION & SOCKET STATUS
// ============================================
const MONGODB_URI = process.env.MONGODB_URI;
let dbErrorMsg = "";

if (MONGODB_URI) {
  const connectDB = async () => {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });
      console.log("✅ MongoDB connected");
      dbErrorMsg = "";
      io.emit("dbStatus", { connected: true, error: "" });
    } catch (err) {
      console.log("❌ MongoDB connection error:", err.message);
      dbErrorMsg = err.message;
      io.emit("dbStatus", { connected: false, error: err.message });
      console.log("Retrying in 5 seconds...");
      setTimeout(connectDB, 5000);
    }
  };
  connectDB();
} else {
  dbErrorMsg = "No MONGODB_URI set in environment variables";
  console.log("⚠️  No MONGODB_URI set — running without database (data will not persist)");
  console.log("Please add MONGODB_URI to your .env file to enable data persistence.");
}

// Watch connection state to broadcast to connected sockets
mongoose.connection.on("connected", () => {
  console.log("📢 MongoDB Connected - broadcasting state to clients");
  dbErrorMsg = "";
  io.emit("dbStatus", { connected: true, error: "" });
});

mongoose.connection.on("disconnected", () => {
  console.log("📢 MongoDB Disconnected - broadcasting state to clients");
  io.emit("dbStatus", { connected: false, error: dbErrorMsg || "MongoDB disconnected" });
});

// Middleware to check DB connectivity (kept as no-op to avoid breaking route signatures)
function requireDB(req, res, next) {
  next();
}

// Graceful shutdown
process.on("SIGINT", async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log("MongoDB connection closed through app termination");
  }
  process.exit(0);
});

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
app.post("/api/auth/signup", requireDB, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const lowerEmail = email.toLowerCase().trim();

    if (mongoose.connection.readyState === 1) {
      const existingUser = await User.findOne({ email: lowerEmail });
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const user = new User({ name, email: lowerEmail, password });
      await user.save();

      // Create default portfolio for user
      const portfolio = new Portfolio({ userId: user._id });
      await portfolio.save();

      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "30d" });
      res.status(201).json({ user: user.toJSON(), token });
    } else {
      // In-Memory Fallback
      const existingUser = inMemoryUsers.find(u => u.email === lowerEmail);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = generateFakeId();
      const user = {
        _id: userId,
        name,
        email: lowerEmail,
        password: hashedPassword,
        uid: `QF-${Math.floor(Math.random() * 900000 + 100000)}`,
        createdAt: new Date(),
        isDemoMode: true
      };

      inMemoryUsers.push(user);

      // Create default portfolio in-memory
      inMemoryPortfolios[userId] = {
        userId,
        usd: 10000,
        holdings: { AAPL: 0, TSLA: 0, BTC: 0, ETH: 0 },
        avgCost: { AAPL: 0, TSLA: 0, BTC: 0, ETH: 0 },
        realizedPnl: 0,
        updatedAt: new Date()
      };

      const userResponse = { ...user };
      delete userResponse.password;

      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
      res.status(201).json({ user: userResponse, token });
    }
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ error: "Server error during signup" });
  }
});

app.post("/api/auth/login", requireDB, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const lowerEmail = email.toLowerCase().trim();

    if (mongoose.connection.readyState === 1) {
      const user = await User.findOne({ email: lowerEmail });
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "30d" });
      res.json({ user: user.toJSON(), token });
    } else {
      // In-Memory Fallback
      const user = inMemoryUsers.find(u => u.email === lowerEmail);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const userResponse = { ...user };
      delete userResponse.password;

      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "30d" });
      res.json({ user: userResponse, token });
    }
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Server error during login" });
  }
});

app.get("/api/auth/me", requireDB, authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ user: user.toJSON() });
    } else {
      // In-Memory Fallback
      const user = inMemoryUsers.find(u => u._id === req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const userResponse = { ...user };
      delete userResponse.password;
      res.json({ user: userResponse });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// PORTFOLIO ROUTES
// ============================================
app.get("/api/portfolio", requireDB, authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      let portfolio = await Portfolio.findOne({ userId: req.userId });
      if (!portfolio) {
        portfolio = new Portfolio({ userId: req.userId });
        await portfolio.save();
      }
      res.json({
        usd: portfolio.usd,
        holdings: Object.fromEntries(portfolio.holdings),
        avgCost: Object.fromEntries(portfolio.avgCost),
        realizedPnl: portfolio.realizedPnl,
      });
    } else {
      // In-Memory Fallback
      let portfolio = inMemoryPortfolios[req.userId];
      if (!portfolio) {
        portfolio = {
          userId: req.userId,
          usd: 10000,
          holdings: { AAPL: 0, TSLA: 0, BTC: 0, ETH: 0 },
          avgCost: { AAPL: 0, TSLA: 0, BTC: 0, ETH: 0 },
          realizedPnl: 0,
          updatedAt: new Date()
        };
        inMemoryPortfolios[req.userId] = portfolio;
      }
      res.json({
        usd: portfolio.usd,
        holdings: portfolio.holdings,
        avgCost: portfolio.avgCost,
        realizedPnl: portfolio.realizedPnl,
      });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

app.put("/api/portfolio", requireDB, authMiddleware, async (req, res) => {
  try {
    const { usd, holdings, avgCost, realizedPnl } = req.body;
    if (mongoose.connection.readyState === 1) {
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
    } else {
      // In-Memory Fallback
      let portfolio = inMemoryPortfolios[req.userId];
      if (!portfolio) {
        portfolio = {
          userId: req.userId,
          usd: 10000,
          holdings: { AAPL: 0, TSLA: 0, BTC: 0, ETH: 0 },
          avgCost: { AAPL: 0, TSLA: 0, BTC: 0, ETH: 0 },
          realizedPnl: 0,
          updatedAt: new Date()
        };
        inMemoryPortfolios[req.userId] = portfolio;
      }
      if (usd !== undefined) portfolio.usd = usd;
      if (holdings) portfolio.holdings = holdings;
      if (avgCost) portfolio.avgCost = avgCost;
      if (realizedPnl !== undefined) portfolio.realizedPnl = realizedPnl;
      portfolio.updatedAt = new Date();
      res.json({ success: true });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to save portfolio" });
  }
});

// ============================================
// TRADE ROUTES
// ============================================
app.get("/api/trades", requireDB, authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const trades = await Trade.find({ userId: req.userId })
        .sort({ timestamp: -1 })
        .limit(100);
      res.json(trades);
    } else {
      // In-Memory Fallback
      const trades = inMemoryTrades[req.userId] || [];
      const sorted = [...trades].sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
      res.json(sorted);
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trades" });
  }
});

app.post("/api/trades", requireDB, authMiddleware, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const trade = new Trade({ ...req.body, userId: req.userId });
      await trade.save();
      res.status(201).json(trade);
    } else {
      // In-Memory Fallback
      const tradeId = generateFakeId();
      const trade = {
        _id: tradeId,
        ...req.body,
        userId: req.userId,
        timestamp: new Date()
      };
      if (!inMemoryTrades[req.userId]) {
        inMemoryTrades[req.userId] = [];
      }
      inMemoryTrades[req.userId].push(trade);
      res.status(201).json(trade);
    }
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
  socket.emit("dbStatus", { connected: mongoose.connection.readyState === 1, error: mongoose.connection.readyState === 1 ? "" : dbErrorMsg });
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