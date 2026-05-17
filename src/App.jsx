import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("https://algo-backend-s750.onrender.com", {
  transports: ["websocket", "polling"],
});

function App() {
  const [stocks, setStocks] = useState({
    AAPL: {
      price: "Loading...",
      change: "0",
      signal: "WAIT",
    },

    TSLA: {
      price: "Loading...",
      change: "0",
      signal: "WAIT",
    },

    BTC: {
      price: "Loading...",
      change: "0",
      signal: "WAIT",
    },

    ETH: {
      price: "Loading...",
      change: "0",
      signal: "WAIT",
    },
  });

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Socket connected");
    });

    socket.on("marketData", (data) => {
      console.log("Received:", data);
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

      <p className="subtitle">Real-Time Market Overview</p>

      <div className="cards">

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

            <div className="actions">

              <button className="buy">
                BUY
              </button>

              <button className="sell">
                SELL
              </button>

            </div>

            <div
              className={
                data.signal === "BUY"
                  ? "signal-buy"
                  : "signal-sell"
              }
            >
              Signal: {data.signal}
            </div>

          </div>
        ))}

      </div>
    </div>
  );
}

export default App;