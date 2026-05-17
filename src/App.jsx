import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("https://algo-backend-s750.onrender.com", {
  transports: ["websocket", "polling"],
});

function App() {
  const [stocks, setStocks] = useState({
    AAPL: { price: "Loading...", change: 0 },
    TSLA: { price: "Loading...", change: 0 },
    BTC: { price: "Loading...", change: 0 },
    ETH: { price: "Loading...", change: 0 },
  });

  const [tradeHistory, setTradeHistory] = useState([]);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Socket Connected");
    });

    socket.on("marketData", (data) => {
      console.log("LIVE DATA:", data);
      setStocks(data);
    });

    socket.on("disconnect", () => {
      console.log("Socket Disconnected");
    });

    socket.on("connect_error", (err) => {
      console.log("Socket Error:", err.message);
    });

    return () => {
      socket.off("marketData");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
    };
  }, []);

  const handleTrade = (symbol, action) => {
    const trade = {
      symbol,
      action,
      price: stocks[symbol].price,
      time: new Date().toLocaleTimeString(),
    };

    setTradeHistory((prev) => [trade, ...prev]);
  };

  const getSignal = (change) => {
    if (change > 1) return "BUY";
    if (change < -1) return "SELL";
    return "WAIT";
  };

  return (
    <div className="app">
      <h1>Algorithmic Trading Dashboard</h1>
      <p className="subtitle">Real-Time Market Overview</p>

      <div className="card-container">
        {Object.entries(stocks).map(([symbol, data]) => (
          <div className="card" key={symbol}>
            <h2>{symbol}</h2>

            <h1>${data.price}</h1>

            <p
              className={
                Number(data.change) >= 0 ? "positive" : "negative"
              }
            >
              {data.change}%
            </p>

            <div className="button-group">
              <button
                className="buy-btn"
                onClick={() => handleTrade(symbol, "BUY")}
              >
                BUY
              </button>

              <button
                className="sell-btn"
                onClick={() => handleTrade(symbol, "SELL")}
              >
                SELL
              </button>
            </div>

            <p className="signal">
              Signal: {getSignal(Number(data.change))}
            </p>
          </div>
        ))}
      </div>

      <div className="history-section">
        <h2>Trade History</h2>

        {tradeHistory.length === 0 ? (
          <p>No trades yet</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Symbol</th>
                <th>Action</th>
                <th>Price</th>
              </tr>
            </thead>

            <tbody>
              {tradeHistory.map((trade, index) => (
                <tr key={index}>
                  <td>{trade.time}</td>
                  <td>{trade.symbol}</td>
                  <td
                    style={{
                      color:
                        trade.action === "BUY"
                          ? "#00ff88"
                          : "#ff4d4d",
                    }}
                  >
                    {trade.action}
                  </td>
                  <td>${trade.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;