import { useEffect, useState } from "react";
import { io } from "socket.io-client";

function App() {
  const [marketData, setMarketData] = useState({});

  useEffect(() => {
    const socket = io(
      "https://algo-backend-s750.onrender.com"
    );

    socket.on("connect", () => {
      console.log("Connected:", socket.id);
    });

    socket.on("marketData", (data) => {
      console.log("LIVE MARKET DATA:", data);
      setMarketData(data);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div
      style={{
        backgroundColor: "#000",
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
          <h1
            style={{
              fontSize: "80px",
              margin: 0,
              fontWeight: "bold",
            }}
          >
            Algorithmic Trading Dashboard
          </h1>

          <p
            style={{
              color: "gray",
              fontSize: "20px",
              marginTop: "20px",
            }}
          >
            Real-Time Market Overview
          </p>
        </div>

        <button
          style={{
            backgroundColor: "#14e05c",
            color: "white",
            border: "none",
            padding: "25px 50px",
            borderRadius: "20px",
            fontSize: "24px",
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
          gap: "20px",
        }}
      >
        <Card
          title="AAPL"
          value={marketData?.AAPL?.price || "Loading..."}
          change={marketData?.AAPL?.change || "0%"}
        />

        <Card
          title="TSLA"
          value={marketData?.TSLA?.price || "Loading..."}
          change={marketData?.TSLA?.change || "0%"}
        />

        <Card
          title="BTC"
          value={marketData?.BTC?.price || "Loading..."}
          change={marketData?.BTC?.change || "0%"}
        />

        <Card
          title="ETH"
          value={marketData?.ETH?.price || "Loading..."}
          change={marketData?.ETH?.change || "0%"}
        />
      </div>

      <div
        style={{
          backgroundColor: "#001a66",
          marginTop: "40px",
          padding: "30px",
          borderRadius: "25px",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2>BTC Live Trading</h2>

          <p>Total Value: $10000.00</p>
          <p>USD Balance: $9200.00</p>
          <p>BTC Holdings: 0.0100</p>

          <p>
            BTC Price: $
            {marketData?.BTC?.price || "Loading..."}
          </p>
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
              backgroundColor: "#14e05c",
              color: "white",
              border: "none",
              padding: "20px 40px",
              borderRadius: "15px",
              fontSize: "20px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Buy BTC
          </button>

          <button
            style={{
              backgroundColor: "#ff3636",
              color: "white",
              border: "none",
              padding: "20px 40px",
              borderRadius: "15px",
              fontSize: "20px",
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

function Card({ title, value, change }) {
  return (
    <div
      style={{
        backgroundColor: "#001a66",
        padding: "30px",
        borderRadius: "25px",
      }}
    >
      <h2>{title}</h2>

      <h1
        style={{
          fontSize: "70px",
          marginTop: "40px",
        }}
      >
        $
        {typeof value === "number"
          ? value.toLocaleString()
          : value}
      </h1>

      <p
        style={{
          color:
            change.toString().includes("-")
              ? "#ff5b5b"
              : "#14e05c",
          fontWeight: "bold",
          fontSize: "28px",
        }}
      >
        {change}
      </p>
    </div>
  );
}

export default App;