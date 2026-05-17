import { useEffect, useState } from "react";
import io from "socket.io-client";
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

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected");
    });

    socket.on("marketData", (data) => {
      console.log(data);
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
      <p>Real-Time Market Overview</p>

      <div className="stocks-grid">
        {Object.entries(stocks).map(([symbol, data]) => (
          <div key={symbol} className="stock-card">
            <h2>{symbol}</h2>
            <h1>${data.price}</h1>

            <p
              style={{
                color: Number(data.change) >= 0 ? "#00ff99" : "#ff4444",
              }}
            >
              {data.change}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;