import { useEffect, useState } from "react";

import { io } from "socket.io-client";

import StockCard from "./components/StockCard";
import TradingPanel from "./components/TradingPanel";
import PriceChart from "./components/PriceChart";

import "./index.css";

function App() {
  const [marketData, setMarketData] = useState({
    AAPL: 192.45,
    TSLA: 175.1,
    BTC: 80000,
    ETH: 2200,
  });

  const [portfolio, setPortfolio] = useState(() => {
    const saved =
      localStorage.getItem("portfolio");

    return saved
      ? JSON.parse(saved)
      : {
          usd: 10000,
          btc: 0,
        };
  });

  const [tradeHistory, setTradeHistory] =
    useState(() => {
      const saved =
        localStorage.getItem(
          "tradeHistory"
        );

      return saved
        ? JSON.parse(saved)
        : [];
    });

  useEffect(() => {
    const socket = io(
      algo-trading-dashboard-production.up.railway.app
    );

    socket.on("marketData", (data) => {
      setMarketData(data);
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "portfolio",
      JSON.stringify(portfolio)
    );
  }, [portfolio]);

  useEffect(() => {
    localStorage.setItem(
      "tradeHistory",
      JSON.stringify(tradeHistory)
    );
  }, [tradeHistory]);

  const buyBTC = () => {
    const amount = 0.01;

    const cost =
      marketData.BTC * amount;

    if (portfolio.usd < cost) {
      alert("Not Enough USD");
      return;
    }

    setPortfolio((prev) => ({
      usd: prev.usd - cost,
      btc: prev.btc + amount,
    }));

    setTradeHistory((prev) => [
      {
        type: "BUY",
        amount,
        price: marketData.BTC,
        time:
          new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
  };

  const sellBTC = () => {
    const amount = 0.01;

    if (portfolio.btc < amount) {
      alert("Not Enough BTC");
      return;
    }

    const received =
      marketData.BTC * amount;

    setPortfolio((prev) => ({
      usd: prev.usd + received,
      btc: prev.btc - amount,
    }));

    setTradeHistory((prev) => [
      {
        type: "SELL",
        amount,
        price: marketData.BTC,
        time:
          new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
  };

  const totalValue =
    portfolio.usd +
    portfolio.btc * marketData.BTC;

  return (
    <div className="app-container">
      <div className="header">
        <div>
          <h1>
            Algorithmic Trading Dashboard
          </h1>

          <p>
            Real-Time Market Overview
          </p>
        </div>

        <button className="connect-btn">
          Connect Broker
        </button>
      </div>

      <div className="stock-grid">
        <StockCard
          symbol="AAPL"
          price={marketData.AAPL.toFixed(2)}
          change={1.24}
        />

        <StockCard
          symbol="TSLA"
          price={marketData.TSLA.toFixed(2)}
          change={-2.11}
        />

        <StockCard
          symbol="BTC"
          price={marketData.BTC.toFixed(0)}
          change={4.82}
        />

        <StockCard
          symbol="ETH"
          price={marketData.ETH.toFixed(2)}
          change={2.01}
        />
      </div>

      <TradingPanel
        portfolio={portfolio}
        btcPrice={marketData.BTC}
        totalValue={totalValue}
        onBuy={buyBTC}
        onSell={sellBTC}
      />

      <PriceChart
        btcPrice={marketData.BTC}
      />

      <div className="history-panel">
        <h2>Trade History</h2>

        {tradeHistory.length === 0 ? (
          <p>No Trades Yet</p>
        ) : (
          tradeHistory.map(
            (trade, index) => (
              <div
                className="trade-item"
                key={index}
              >
                <span>{trade.type}</span>

                <span>
                  {trade.amount} BTC
                </span>

                <span>
                  $
                  {trade.price.toFixed(
                    2
                  )}
                </span>

                <span>{trade.time}</span>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}

export default App;