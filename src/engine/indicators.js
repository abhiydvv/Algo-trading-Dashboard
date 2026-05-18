// ============================================
// Technical Analysis Indicators
// Pure functions computing indicators from
// an array of price data points.
// ============================================

/**
 * Simple Moving Average
 * @param {number[]} prices - Array of prices (oldest first)
 * @param {number} period - Number of periods
 * @returns {number|null} - SMA value or null if insufficient data
 */
export function computeSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

/**
 * Exponential Moving Average
 * @param {number[]} prices - Array of prices (oldest first)
 * @param {number} period - Number of periods
 * @returns {number|null}
 */
export function computeEMA(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = computeSMA(prices.slice(0, period), period);
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * SMA Crossover Signal
 * Compares short-period SMA vs long-period SMA.
 * @param {number[]} prices
 * @param {number} shortPeriod - Default 5
 * @param {number} longPeriod - Default 20
 * @returns {{ signal: number, shortSMA: number|null, longSMA: number|null, description: string }}
 *   signal: +1 BUY, -1 SELL, 0 HOLD
 */
export function smaCrossover(prices, shortPeriod = 5, longPeriod = 20) {
  const shortSMA = computeSMA(prices, shortPeriod);
  const longSMA = computeSMA(prices, longPeriod);

  if (shortSMA === null || longSMA === null) {
    return { signal: 0, shortSMA, longSMA, description: "Insufficient data" };
  }

  // Also check previous tick to detect actual crossover
  const prevPrices = prices.slice(0, -1);
  const prevShort = computeSMA(prevPrices, shortPeriod);
  const prevLong = computeSMA(prevPrices, longPeriod);

  let signal = 0;
  let description = "SMA lines converging";

  if (prevShort !== null && prevLong !== null) {
    // Golden cross: short crosses above long
    if (prevShort <= prevLong && shortSMA > longSMA) {
      signal = 1;
      description = `Golden Cross: SMA(${shortPeriod}) crossed above SMA(${longPeriod})`;
    }
    // Death cross: short crosses below long
    else if (prevShort >= prevLong && shortSMA < longSMA) {
      signal = -1;
      description = `Death Cross: SMA(${shortPeriod}) crossed below SMA(${longPeriod})`;
    }
    // Trending
    else if (shortSMA > longSMA) {
      signal = 0.5;
      description = `Bullish: SMA(${shortPeriod}) above SMA(${longPeriod})`;
    } else if (shortSMA < longSMA) {
      signal = -0.5;
      description = `Bearish: SMA(${shortPeriod}) below SMA(${longPeriod})`;
    }
  }

  return { signal, shortSMA, longSMA, description };
}

/**
 * Relative Strength Index (RSI)
 * @param {number[]} prices
 * @param {number} period - Default 14
 * @returns {{ signal: number, value: number|null, description: string }}
 */
export function computeRSI(prices, period = 14) {
  if (prices.length < period + 1) {
    return { signal: 0, value: null, description: "Insufficient data" };
  }

  let gains = 0;
  let losses = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Smooth with remaining data
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  let signal = 0;
  let description = `RSI at ${rsi.toFixed(1)} — Neutral`;

  if (rsi < 30) {
    signal = 1;
    description = `RSI at ${rsi.toFixed(1)} — Oversold (BUY zone)`;
  } else if (rsi < 40) {
    signal = 0.5;
    description = `RSI at ${rsi.toFixed(1)} — Approaching oversold`;
  } else if (rsi > 70) {
    signal = -1;
    description = `RSI at ${rsi.toFixed(1)} — Overbought (SELL zone)`;
  } else if (rsi > 60) {
    signal = -0.5;
    description = `RSI at ${rsi.toFixed(1)} — Approaching overbought`;
  }

  return { signal, value: rsi, description };
}

/**
 * MACD (Moving Average Convergence Divergence)
 * @param {number[]} prices
 * @param {number} fastPeriod - Default 12
 * @param {number} slowPeriod - Default 26
 * @param {number} signalPeriod - Default 9
 * @returns {{ signal: number, macdLine: number|null, signalLine: number|null, histogram: number|null, description: string }}
 */
export function computeMACD(
  prices,
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) {
  if (prices.length < slowPeriod + signalPeriod) {
    return {
      signal: 0,
      macdLine: null,
      signalLine: null,
      histogram: null,
      description: "Insufficient data",
    };
  }

  // Compute MACD line values for the signal period
  const macdValues = [];
  for (let i = slowPeriod; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    const fastEMA = computeEMA(slice, fastPeriod);
    const slowEMA = computeEMA(slice, slowPeriod);
    if (fastEMA !== null && slowEMA !== null) {
      macdValues.push(fastEMA - slowEMA);
    }
  }

  if (macdValues.length < signalPeriod) {
    return {
      signal: 0,
      macdLine: null,
      signalLine: null,
      histogram: null,
      description: "Insufficient data for signal line",
    };
  }

  const macdLine = macdValues[macdValues.length - 1];
  const signalLine = computeEMA(macdValues, signalPeriod);
  const histogram = signalLine !== null ? macdLine - signalLine : null;

  // Previous values for crossover detection
  const prevMacd = macdValues[macdValues.length - 2];
  const prevSignal = computeEMA(macdValues.slice(0, -1), signalPeriod);

  let signal = 0;
  let description = "MACD — Neutral";

  if (prevMacd !== undefined && prevSignal !== null && signalLine !== null) {
    if (prevMacd <= prevSignal && macdLine > signalLine) {
      signal = 1;
      description = "MACD bullish crossover — BUY signal";
    } else if (prevMacd >= prevSignal && macdLine < signalLine) {
      signal = -1;
      description = "MACD bearish crossover — SELL signal";
    } else if (histogram > 0) {
      signal = 0.3;
      description = `MACD bullish (histogram: ${histogram.toFixed(2)})`;
    } else if (histogram < 0) {
      signal = -0.3;
      description = `MACD bearish (histogram: ${histogram.toFixed(2)})`;
    }
  }

  return { signal, macdLine, signalLine, histogram, description };
}

/**
 * Bollinger Bands
 * @param {number[]} prices
 * @param {number} period - Default 20
 * @param {number} stdDevMultiplier - Default 2
 * @returns {{ signal: number, upper: number|null, middle: number|null, lower: number|null, bandwidth: number|null, description: string }}
 */
export function computeBollingerBands(
  prices,
  period = 20,
  stdDevMultiplier = 2
) {
  if (prices.length < period) {
    return {
      signal: 0,
      upper: null,
      middle: null,
      lower: null,
      bandwidth: null,
      description: "Insufficient data",
    };
  }

  const slice = prices.slice(-period);
  const middle = slice.reduce((s, p) => s + p, 0) / period;

  const variance =
    slice.reduce((s, p) => s + Math.pow(p - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + stdDevMultiplier * stdDev;
  const lower = middle - stdDevMultiplier * stdDev;
  const bandwidth = ((upper - lower) / middle) * 100;
  const currentPrice = prices[prices.length - 1];

  // Where is the price relative to the bands?
  const percentB = (currentPrice - lower) / (upper - lower);

  let signal = 0;
  let description = `BB — Price within bands (%B: ${(percentB * 100).toFixed(1)}%)`;

  if (currentPrice <= lower) {
    signal = 1;
    description = `Price at lower Bollinger Band — potential bounce (BUY)`;
  } else if (currentPrice >= upper) {
    signal = -1;
    description = `Price at upper Bollinger Band — potential reversal (SELL)`;
  } else if (percentB < 0.2) {
    signal = 0.5;
    description = `Price near lower band — approaching oversold`;
  } else if (percentB > 0.8) {
    signal = -0.5;
    description = `Price near upper band — approaching overbought`;
  }

  return { signal, upper, middle, lower, bandwidth, percentB, description };
}

/**
 * Momentum (Rate of Change)
 * @param {number[]} prices
 * @param {number} period - Default 10
 * @returns {{ signal: number, value: number|null, description: string }}
 */
export function computeMomentum(prices, period = 10) {
  if (prices.length < period + 1) {
    return { signal: 0, value: null, description: "Insufficient data" };
  }

  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - period];
  const momentum = ((current - past) / past) * 100;

  // Also check previous momentum for direction change
  const prevCurrent = prices[prices.length - 2];
  const prevPast = prices[prices.length - 2 - period];
  const prevMomentum =
    prevPast > 0 ? ((prevCurrent - prevPast) / prevPast) * 100 : 0;

  let signal = 0;
  let description = `Momentum: ${momentum.toFixed(2)}% — Flat`;

  if (prevMomentum <= 0 && momentum > 0) {
    signal = 1;
    description = `Momentum turned positive: ${momentum.toFixed(2)}% — BUY`;
  } else if (prevMomentum >= 0 && momentum < 0) {
    signal = -1;
    description = `Momentum turned negative: ${momentum.toFixed(2)}% — SELL`;
  } else if (momentum > 0.5) {
    signal = 0.5;
    description = `Positive momentum: +${momentum.toFixed(2)}%`;
  } else if (momentum < -0.5) {
    signal = -0.5;
    description = `Negative momentum: ${momentum.toFixed(2)}%`;
  }

  return { signal, value: momentum, description };
}

/**
 * Run all indicators on a price array
 * @param {number[]} prices
 * @param {object} config - Optional config overrides
 * @returns {object} All indicator results keyed by name
 */
export function computeAllIndicators(prices, config = {}) {
  return {
    sma: smaCrossover(
      prices,
      config.smaShort || 5,
      config.smaLong || 20
    ),
    rsi: computeRSI(prices, config.rsiPeriod || 14),
    macd: computeMACD(prices, 12, 26, 9),
    bollinger: computeBollingerBands(
      prices,
      config.bbPeriod || 20,
      config.bbStdDev || 2
    ),
    momentum: computeMomentum(prices, config.momPeriod || 10),
  };
}
