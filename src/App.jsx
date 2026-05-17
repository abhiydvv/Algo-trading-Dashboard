import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("https://algo-backend-s750.onrender.com", {
  transports: ["websocket", "polling"],
});

function App() {
  const [marketData, setMarketData] = useState({
    AAPL: { price: "Loading...", change: 0 },
    TSLA: { price: "Loading...", change: 0 },
    BTC: { price: "Loading...", change: 0 },
    ETH: { price: "Loading...", change: 0 },
  });

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to backend");
    });

    socket.on("marketData", (data) => {
      console.log("Received data:", data);
      setMarketData(data);
    });

    socket.on("connect_error", (err) => {
      console.log("Socket connection error:", err);
    });

    return () => {
      socket.off("marketData");
    };
  }, []);

  return (
    <div
      style={{
        backgroundColor: "black",
        minHeight: "100vh",
        color: "white",
        padding: "40px",
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "40px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "72px", margin: 0 }}>
            Algorithmic Trading Dashboard
          </h1>

          <p
            style={{
              color: "gray",
              fontSize: "22px",
              marginTop: "20px",
            }}
          >
            Real-Time Market Overview
          </p>
        </div>

        <button
          style={{
            backgroundColor: "#1ee65f",
            border: "none",
            color: "white",
            padding: "25px 45px",
            borderRadius: "20px",
            fontSize: "22px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Connect Broker
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "25px",
        }}
      >
        {Object.entries(marketData).map(([symbol, data]) => (
          <div
            key={symbol}
            style={{
              backgroundColor: "#001a70",
              padding: "25px",
              borderRadius: "25px",
              minHeight: "250px",
            }}
          >
            <h2 style={{ fontSize: "24px" }}>{symbol}</h2>

            <h1
              style={{
                fontSize: "72px",
                marginTop: "40px",
                marginBottom: "40px",
              }}
            >
              ${data.price}
            </h1>

            <p
              style={{
                color: data.change >= 0 ? "#00ff99" : "#ff4d4d",
                fontSize: "20px",
                fontWeight: "bold",
              }}
            >
              {data.change}%
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          backgroundColor: "#001a70",
          marginTop: "40px",
          padding: "30px",
          borderRadius: "25px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2>BTC Live Trading</h2>

          <p>Total Value: $10000.00</p>
          <p>USD Balance: $9200.00</p>
          <p>BTC Holdings: 0.0100</p>
          <p>BTC Price: ${marketData.BTC.price}</p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <button
            style={{
              backgroundColor: "#1ee65f",
              color: "white",
              border: "none",
              padding: "20px 40px",
              borderRadius: "18px",
              fontSize: "22px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Buy BTC
          </button>

          <button
            style={{
              backgroundColor: "#ff3838",
              color: "white",
              border: "none",
              padding: "20px 40px",
              borderRadius: "18px",
              fontSize: "22px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Sell BTC
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;