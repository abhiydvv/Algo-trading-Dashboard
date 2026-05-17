import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("https://algo-backend-s750.onrender.com", {
  transports: ["polling"],
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
      <p>Real-Time Market Overview</p>

      <div className="cards">
        {Object.entries(stocks).map(([symbol, data]) => (
          <div className="card" key={symbol}>
            <h2>{symbol}</h2>
            <h1>${data.price}</h1>
            <p>{data.change}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;