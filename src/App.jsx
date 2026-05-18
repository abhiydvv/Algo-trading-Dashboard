import { useEffect, useState, useRef, useCallback } from "react";
import { ComposedChart, Area, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { io } from "socket.io-client";
import { createStrategyEngine } from "./engine/strategy.js";
import { computeSMA, computeBollingerBands } from "./engine/indicators.js";
import "./App.css";

const qfLogo = "/logo.png";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";
const socket = io(BACKEND_URL, { transports: ["websocket", "polling"] });

const ASSETS = {
  AAPL: { name: "Apple Inc.", type: "stock", pair: "AAPL/USD" },
  TSLA: { name: "Tesla Inc.", type: "stock", pair: "TSLA/USD" },
  BTC: { name: "Bitcoin", type: "crypto", pair: "BTC/USDT" },
  ETH: { name: "Ethereum", type: "crypto", pair: "ETH/USDT" },
};

const INDICATOR_LABELS = { sma: "SMA Cross", rsi: "RSI (14)", macd: "MACD", bollinger: "Bollinger", momentum: "Momentum" };

const engine = createStrategyEngine();

function App() {
  const [stocks, setStocks] = useState({});
  const [tradeHistory, setTradeHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [chartData, setChartData] = useState({});
  const [priceHistory, setPriceHistory] = useState({});
  const [chartType, setChartType] = useState("candle"); // 'candle' or 'line'
  const [loading, setLoading] = useState(true);
  const [orderSide, setOrderSide] = useState("buy");
  const [orderAmount, setOrderAmount] = useState("");
  const [orderPrice, setOrderPrice] = useState("");
  const [portfolio, setPortfolio] = useState({ usd: 10000, AAPL: 0, TSLA: 0, BTC: 0, ETH: 0, avgCost: { AAPL: 0, TSLA: 0, BTC: 0, ETH: 0 }, realizedPnl: 0 });
  const [algoEnabled, setAlgoEnabled] = useState(false);
  const [algoPanelOpen, setAlgoPanelOpen] = useState(true);
  const [evaluations, setEvaluations] = useState({});
  const [algoLog, setAlgoLog] = useState([]);
  const [algoConfig, setAlgoConfig] = useState({ stopLossPercent: 3, takeProfitPercent: 5, positionSizePercent: 10, enabledIndicators: { sma: true, rsi: true, macd: true, bollinger: true, momentum: true } });
  // Trading mode, modals, futures & margin
  const [tradeMode, setTradeMode] = useState("spot");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [leverage, setLeverage] = useState(10);
  const [futuresPositions, setFuturesPositions] = useState([]);
  const [marginPositions, setMarginPositions] = useState([]);
  const [marginBorrowed, setMarginBorrowed] = useState(0);
  const [bottomTab, setBottomTab] = useState("trades");
  // Auth
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "" });
  const [authError, setAuthError] = useState("");
  // Add funds
  const [addFundsAmt, setAddFundsAmt] = useState("");
  const portfolioRef = useRef(portfolio);
  portfolioRef.current = portfolio;

  useEffect(() => {
    engine.updateConfig({ ...algoConfig, enabled: algoEnabled });
  }, [algoEnabled, algoConfig]);

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("marketData", (data) => {
      setStocks(data);
      setLoading(false);
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      setPriceHistory((prev) => {
        const updated = { ...prev };
        Object.entries(data).forEach(([sym, d]) => {
          if (d.price > 0) updated[sym] = [...(prev[sym] || []), d.price].slice(-120);
        });
        return updated;
      });

      setChartData((prev) => {
        const updated = { ...prev };
        Object.entries(data).forEach(([sym, d]) => {
          if (d.price > 0) {
            const arr = updated[sym] || [];
            const prevPrice = arr.length > 0 ? arr[arr.length - 1].price : d.price;
            const prices = [...(arr.map(p => p.price)), d.price];
            const sma5 = computeSMA(prices, 5);
            const sma20 = computeSMA(prices, 20);
            const bb = computeBollingerBands(prices, 20, 2);
            // Build OHLC candle from tick
            const jitter = d.price * 0.0003;
            const open = prevPrice;
            const close = d.price;
            const high = Math.max(open, close) + Math.abs(jitter);
            const low = Math.min(open, close) - Math.abs(jitter);
            updated[sym] = [...arr, { time: now, price: d.price, open, close, high, low, candleBody: [open, close], sma5, sma20, bbUpper: bb.upper, bbLower: bb.lower }].slice(-60);
          }
        });
        return updated;
      });
    });
    socket.on("connect_error", () => setConnected(false));
    socket.on("disconnect", () => setConnected(false));
    return () => { socket.off("marketData"); socket.off("connect"); socket.off("connect_error"); socket.off("disconnect"); };
  }, []);

  // Algo engine runs on price history changes
  useEffect(() => {
    if (Object.keys(priceHistory).length === 0) return;
    const currentPrices = {};
    Object.entries(stocks).forEach(([s, d]) => { currentPrices[s] = d.price; });
    const p = portfolioRef.current;
    const holdings = {};
    Object.keys(ASSETS).forEach(s => { holdings[s] = p[s] || 0; });
    const result = engine.runAll(priceHistory, currentPrices, p.usd, holdings);
    setEvaluations(result.evaluations);
    setAlgoLog(engine.getLog());

    if (result.trades.length > 0) {
      result.trades.forEach(trade => {
        setPortfolio(prev => {
          let pnl = 0;
          let newAvgCost = { ...prev.avgCost };
          if (trade.action === "BUY") {
            const totalCostBefore = prev.avgCost[trade.symbol] * prev[trade.symbol];
            const newQty = prev[trade.symbol] + trade.qty;
            newAvgCost[trade.symbol] = newQty > 0 ? (totalCostBefore + trade.total) / newQty : trade.price;
          } else {
            pnl = (trade.price - prev.avgCost[trade.symbol]) * trade.qty;
            if (prev[trade.symbol] - trade.qty <= 0.00001) newAvgCost[trade.symbol] = 0;
          }
          const t = { ...trade, pnl, avgEntry: prev.avgCost[trade.symbol], time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
          setTradeHistory(prev2 => [t, ...prev2].slice(0, 100));
          return {
            ...prev,
            usd: trade.action === "BUY" ? prev.usd - trade.total : prev.usd + trade.total,
            [trade.symbol]: trade.action === "BUY" ? prev[trade.symbol] + trade.qty : prev[trade.symbol] - trade.qty,
            avgCost: newAvgCost,
            realizedPnl: prev.realizedPnl + pnl,
          };
        });
      });
    }
  }, [priceHistory, stocks]);

  useEffect(() => {
    if (stocks[selectedAsset]) setOrderPrice(stocks[selectedAsset].price.toString());
  }, [selectedAsset, stocks]);

  const handleTrade = useCallback((symbol, action) => {
    const price = stocks[symbol]?.price;
    if (!price || price === 0) return;
    const qty = parseFloat(orderAmount) || 1;
    const cost = price * qty;
    if (action === "BUY" && cost > portfolio.usd) return;
    if (action === "SELL" && (portfolio[symbol] || 0) < qty) return;
    setPortfolio(prev => {
      let pnl = 0;
      let newAvgCost = { ...prev.avgCost };
      if (action === "BUY") {
        const totalCostBefore = (prev.avgCost[symbol] || 0) * (prev[symbol] || 0);
        const newQty = (prev[symbol] || 0) + qty;
        newAvgCost[symbol] = newQty > 0 ? (totalCostBefore + cost) / newQty : price;
        // Sync engine position tracker for risk management
        engine.setOpenPosition(symbol, { entryPrice: newAvgCost[symbol], qty: newQty, time: new Date().toISOString() });
      } else {
        pnl = (price - (prev.avgCost[symbol] || 0)) * qty;
        const remainingQty = (prev[symbol] || 0) - qty;
        if (remainingQty <= 0.00001) {
          newAvgCost[symbol] = 0;
          engine.setOpenPosition(symbol, null);
        }
      }
      const trade = { symbol, action, price, qty, total: cost, pnl, avgEntry: prev.avgCost[symbol] || 0, source: "MANUAL", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
      setTradeHistory(prev2 => [trade, ...prev2].slice(0, 100));
      return { ...prev, usd: action === "BUY" ? prev.usd - cost : prev.usd + cost, [symbol]: action === "BUY" ? (prev[symbol] || 0) + qty : (prev[symbol] || 0) - qty, avgCost: newAvgCost, realizedPnl: prev.realizedPnl + pnl };
    });
    setOrderAmount("");
  }, [stocks, orderAmount, portfolio]);

  const handleFuturesTrade = useCallback((symbol, side) => {
    const price = stocks[symbol]?.price;
    if (!price || price === 0) return;
    const margin = parseFloat(orderAmount) || 100;
    if (margin > portfolio.usd) return;
    const notional = margin * leverage;
    const qty = notional / price;
    const liqPrice = side === "LONG" ? price * (1 - 1 / leverage * 0.9) : price * (1 + 1 / leverage * 0.9);
    const pos = { id: Date.now(), symbol, side, entryPrice: price, qty, margin, leverage, notional, liqPrice, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
    setFuturesPositions(prev => [pos, ...prev]);
    setPortfolio(prev => ({ ...prev, usd: prev.usd - margin }));
    const trade = { symbol, action: side, price, qty: qty.toFixed(4), total: margin, pnl: 0, source: "FUTURES", time: pos.time };
    setTradeHistory(prev => [trade, ...prev].slice(0, 100));
    setOrderAmount("");
  }, [stocks, orderAmount, portfolio, leverage]);

  const closeFuturesPosition = useCallback((posId) => {
    setFuturesPositions(prev => {
      const pos = prev.find(p => p.id === posId);
      if (!pos) return prev;
      const curPrice = stocks[pos.symbol]?.price || pos.entryPrice;
      const pnl = pos.side === "LONG" ? (curPrice - pos.entryPrice) * pos.qty : (pos.entryPrice - curPrice) * pos.qty;
      setPortfolio(p => ({ ...p, usd: p.usd + pos.margin + pnl, realizedPnl: p.realizedPnl + pnl }));
      const trade = { symbol: pos.symbol, action: `CLOSE ${pos.side}`, price: curPrice, qty: pos.qty, total: pos.margin + pnl, pnl, source: "FUTURES", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
      setTradeHistory(prev2 => [trade, ...prev2].slice(0, 100));
      return prev.filter(p => p.id !== posId);
    });
  }, [stocks]);

  const handleMarginTrade = useCallback((symbol, action) => {
    const price = stocks[symbol]?.price;
    if (!price || price === 0) return;
    const qty = parseFloat(orderAmount) || 1;
    const cost = price * qty;
    const borrowAmt = Math.max(0, cost - portfolio.usd) * 0.8;
    if (action === "BUY") {
      const pos = { id: Date.now(), symbol, side: "BUY", entryPrice: price, qty, borrowed: borrowAmt, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
      setMarginPositions(prev => [pos, ...prev]);
      setMarginBorrowed(prev => prev + borrowAmt);
      setPortfolio(prev => ({ ...prev, usd: prev.usd - (cost - borrowAmt), [symbol]: (prev[symbol] || 0) + qty }));
    } else {
      if ((portfolio[symbol] || 0) < qty) return;
      const entryPos = marginPositions.find(p => p.symbol === symbol);
      const avgEntry = entryPos ? entryPos.entryPrice : portfolio.avgCost[symbol] || 0;
      const pnl = (price - avgEntry) * qty;
      setPortfolio(prev => ({ ...prev, usd: prev.usd + cost, [symbol]: (prev[symbol] || 0) - qty, realizedPnl: prev.realizedPnl + pnl }));
      setMarginPositions(prev => prev.filter(p => p.symbol !== symbol));
    }
    const trade = { symbol, action, price, qty, total: cost, pnl: 0, source: "MARGIN", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
    setTradeHistory(prev => [trade, ...prev].slice(0, 100));
    setOrderAmount("");
  }, [stocks, orderAmount, portfolio, marginPositions]);

  const totalValue = portfolio.usd + Object.keys(ASSETS).reduce((s, sym) => s + (portfolio[sym] || 0) * (stocks[sym]?.price || 0), 0);
  const totalUnrealized = Object.keys(ASSETS).reduce((s, sym) => s + ((portfolio[sym] || 0) > 0 && (portfolio.avgCost[sym] || 0) > 0 ? ((stocks[sym]?.price || 0) - portfolio.avgCost[sym]) * portfolio[sym] : 0), 0);
  const futuresUnrealized = futuresPositions.reduce((s, p) => { const cp = stocks[p.symbol]?.price || p.entryPrice; return s + (p.side === "LONG" ? (cp - p.entryPrice) * p.qty : (p.entryPrice - cp) * p.qty); }, 0);
  const winRate = tradeHistory.filter(t => t.action === "SELL" || t.action?.includes("CLOSE")).length > 0 ? ((tradeHistory.filter(t => (t.pnl || 0) > 0).length / Math.max(1, tradeHistory.filter(t => t.action === "SELL" || t.action?.includes("CLOSE")).length)) * 100).toFixed(0) : "—";

  const fmtPrice = (price, sym) => {
    if (!price || price === 0) return "—";
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtChange = (c) => { const n = Number(c); return (n >= 0 ? "+" : "") + n.toFixed(2) + "%"; };
  const isGreen = (c) => Number(c) >= 0;

  const currentAssetData = stocks[selectedAsset] || { price: 0, change: 0 };
  const currentChartData = chartData[selectedAsset] || [];
  const currentEval = evaluations[selectedAsset] || { decision: "HOLD", confidence: 0, weightedScore: 0, reason: "Waiting...", indicators: {} };
  const meta = ASSETS[selectedAsset];

  const getSignalClass = (sig) => { if (sig > 0.3) return "buy"; if (sig < -0.3) return "sell"; return "hold"; };
  const getSignalText = (sig) => { if (sig > 0.3) return "BUY"; if (sig < -0.3) return "SELL"; return "HOLD"; };
  const confColor = currentEval.weightedScore > 0 ? "#0ecb81" : currentEval.weightedScore < 0 ? "#f6465d" : "#5e6673";

  return (
    <>
      <nav className="top-nav" id="top-nav">
        <div className="nav-left">
          <a className="nav-logo" href="/"><img src={qfLogo} alt="QF" className="logo-img" /><span>Quantum Forge</span></a>
          <div className="nav-links">
            <button className={`nav-link ${tradeMode === "spot" ? "active" : ""}`} onClick={() => setTradeMode("spot")}>Spot</button>
            <button className={`nav-link ${tradeMode === "futures" ? "active" : ""}`} onClick={() => setTradeMode("futures")}>Futures</button>
            <button className={`nav-link ${tradeMode === "margin" ? "active" : ""}`} onClick={() => setTradeMode("margin")}>Margin</button>
          </div>
        </div>
        <div className="nav-right">
          <button className={`algo-power-btn ${algoEnabled ? "on" : "off"}`} onClick={() => setAlgoEnabled(e => !e)} id="algo-toggle-btn">
            <span className="algo-power-icon">{algoEnabled ? "⚡" : "⏻"}</span>
            <span className="algo-power-text">{algoEnabled ? "ALGO ON" : "ALGO OFF"}</span>
            <span className={`algo-power-dot ${algoEnabled ? "on" : ""}`} />
          </button>
          <div className="nav-status" id="connection-status">
            <span className={`nav-status-dot ${connected ? "live" : "offline"}`} />
            <span>{connected ? "Live" : "Offline"}</span>
          </div>
          <button className="nav-btn nav-btn-secondary" onClick={() => setShowAssetModal(true)}>💰 Assets</button>
          {user ? <button className="nav-btn nav-btn-primary" onClick={() => setShowAccountModal(true)}>👤 {user.name}</button> : <button className="nav-btn nav-btn-primary" onClick={() => setShowAccountModal(true)}>🔐 Login</button>}
        </div>
      </nav>

      <div className="ticker-bar" id="ticker-bar">
        {Object.entries(stocks).map(([symbol, data], i) => (
          <span key={symbol} style={{ display: "contents" }}>
            {i > 0 && <span className="ticker-divider" />}
            <div className="ticker-item">
              <span className="ticker-symbol">{ASSETS[symbol]?.pair || symbol}</span>
              <span className={`ticker-price ${isGreen(data.change) ? "clr-green" : "clr-red"}`}>${fmtPrice(data.price, symbol)}</span>
              <span className={`ticker-change ${isGreen(data.change) ? "bg-green" : "bg-red"}`}>{fmtChange(data.change)}</span>
            </div>
          </span>
        ))}
        {loading && <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>Connecting to market feed...</span>}
      </div>

      <div className="main-layout">
        <aside className="market-list" id="market-list">
          <div className="market-list-header">
            <div className="market-list-title">Markets</div>
            <input type="text" className="market-search" placeholder="Search pair..." readOnly />
          </div>
          <div className="market-list-cols"><span>Pair</span><span style={{ textAlign: "right" }}>Price</span><span style={{ textAlign: "right" }}>Change</span></div>
          <div className="market-list-body">
            {Object.entries(stocks).map(([symbol, data]) => (
              <div key={symbol} className={`market-row ${selectedAsset === symbol ? "active" : ""}`} onClick={() => setSelectedAsset(symbol)}>
                <div className="market-row-symbol">
                  <span className="market-row-name">{ASSETS[symbol]?.pair || symbol}</span>
                  <span className="market-row-fullname">{ASSETS[symbol]?.name || ""}</span>
                </div>
                <span className={`market-row-price ${isGreen(data.change) ? "clr-green" : "clr-red"}`}>${fmtPrice(data.price, symbol)}</span>
                <span className={`market-row-change ${isGreen(data.change) ? "bg-green" : "bg-red"}`}>{fmtChange(data.change)}</span>
              </div>
            ))}
          </div>
        </aside>

        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="chart-area" style={{ flex: 1 }}>
            <div className="chart-header">
              <div className="chart-header-left">
                <div><span className="chart-pair">{meta?.pair}<span className="chart-pair-sub"> {meta?.name}</span></span></div>
                <span className={`chart-live-price ${isGreen(currentAssetData.change) ? "clr-green" : "clr-red"}`}>${fmtPrice(currentAssetData.price, selectedAsset)}</span>
              </div>
              <div className="chart-stats">
                <div className="chart-stat"><span className="chart-stat-label">24h Change</span><span className={`chart-stat-value ${isGreen(currentAssetData.change) ? "clr-green" : "clr-red"}`}>{fmtChange(currentAssetData.change)}</span></div>
                <div className="chart-stat"><span className="chart-stat-label">Algo Signal</span><span className={`chart-stat-value ${currentEval.decision === "BUY" ? "clr-green" : currentEval.decision === "SELL" ? "clr-red" : ""}`}>{currentEval.decision}</span></div>
                <div className="chart-stat"><span className="chart-stat-label">Confidence</span><span className="chart-stat-value" style={{ color: confColor }}>{currentEval.confidence.toFixed(0)}%</span></div>
              </div>
            </div>
            <div className="chart-timeframes">
              <div className="chart-type-toggle">
                <button className={`ct-btn ${chartType === "candle" ? "active" : ""}`} onClick={() => setChartType("candle")}>🕯 Candle</button>
                <button className={`ct-btn ${chartType === "line" ? "active" : ""}`} onClick={() => setChartType("line")}>📈 Line</button>
              </div>
              <div className="tf-divider" />
              {["1m", "5m", "15m", "1H", "4H", "1D"].map(tf => <button key={tf} className={`tf-btn ${tf === "1m" ? "active" : ""}`}>{tf}</button>)}
            </div>
            <div className="chart-body">
              {currentChartData.length < 2 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: 13, flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 28, opacity: 0.3 }}>📈</span><span>Waiting for {meta?.pair} chart data...</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={currentChartData}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isGreen(currentAssetData.change) ? "#0ecb81" : "#f6465d"} stopOpacity={0.1} />
                        <stop offset="95%" stopColor={isGreen(currentAssetData.change) ? "#0ecb81" : "#f6465d"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "#5e6673", fontSize: 10 }} axisLine={{ stroke: "#2b3139" }} tickLine={false} />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: "#5e6673", fontSize: 10 }} axisLine={{ stroke: "#2b3139" }} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} width={80} />
                    <Tooltip contentStyle={{ background: "#1e2329", border: "1px solid #2b3139", borderRadius: 4, fontSize: 12 }} labelStyle={{ color: "#848e9c", fontSize: 11 }} formatter={(val, name) => { if (name === "candleBody" || name === "Candle") { return null; } if (Array.isArray(val)) return null; return [`$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, name]; }} />
                    {chartType === "candle" ? (
                      <Bar dataKey="candleBody" barSize={8} shape={(props) => {
                        const { x, y, width, height, payload } = props;
                        if (!payload?.open || !payload?.close) return null;
                        const isUp = payload.close >= payload.open;
                        const color = isUp ? "#0ecb81" : "#f6465d";
                        const bH = Math.max(Math.abs(height), 1);
                        const bY = Math.min(y, y + height);
                        return (
                          <g>
                            <line x1={x + width / 2} y1={bY - 4} x2={x + width / 2} y2={bY + bH + 4} stroke={color} strokeWidth={1} opacity={0.6} />
                            <rect x={x} y={bY} width={width} height={bH} fill={isUp ? color : color} stroke={color} strokeWidth={0.5} rx={1} opacity={0.9} />
                          </g>
                        );
                      }} name="Candle" />
                    ) : (
                      <Area type="monotone" dataKey="price" stroke={isGreen(currentAssetData.change) ? "#0ecb81" : "#f6465d"} strokeWidth={1.5} fill="url(#priceGrad)" dot={false} name="Price" />
                    )}
                    <Line type="monotone" dataKey="sma5" stroke="#f0b90b" strokeWidth={1} dot={false} name="SMA(5)" connectNulls />
                    <Line type="monotone" dataKey="sma20" stroke="#8b5cf6" strokeWidth={1} dot={false} name="SMA(20)" connectNulls />
                    <Line type="monotone" dataKey="bbUpper" stroke="rgba(248,113,113,0.4)" strokeWidth={1} dot={false} strokeDasharray="4 2" name="BB Upper" connectNulls />
                    <Line type="monotone" dataKey="bbLower" stroke="rgba(96,165,250,0.4)" strokeWidth={1} dot={false} strokeDasharray="4 2" name="BB Lower" connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bottom-panel">
            <div className="bottom-tabs">
              <button className={`bottom-tab ${bottomTab === "trades" ? "active" : ""}`} onClick={() => setBottomTab("trades")}>Trade History{tradeHistory.length > 0 && <span className="bottom-tab-badge">{tradeHistory.length}</span>}</button>
              {futuresPositions.length > 0 && <button className={`bottom-tab ${bottomTab === "positions" ? "active" : ""}`} onClick={() => setBottomTab("positions")}>Positions<span className="bottom-tab-badge">{futuresPositions.length}</span></button>}
              <button className={`bottom-tab ${bottomTab === "log" ? "active" : ""}`} onClick={() => setBottomTab("log")}>Algo Log{algoLog.length > 0 && <span className="bottom-tab-badge">{algoLog.length}</span>}</button>
            </div>
            <div className="bottom-content">
              {bottomTab === "trades" && (tradeHistory.length === 0 ? (
                <div className="trade-empty"><div className="trade-empty-icon">📋</div><div>No trades yet</div></div>
              ) : (
                <table className="trades-table"><thead><tr><th>Time</th><th>Pair</th><th>Side</th><th>Price</th><th>Qty</th><th>Total</th><th>P&L</th><th>Source</th></tr></thead>
                  <tbody>{tradeHistory.map((t, i) => (
                    <tr key={i}>
                      <td className="td-mono">{t.time}</td>
                      <td style={{ fontWeight: 600 }}>{ASSETS[t.symbol]?.pair || t.symbol}</td>
                      <td className={t.action?.includes("BUY") || t.action === "LONG" ? "clr-green" : "clr-red"} style={{ fontWeight: 600 }}>{t.action}</td>
                      <td className="td-mono">${fmtPrice(t.price, t.symbol)}</td>
                      <td className="td-mono">{typeof t.qty === "number" ? t.qty.toFixed(4) : t.qty}</td>
                      <td className="td-mono">${t.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className={`td-mono ${(t.pnl || 0) !== 0 ? ((t.pnl || 0) >= 0 ? "clr-green" : "clr-red") : ""}`} style={{ fontWeight: (t.pnl || 0) !== 0 ? 600 : 400 }}>{(t.pnl || 0) === 0 ? <span style={{ color: "var(--text-tertiary)" }}>—</span> : `${(t.pnl || 0) >= 0 ? "+$" : "-$"}${Math.abs(t.pnl || 0).toFixed(2)}`}</td>
                      <td><span className={`trade-source-badge ${t.source === "ALGO" ? "" : t.source === "FUTURES" ? "futures" : t.source === "MARGIN" ? "margin" : "manual"}`}>{t.source === "ALGO" ? "🤖 ALGO" : t.source === "FUTURES" ? "⚡ FUT" : t.source === "MARGIN" ? "📊 MGN" : "Manual"}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              ))}
              {bottomTab === "positions" && (
                <table className="trades-table"><thead><tr><th>Pair</th><th>Side</th><th>Entry</th><th>Size</th><th>Lev</th><th>Liq Price</th><th>uPnL</th><th></th></tr></thead>
                  <tbody>{futuresPositions.map(p => { const cp = stocks[p.symbol]?.price || p.entryPrice; const pnl = p.side === "LONG" ? (cp - p.entryPrice) * p.qty : (p.entryPrice - cp) * p.qty; return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{ASSETS[p.symbol]?.pair}</td>
                      <td className={p.side === "LONG" ? "clr-green" : "clr-red"} style={{ fontWeight: 600 }}>{p.side}</td>
                      <td className="td-mono">${fmtPrice(p.entryPrice)}</td>
                      <td className="td-mono">${p.notional.toFixed(0)}</td>
                      <td className="td-mono">{p.leverage}x</td>
                      <td className="td-mono" style={{ color: "var(--red)" }}>${fmtPrice(p.liqPrice)}</td>
                      <td className={`td-mono ${pnl >= 0 ? "clr-green" : "clr-red"}`} style={{ fontWeight: 600 }}>{pnl >= 0 ? "+$" : "-$"}{Math.abs(pnl).toFixed(2)}</td>
                      <td><button className="close-pos-btn" onClick={() => closeFuturesPosition(p.id)}>Close</button></td>
                    </tr>
                  ); })}</tbody>
                </table>
              )}
              {bottomTab === "log" && algoLog.length > 0 && (
                <div className="algo-log-list" style={{ padding: "8px 16px" }}>{algoLog.slice(0, 30).map((e, i) => (<div key={i} className="algo-log-entry"><span className="algo-log-time">{e.time}</span><span className={`algo-log-msg ${e.level}`}>{e.message}</span></div>))}</div>
              )}
            </div>
          </div>
        </div>

        <aside className="order-panel" id="order-panel">
          {tradeMode === "futures" && <div className="mode-badge futures-badge">⚡ FUTURES {leverage}x</div>}
          {tradeMode === "margin" && <div className="mode-badge margin-badge">📊 MARGIN 3x</div>}
          <div className="order-panel-header">
            <div className="order-tabs">
              {tradeMode === "futures" ? (<>
                <button className={`order-tab ${orderSide === "buy" ? "active" : ""}`} onClick={() => setOrderSide("buy")}>Long</button>
                <button className={`order-tab ${orderSide === "sell" ? "active" : ""}`} onClick={() => setOrderSide("sell")}>Short</button>
              </>) : (<>
                <button className={`order-tab ${orderSide === "buy" ? "active" : ""}`} onClick={() => setOrderSide("buy")}>Buy</button>
                <button className={`order-tab ${orderSide === "sell" ? "active" : ""}`} onClick={() => setOrderSide("sell")}>Sell</button>
              </>)}
            </div>
          </div>
          {tradeMode === "futures" && (
            <div className="leverage-selector">
              <span className="leverage-label">Leverage</span>
              <div className="leverage-btns">
                {[2, 5, 10, 20, 50, 125].map(l => <button key={l} className={`lev-btn ${leverage === l ? "active" : ""}`} onClick={() => setLeverage(l)}>{l}x</button>)}
              </div>
            </div>
          )}
          <div className="order-type-tabs">
            <button className="order-type-tab active">{tradeMode === "futures" ? "Market" : "Limit"}</button>
            <button className="order-type-tab">{tradeMode === "futures" ? "Limit" : "Market"}</button>
            <button className="order-type-tab">Stop-Limit</button>
          </div>
          <div className="order-form">
            <div className="order-balance"><span>Available</span><span className="order-balance-value">${portfolio.usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
            {tradeMode !== "futures" && <div className="order-input-group"><span className="order-input-label">Price</span><input type="number" className="order-input" value={orderPrice} onChange={e => setOrderPrice(e.target.value)} placeholder="0.00" /><span className="order-input-suffix">USD</span></div>}
            <div className="order-input-group"><span className="order-input-label">{tradeMode === "futures" ? "Margin" : "Amount"}</span><input type="number" className="order-input" value={orderAmount} onChange={e => setOrderAmount(e.target.value)} placeholder="0.00" /><span className="order-input-suffix">{tradeMode === "futures" ? "USD" : selectedAsset}</span></div>
            <div className="order-pct-row">
              {["25%", "50%", "75%", "100%"].map(pct => {
                const pv = parseInt(pct) / 100;
                return <button key={pct} className="order-pct-btn" onClick={() => {
                  setOrderAmount((portfolio.usd * pv).toFixed(tradeMode === "futures" ? 0 : 4));
                }}>{pct}</button>;
              })}
            </div>
            {tradeMode === "futures" && orderAmount && <div className="futures-info"><div className="fi-row"><span>Position Size</span><span className="td-mono">${(parseFloat(orderAmount || 0) * leverage).toLocaleString()}</span></div><div className="fi-row"><span>Est. Liq Price</span><span className="td-mono clr-red">${fmtPrice(orderSide === "buy" ? (currentAssetData.price * (1 - 0.9/leverage)) : (currentAssetData.price * (1 + 0.9/leverage)))}</span></div></div>}
            {tradeMode === "margin" && <div className="futures-info"><div className="fi-row"><span>Margin Ratio</span><span className="td-mono">{marginBorrowed > 0 ? ((marginBorrowed / Math.max(1, totalValue)) * 100).toFixed(1) : "0.0"}%</span></div><div className="fi-row"><span>Borrowed</span><span className="td-mono">${marginBorrowed.toFixed(2)}</span></div></div>}
            <div className="order-input-group"><span className="order-input-label">Total</span><input type="text" className="order-input" value={tradeMode === "futures" ? (parseFloat(orderAmount || 0) * leverage).toLocaleString("en-US", { minimumFractionDigits: 2 }) : (orderAmount && orderPrice ? (parseFloat(orderAmount) * parseFloat(orderPrice)).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "")} readOnly placeholder="0.00" /><span className="order-input-suffix">USD</span></div>
            {tradeMode === "spot" && (orderSide === "buy" ? <button className="order-submit-buy" onClick={() => handleTrade(selectedAsset, "BUY")}>Buy {selectedAsset}</button> : <button className="order-submit-sell" onClick={() => handleTrade(selectedAsset, "SELL")}>Sell {selectedAsset}</button>)}
            {tradeMode === "futures" && (orderSide === "buy" ? <button className="order-submit-buy" onClick={() => handleFuturesTrade(selectedAsset, "LONG")}>Open Long</button> : <button className="order-submit-sell" onClick={() => handleFuturesTrade(selectedAsset, "SHORT")}>Open Short</button>)}
            {tradeMode === "margin" && (orderSide === "buy" ? <button className="order-submit-buy" onClick={() => handleMarginTrade(selectedAsset, "BUY")}>Margin Buy</button> : <button className="order-submit-sell" onClick={() => handleMarginTrade(selectedAsset, "SELL")}>Margin Sell</button>)}
          </div>

          {/* ALGO STRATEGY PANEL */}
          <div className="algo-section" id="algo-panel">
            <div className="algo-header" onClick={() => setAlgoPanelOpen(o => !o)}>
              <div className="algo-header-left">
                <span className="algo-header-icon">🤖</span>
                <span className="algo-header-title">Algo Strategy</span>
                <span className={`algo-header-status ${algoEnabled ? "active" : "inactive"}`}>{algoEnabled ? "Active" : "Off"}</span>
              </div>
              <span className={`algo-collapse-icon ${algoPanelOpen ? "open" : ""}`}>▼</span>
            </div>

            {algoPanelOpen && (
              <div className="algo-body">
                <div className="algo-toggle-row">
                  <span className="algo-toggle-label">Auto-Execute Trades</span>
                  <label className="toggle-switch"><input type="checkbox" checked={algoEnabled} onChange={e => setAlgoEnabled(e.target.checked)} /><span className="toggle-slider" /></label>
                </div>

                <div className={`algo-decision ${currentEval.decision.toLowerCase().replace("strong ", "").replace(" ", "")}`}>
                  {currentEval.decision === "HOLD" ? "⏸ HOLD" : currentEval.decision.includes("BUY") ? `▲ ${currentEval.decision}` : `▼ ${currentEval.decision}`}
                </div>

                <div className="algo-confidence">
                  <div className="algo-confidence-label">
                    <span className="algo-confidence-text">Signal Strength</span>
                    <span className="algo-confidence-value" style={{ color: confColor }}>{currentEval.confidence.toFixed(0)}%</span>
                  </div>
                  <div className="algo-confidence-bar"><div className="algo-confidence-fill" style={{ width: `${currentEval.confidence}%`, background: confColor }} /></div>
                </div>

                <div className="algo-indicators">
                  <div className="algo-indicator-title">Indicators</div>
                  {Object.entries(INDICATOR_LABELS).map(([key, label]) => {
                    const ind = currentEval.indicators?.[key] || { signal: 0, description: "—", enabled: true };
                    return (
                      <div key={key} className={`algo-indicator-row ${!ind.enabled ? "disabled" : ""}`}>
                        <div className="algo-indicator-left">
                          <label className="toggle-switch toggle-sm">
                            <input type="checkbox" checked={algoConfig.enabledIndicators[key]} onChange={e => setAlgoConfig(c => ({ ...c, enabledIndicators: { ...c.enabledIndicators, [key]: e.target.checked } }))} />
                            <span className="toggle-slider" />
                          </label>
                          <span className="algo-indicator-name">{label}</span>
                        </div>
                        <span className={`algo-indicator-signal ${getSignalClass(ind.signal)}`}>{getSignalText(ind.signal)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="algo-risk">
                  <div className="algo-risk-title">Risk Management</div>
                  <div className="algo-risk-row"><span className="algo-risk-label">Stop-Loss</span><div style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="number" className="algo-risk-input" value={algoConfig.stopLossPercent} onChange={e => setAlgoConfig(c => ({ ...c, stopLossPercent: parseFloat(e.target.value) || 0 }))} /><span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>%</span></div></div>
                  <div className="algo-risk-row"><span className="algo-risk-label">Take-Profit</span><div style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="number" className="algo-risk-input" value={algoConfig.takeProfitPercent} onChange={e => setAlgoConfig(c => ({ ...c, takeProfitPercent: parseFloat(e.target.value) || 0 }))} /><span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>%</span></div></div>
                  <div className="algo-risk-row"><span className="algo-risk-label">Position Size</span><div style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="number" className="algo-risk-input" value={algoConfig.positionSizePercent} onChange={e => setAlgoConfig(c => ({ ...c, positionSizePercent: parseFloat(e.target.value) || 0 }))} /><span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>%</span></div></div>
                </div>
              </div>
            )}

            {algoLog.length > 0 && (
              <div className="algo-log">
                <div className="algo-log-title">Activity Log</div>
                <div className="algo-log-list">
                  {algoLog.slice(0, 20).map((e, i) => (
                    <div key={i} className="algo-log-entry"><span className="algo-log-time">{e.time}</span><span className={`algo-log-msg ${e.level}`}>{e.message}</span></div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="portfolio-section">
            <div className="portfolio-title">Portfolio</div>
            <div className="portfolio-row"><div className="portfolio-asset"><span className="portfolio-asset-dot" style={{ background: "#f0b90b" }} /><span className="portfolio-asset-name">USD</span></div><span className="portfolio-asset-value">${portfolio.usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
            {Object.entries(ASSETS).map(([sym]) => {
              const qty = portfolio[sym];
              const curPrice = stocks[sym]?.price || 0;
              const avgC = portfolio.avgCost[sym] || 0;
              const unrealized = qty > 0 && avgC > 0 ? (curPrice - avgC) * qty : 0;
              return (
                <div className="portfolio-row" key={sym}>
                  <div className="portfolio-asset"><span className="portfolio-asset-dot" style={{ background: ASSETS[sym].type === "crypto" ? "#f0b90b" : "#3b82f6" }} /><span className="portfolio-asset-name">{sym}</span></div>
                  <div style={{ textAlign: "right" }}>
                    <span className="portfolio-asset-value">{qty > 0 ? qty.toFixed(4) : "0.0000"}</span>
                    {qty > 0 && <div style={{ fontSize: 10, fontFamily: "var(--font-mono)" }} className={unrealized >= 0 ? "clr-green" : "clr-red"}>{unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)}</div>}
                  </div>
                </div>
              );
            })}
            <div className="portfolio-row" style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
              <span className="portfolio-asset-name" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Total Value</span>
              <span className="portfolio-asset-value" style={{ color: "var(--brand-yellow)" }}>${(portfolio.usd + Object.keys(ASSETS).reduce((s, sym) => s + portfolio[sym] * (stocks[sym]?.price || 0), 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="portfolio-row" style={{ paddingTop: 4 }}>
              <span className="portfolio-asset-name" style={{ fontSize: 11 }}>Realized P&L</span>
              <span className={`portfolio-asset-value ${portfolio.realizedPnl >= 0 ? "clr-green" : "clr-red"}`} style={{ fontWeight: 600 }}>{portfolio.realizedPnl >= 0 ? "+" : ""}${portfolio.realizedPnl.toFixed(2)}</span>
            </div>
            <div className="portfolio-row" style={{ paddingTop: 2 }}>
              <span className="portfolio-asset-name" style={{ fontSize: 11 }}>Unrealized P&L</span>
              <span className={`portfolio-asset-value ${Object.keys(ASSETS).reduce((s, sym) => s + (portfolio[sym] > 0 && portfolio.avgCost[sym] > 0 ? ((stocks[sym]?.price || 0) - portfolio.avgCost[sym]) * portfolio[sym] : 0), 0) >= 0 ? "clr-green" : "clr-red"}`} style={{ fontWeight: 600 }}>{(() => { const u = Object.keys(ASSETS).reduce((s, sym) => s + (portfolio[sym] > 0 && portfolio.avgCost[sym] > 0 ? ((stocks[sym]?.price || 0) - portfolio.avgCost[sym]) * portfolio[sym] : 0), 0); return `${u >= 0 ? "+" : ""}$${u.toFixed(2)}`; })()}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* ACCOUNT CENTER MODAL */}
      {showAccountModal && (
        <div className="modal-overlay" onClick={() => setShowAccountModal(false)}>
          <div className="modal-content modal-account" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{user ? "👤 Account Center" : "🔐 Welcome to Quantum Forge"}</span><button className="modal-close" onClick={() => setShowAccountModal(false)}>✕</button></div>
            <div className="modal-body">
              {!user ? (
                <div className="auth-container">
                  <div className="auth-tabs">
                    <button className={`auth-tab ${authMode === "login" ? "active" : ""}`} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Login</button>
                    <button className={`auth-tab ${authMode === "signup" ? "active" : ""}`} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Sign Up</button>
                  </div>
                  <div className="auth-form">
                    {authMode === "signup" && <div className="auth-input-group"><label>Full Name</label><input type="text" placeholder="Enter your name" value={authForm.name} onChange={e => setAuthForm(f => ({...f, name: e.target.value}))} /></div>}
                    <div className="auth-input-group"><label>Email</label><input type="email" placeholder="you@example.com" value={authForm.email} onChange={e => setAuthForm(f => ({...f, email: e.target.value}))} /></div>
                    <div className="auth-input-group"><label>Password</label><input type="password" placeholder="••••••••" value={authForm.password} onChange={e => setAuthForm(f => ({...f, password: e.target.value}))} /></div>
                    {authError && <div className="auth-error">{authError}</div>}
                    <button className="auth-submit" onClick={() => {
                      if (!authForm.email || !authForm.password) { setAuthError("Please fill all fields"); return; }
                      if (authMode === "signup" && !authForm.name) { setAuthError("Please enter your name"); return; }
                      setUser({ name: authForm.name || authForm.email.split("@")[0], email: authForm.email, uid: `QF-${Math.floor(Math.random() * 900000 + 100000)}`, joined: new Date().toLocaleDateString() });
                      setAuthError(""); setShowAccountModal(false);
                    }}>{authMode === "login" ? "Login" : "Create Account"}</button>
                    <div className="auth-footer">{authMode === "login" ? "Don't have an account? " : "Already have an account? "}<button className="auth-switch" onClick={() => setAuthMode(m => m === "login" ? "signup" : "login")}>{authMode === "login" ? "Sign Up" : "Login"}</button></div>
                  </div>
                  <div className="auth-demo-note">💡 Demo mode — Enter any email & password to simulate login</div>
                </div>
              ) : (
                <div className="account-dashboard">
                  <div className="account-profile-row">
                    <div className="account-avatar-circle">{user.name.charAt(0).toUpperCase()}</div>
                    <div className="account-profile-info">
                      <div className="account-name">{user.name}</div>
                      <div className="account-uid">{user.uid} • {user.email}</div>
                    </div>
                    <button className="logout-btn" onClick={() => { setUser(null); setShowAccountModal(false); }}>Logout</button>
                  </div>
                  <div className="account-stats-grid">
                    <div className="account-stat-card"><div className="asc-label">Total Balance</div><div className="asc-value gold">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div></div>
                    <div className="account-stat-card"><div className="asc-label">Available USD</div><div className="asc-value">${portfolio.usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div></div>
                    <div className="account-stat-card"><div className="asc-label">Realized P&L</div><div className={`asc-value ${portfolio.realizedPnl >= 0 ? "green" : "red"}`}>{portfolio.realizedPnl >= 0 ? "+$" : "-$"}{Math.abs(portfolio.realizedPnl).toFixed(2)}</div></div>
                    <div className="account-stat-card"><div className="asc-label">Unrealized P&L</div><div className={`asc-value ${totalUnrealized >= 0 ? "green" : "red"}`}>{totalUnrealized >= 0 ? "+$" : "-$"}{Math.abs(totalUnrealized).toFixed(2)}</div></div>
                    <div className="account-stat-card"><div className="asc-label">Total Trades</div><div className="asc-value">{tradeHistory.length}</div></div>
                    <div className="account-stat-card"><div className="asc-label">Win Rate</div><div className="asc-value">{winRate}{winRate !== "—" && "%"}</div></div>
                    <div className="account-stat-card"><div className="asc-label">Futures Open</div><div className="asc-value">{futuresPositions.length}</div></div>
                    <div className="account-stat-card"><div className="asc-label">Margin Borrowed</div><div className="asc-value">${marginBorrowed.toFixed(2)}</div></div>
                  </div>
                  <div className="account-section-title">Trading Activity</div>
                  <div className="account-activity">
                    <div className="aa-row"><span>Spot Trades</span><span>{tradeHistory.filter(t => t.source === "MANUAL" || t.source === "ALGO").length}</span></div>
                    <div className="aa-row"><span>Futures Trades</span><span>{tradeHistory.filter(t => t.source === "FUTURES").length}</span></div>
                    <div className="aa-row"><span>Margin Trades</span><span>{tradeHistory.filter(t => t.source === "MARGIN").length}</span></div>
                    <div className="aa-row"><span>Algo Trades</span><span>{tradeHistory.filter(t => t.source === "ALGO").length}</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ASSET CENTER MODAL */}
      {showAssetModal && (
        <div className="modal-overlay" onClick={() => setShowAssetModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">💰 Asset Center</span><button className="modal-close" onClick={() => setShowAssetModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="asset-total-bar"><span>Total Portfolio Value</span><span className="asset-total-value">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
              {/* Add / Withdraw Funds */}
              <div className="funds-section">
                <div className="funds-row">
                  <input type="number" className="funds-input" placeholder="Amount (USD)" value={addFundsAmt} onChange={e => setAddFundsAmt(e.target.value)} />
                  <button className="funds-btn deposit" onClick={() => { const a = parseFloat(addFundsAmt); if (a > 0) { setPortfolio(p => ({...p, usd: p.usd + a})); setAddFundsAmt(""); } }}>➕ Deposit</button>
                  <button className="funds-btn withdraw" onClick={() => { const a = parseFloat(addFundsAmt); if (a > 0 && a <= portfolio.usd) { setPortfolio(p => ({...p, usd: p.usd - a})); setAddFundsAmt(""); } }}>➖ Withdraw</button>
                </div>
                <div className="funds-presets">
                  {[100, 500, 1000, 5000, 10000].map(v => <button key={v} className="funds-preset-btn" onClick={() => setAddFundsAmt(v.toString())}>${v.toLocaleString()}</button>)}
                </div>
              </div>
              <div className="asset-allocation">
                <div className="alloc-bar">{Object.keys(ASSETS).map(sym => { const val = (portfolio[sym] || 0) * (stocks[sym]?.price || 0); const pct = totalValue > 0 ? (val / totalValue * 100) : 0; return pct > 0 ? <div key={sym} className="alloc-segment" style={{ width: `${pct}%`, background: ASSETS[sym].type === "crypto" ? "#f0b90b" : "#3b82f6" }} title={`${sym}: ${pct.toFixed(1)}%`} /> : null; })}<div className="alloc-segment" style={{ width: `${totalValue > 0 ? (portfolio.usd / totalValue * 100) : 100}%`, background: "#0ecb81" }} title={`USD`} /></div>
                <div className="alloc-legend"><span className="al-item"><span className="al-dot" style={{background:"#0ecb81"}} />USD</span>{Object.keys(ASSETS).map(sym => <span key={sym} className="al-item"><span className="al-dot" style={{background: ASSETS[sym].type === "crypto" ? "#f0b90b" : "#3b82f6"}} />{sym}</span>)}</div>
              </div>
              <div className="asset-detail-table">
                <table className="trades-table"><thead><tr><th>Asset</th><th>Balance</th><th>Avg Cost</th><th>Price</th><th>Value</th><th>P&L</th></tr></thead>
                  <tbody>
                    <tr><td style={{fontWeight: 600}}>💵 USD</td><td className="td-mono">${portfolio.usd.toLocaleString("en-US", {minimumFractionDigits: 2})}</td><td className="td-mono">—</td><td className="td-mono">$1.00</td><td className="td-mono">${portfolio.usd.toLocaleString("en-US", {minimumFractionDigits: 2})}</td><td className="td-mono">—</td></tr>
                    {Object.entries(ASSETS).map(([sym, info]) => { const qty = portfolio[sym] || 0; const cp = stocks[sym]?.price || 0; const avg = portfolio.avgCost[sym] || 0; const val = qty * cp; const pnl = qty > 0 && avg > 0 ? (cp - avg) * qty : 0; return (
                      <tr key={sym}><td style={{fontWeight: 600}}>{info.pair}</td><td className="td-mono">{qty > 0 ? qty.toFixed(4) : "0.0000"}</td><td className="td-mono">{avg > 0 ? `$${fmtPrice(avg)}` : "—"}</td><td className="td-mono">${fmtPrice(cp)}</td><td className="td-mono">${val.toLocaleString("en-US", {minimumFractionDigits: 2})}</td><td className={`td-mono ${pnl >= 0 ? "clr-green" : "clr-red"}`} style={{fontWeight: qty > 0 ? 600 : 400}}>{qty > 0 ? `${pnl >= 0 ? "+$" : "-$"}${Math.abs(pnl).toFixed(2)}` : "—"}</td></tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
