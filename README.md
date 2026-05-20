# ⚛️ Quantum Forge — Algorithmic Trading Platform

A full-stack, real-time algorithmic trading platform built with **React**, **Node.js**, **Socket.IO**, and **live market APIs**. Features automated trading strategies powered by technical analysis indicators, candlestick charting, multi-mode trading (Spot, Futures, Margin), and real-time portfolio tracking.

> **Live Demo**: [Deployed on Vercel](https://quantum-forge.vercel.app) | **Backend**: [Hosted on Render](https://algo-backend-s75o.onrender.com)

---

## 📸 Screenshots

| Dashboard | Algo Trading | Futures Mode |
|-----------|-------------|--------------|
| Live candlestick chart with BTC/USDT, market watchlist, and order panel | 5 technical indicators with auto-execute toggle and confidence meter | Leveraged trading with Long/Short positions and liquidation prices |

---

## ✨ Features

### 🔴 Live Market Data
- Real-time stock prices (AAPL, TSLA) via **TwelveData API**
- Real-time crypto prices (BTC, ETH) via **CoinGecko API**
- WebSocket-powered live updates every 10 seconds

### 📊 Advanced Charting
- **Candlestick chart** with OHLC data and wick rendering
- **Line chart** mode toggle
- **SMA(5) & SMA(20)** moving average overlays
- **Bollinger Bands** overlay (upper/lower)
- Multiple timeframe tabs (1m, 5m, 15m, 1H, 4H, 1D)

### 🤖 Algorithmic Trading Engine
- **5 Technical Indicators**: SMA Crossover, RSI(14), MACD, Bollinger Bands, Momentum
- **Weighted Voting System**: Each indicator votes BUY/SELL/HOLD with configurable weights
- **Auto-Execute Toggle**: One-click to enable/disable automated trading
- **Risk Management**: Configurable Stop-Loss, Take-Profit, and Position Sizing
- **Activity Log**: Real-time feed of all algo decisions and trades

### 💹 Multi-Mode Trading
- **Spot Trading**: Standard buy/sell with Limit, Market, and Stop-Limit orders
- **Futures Trading**: Leveraged trading (2x–125x) with Long/Short positions
- **Margin Trading**: Borrow-based trading with margin ratio monitoring

### 💰 Portfolio & Account Management
- **Paper Trading**: Start with $10,000 virtual USD
- **P&L Tracking**: Real-time realized and unrealized profit/loss
- **Asset Center**: Portfolio allocation bar, deposit/withdraw funds
- **Account Center**: Demo login/signup, stats dashboard, win rate tracking
- **Trade History**: Complete trade log with source badges (Manual, Algo, Futures, Margin)

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, Recharts |
| **Backend** | Node.js, Express 5, Socket.IO |
| **APIs** | TwelveData (stocks), CoinGecko (crypto) |
| **Styling** | Vanilla CSS, CSS Custom Properties |
| **Deployment** | Vercel (frontend), Render (backend) |
| **Real-time** | WebSocket (Socket.IO) |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  React    │  │ Recharts │  │ Strategy │  │ Socket.IO   │ │
│  │  UI       │  │ Charts   │  │ Engine   │  │ Client      │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────┬──────┘ │
└──────────────────────────────────────────────────────┼───────┘
                                                       │ WebSocket
┌──────────────────────────────────────────────────────┼───────┐
│                      SERVER (Node.js)                │       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │       │
│  │ Express  │  │ Socket.IO    │  │ Market Data   │  │       │
│  │ HTTP     │  │ Server       │◄─┤ Fetcher       │  │       │
│  └──────────┘  └──────────────┘  └───────┬───────┘  │       │
│                                          │          │       │
│                              ┌───────────┴──────┐   │       │
│                              │  External APIs   │   │       │
│                              │  • TwelveData    │   │       │
│                              │  • CoinGecko     │   │       │
│                              └──────────────────┘   │       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/abhiydvv/Algo-trading-Dashboard.git
cd Algo-trading-Dashboard

# Install dependencies
npm install
```

### Running Locally

```bash
# Start both frontend and backend simultaneously
npm run dev:all
```

This starts:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:10000

### Individual Commands

```bash
npm run dev        # Start Vite frontend only
npm run server     # Start Express backend only
npm run build      # Build for production
npm run preview    # Preview production build
```

---

## 📁 Project Structure

```
quantum-forge/
├── public/
│   └── logo.png              # App logo
├── src/
│   ├── engine/
│   │   ├── indicators.js     # Technical analysis indicators (SMA, RSI, MACD, BB, Momentum)
│   │   └── strategy.js       # Weighted voting strategy engine + risk management
│   ├── components/
│   │   ├── StockCard.jsx
│   │   ├── PriceChart.jsx
│   │   └── TradingPanel.jsx
│   ├── App.jsx               # Main application (683 lines)
│   ├── App.css               # Complete UI styles (1500+ lines)
│   ├── index.css             # Design system tokens
│   └── main.jsx              # React entry point
├── server.js                 # Express + Socket.IO backend
├── index.html                # HTML entry with SEO meta tags
├── vercel.json               # Vercel deployment config
├── vite.config.js            # Vite configuration
└── package.json              # Dependencies and scripts
```

---

## 🌐 Deployment

### Frontend (Vercel)
1. Import repo on [vercel.com](https://vercel.com)
2. Set environment variable: `VITE_BACKEND_URL=https://your-backend.onrender.com`
3. Deploy — Vercel auto-detects Vite

### Backend (Render)
1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect the same GitHub repo
3. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Deploy

---

## 📝 API Credits

- **TwelveData** — Real-time stock market data (free tier: 8 requests/minute)
- **CoinGecko** — Cryptocurrency market data (free, no API key required)

---

## 👨‍💻 Author

**Abhishek Kumar**

---

## 📄 License

This project is for educational purposes (college project).
