function TradingPanel({
    portfolio,
    btcPrice,
    totalValue,
    onBuy,
    onSell,
  }) {
    return (
      <div className="trading-panel">
        <div>
          <h2>BTC Live Trading</h2>
  
          <p>
            Total Value: $
            {totalValue.toFixed(2)}
          </p>
  
          <p>
            USD Balance: $
            {portfolio.usd.toFixed(2)}
          </p>
  
          <p>
            BTC Holdings:
            {portfolio.btc.toFixed(4)}
          </p>
  
          <p>
            BTC Price: $
            {btcPrice.toFixed(2)}
          </p>
        </div>
  
        <div className="trade-buttons">
          <button
            className="buy-btn"
            onClick={onBuy}
          >
            Buy BTC
          </button>
  
          <button
            className="sell-btn"
            onClick={onSell}
          >
            Sell BTC
          </button>
        </div>
      </div>
    );
  }
  
  export default TradingPanel;