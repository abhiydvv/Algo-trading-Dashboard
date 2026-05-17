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