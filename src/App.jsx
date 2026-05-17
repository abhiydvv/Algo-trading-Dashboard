import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("https://algo-backend-s750.onrender.com", {
  transports: ["websocket", "polling"],
});

function App() {
  const [stocks, setStocks] = useState({});

  const [tradeHistory, setTradeHistory] = useState([]);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Socket Connected");
    });

    socket.on("marketData", (data) => {
      console.log("LIVE DATA:", data);
      setStocks(data);
    });

    socket.on("connect_error", (err) => {
      console.log("Socket Error:", err.message);
    });

    socket.on("disconnect", () => {
      console.log("Socket Disconnected");
    });

    return () => {
      socket.off("marketData");
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
    };
  }, []);

  const handleTrade = (symbol, action, price) => {
    const trade = {
      symbol,
      action,
      price,
      time: new Date().toLocaleTimeString(),
    };

    setTradeHistory((prev) => [trade, ...prev]);
  };

  const getSignal = (change) => {
    if (change > 2) return "BUY";
    if (change < -2) return "SELL";
    return "WAIT";
  };

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>Algorithmic Trading Dashboard</h1>

          <p className="subtitle">
            Real-Time Market Overview
          </p>
        </div>

        <button className="connect-btn">
          Connect Broker
        </button>
      </div>

      <div className="cards">

        {Object.entries(stocks).map(([symbol, data]) => (

          <div className="card" key={symbol}>

            <h2>{symbol}</h2>

            <h1>
              $
              {typeof data.price === "number"
                ? data.price.toFixed(2)
                : data.price}
            </h1>

            <p
              className={
                Number(data.change) >= 0
                  ? "green"
                  : "red"
              }
            >
              {Number(data.change).toFixed(2)}%
            </p>

            <div className="buttons">

              <button
                className="buy"
                onClick={() =>
                  handleTrade(
                    symbol,
                    "BUY",
                    data.price
                  )
                }
              >
                BUY
              </button>

              <button
                className="sell"
                onClick={() =>
                  handleTrade(
                    symbol,
                    "SELL",
                    data.price
                  )
                }
              >
                SELL
              </button>

            </div>

            <div className="signal">
              Signal: {getSignal(Number(data.change))}
            </div>

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

                  <td>
                    ${trade.price}
                  </td>

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