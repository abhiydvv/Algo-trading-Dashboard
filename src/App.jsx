import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("https://algo-backend-s750.onrender.com", {
  reconnection: true,
});

function App() {
  const [stocks, setStocks] = useState({
    AAPL: { price: "Loading...", change: 0 },
    TSLA: { price: "Loading...", change: 0 },
    BTC: { price: "Loading...", change: 0 },
    ETH: { price: "Loading...", change: 0 },
  });

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected:", socket.id);
    });

    socket.on("marketData", (data) => {
      console.log("DATA:", data);
      setStocks(data);
    });

    socket.on("connect_error", (err) => {
      console.log("Socket Error:", err.message);
    });

    return () => {
      socket.off("marketData");
    };
  }, []);

  return (
    <div className="app">
      <h1>Algorithmic Trading Dashboard</h1>

      <p className="subtitle">
        Real-Time Market Overview
      </p>

      <div className="stocks-grid">
        {Object.entries(stocks).map(([symbol, stock]) => (
          <div className="stock-card" key={symbol}>
            <h2>{symbol}</h2>

            <h1>${stock.price}</h1>

            <p
              style={{
                color: stock.change >= 0 ? "#00ff88" : "#ff4444",
              }}
            >
              {stock.change}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;