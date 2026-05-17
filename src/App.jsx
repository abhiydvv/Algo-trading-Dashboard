import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("https://algo-backend-s75o.onrender.com", {
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
    socket.on("marketData", (data) => {
      setStocks(data);
    });

    return () => {
      socket.off("marketData");
    };
  }, []);

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>Algorithmic Trading Dashboard</h1>
          <p>Real-Time Market Overview</p>
        </div>

        <button className="connect-btn">Connect Broker</button>
      </div>

      <div className="stock-grid">
        {Object.entries(stocks).map(([symbol, stock]) => (
          <div className="stock-card" key={symbol}>
            <h2>{symbol}</h2>

            <h1>
              $
              {stock.price}
            </h1>

            <p
              style={{
                color: stock.change >= 0 ? "#00ff99" : "#ff4d4d",
              }}
            >
              {stock.change}%
            </p>
          </div>
        ))}
      </div>

      <div className="trading-panel">
        <div>
          <h2>BTC Live Trading</h2>

          <p>Total Value: $10000.00</p>
          <p>USD Balance: $9200.00</p>
          <p>BTC Holdings: 0.0100</p>

          <p>
            BTC Price: $
            {stocks.BTC.price}
          </p>
        </div>

        <div className="trade-buttons">
          <button className="buy-btn">Buy BTC</button>
          <button className="sell-btn">Sell BTC</button>
        </div>
      </div>
    </div>
  );
}

export default App;