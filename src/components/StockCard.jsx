function StockCard({
    symbol,
    price,
    change,
  }) {
    return (
      <div className="stock-card">
        <h2>{symbol}</h2>
  
        <h1>${price}</h1>
  
        <p
          className={
            change > 0
              ? "positive"
              : "negative"
          }
        >
          {change}%
        </p>
      </div>
    );
  }
  
  export default StockCard;