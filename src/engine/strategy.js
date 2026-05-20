// ============================================
// Algo Trading Strategy Engine
// Evaluates indicators, applies weighted voting,
// manages risk, and decides auto-trade actions.
// ============================================

import { computeAllIndicators } from "./indicators.js";

// Default indicator weights for voting
const DEFAULT_WEIGHTS = {
  sma: 1.0,
  rsi: 1.5,
  macd: 1.2,
  bollinger: 1.0,
  momentum: 0.8,
};

// Default config
const DEFAULT_CONFIG = {
  enabled: false,
  threshold: 1.5, // Minimum weighted score to trigger auto-trade
  stopLossPercent: 3, // 3% stop-loss
  takeProfitPercent: 5, // 5% take-profit
  positionSizePercent: 10, // Use 10% of available USD per trade
  maxOpenPositions: 4, // Max assets to hold simultaneously
  cooldownMs: 30000, // 30 seconds between auto-trades on same asset
  weights: { ...DEFAULT_WEIGHTS },
  enabledIndicators: {
    sma: true,
    rsi: true,
    macd: true,
    bollinger: true,
    momentum: true,
  },
};

/**
 * Create a new strategy engine instance
 * @param {object} configOverrides - Override default config
 * @returns {object} Engine API
 */
export function createStrategyEngine(configOverrides = {}) {
  let config = { ...DEFAULT_CONFIG, ...configOverrides };
  let lastTradeTime = {}; // { [symbol]: timestamp }
  let openPositions = {}; // { [symbol]: { entryPrice, qty, time } }
  let algoLog = []; // Array of log entries

  function log(level, message, data = {}) {
    const entry = {
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      level, // 'info', 'signal', 'trade', 'risk', 'error'
      message,
      ...data,
    };
    algoLog = [entry, ...algoLog].slice(0, 200);
    return entry;
  }

  /**
   * Evaluate all indicators for a single asset
   * @param {string} symbol
   * @param {number[]} priceHistory - Array of prices (oldest first)
   * @returns {object} Evaluation result
   */
  function evaluate(symbol, priceHistory) {
    if (!priceHistory || priceHistory.length < 5) {
      return {
        symbol,
        indicators: {},
        weightedScore: 0,
        decision: "HOLD",
        confidence: 0,
        reason: "Insufficient price history",
      };
    }

    const indicators = computeAllIndicators(priceHistory);
    let weightedScore = 0;
    let activeCount = 0;
    const details = {};

    for (const [name, result] of Object.entries(indicators)) {
      const isEnabled = config.enabledIndicators[name] !== false;
      const weight = config.weights[name] || 1.0;

      details[name] = {
        ...result,
        enabled: isEnabled,
        weight,
        contribution: isEnabled ? result.signal * weight : 0,
      };

      if (isEnabled && result.signal !== 0) {
        weightedScore += result.signal * weight;
        activeCount++;
      }
    }

    // Normalize confidence to 0-100
    const maxPossibleScore = Object.values(config.weights).reduce(
      (s, w) => s + w,
      0
    );
    const confidence = Math.min(
      100,
      Math.abs(weightedScore / maxPossibleScore) * 100
    );

    let decision = "HOLD";
    let reason = "No strong consensus";

    if (weightedScore >= config.threshold) {
      decision = "BUY";
      reason = `Strong BUY consensus (score: ${weightedScore.toFixed(2)})`;
    } else if (weightedScore <= -config.threshold) {
      decision = "SELL";
      reason = `Strong SELL consensus (score: ${weightedScore.toFixed(2)})`;
    } else if (weightedScore > 0) {
      reason = `Weak bullish signal (score: ${weightedScore.toFixed(2)}, threshold: ${config.threshold})`;
    } else if (weightedScore < 0) {
      reason = `Weak bearish signal (score: ${weightedScore.toFixed(2)}, threshold: -${config.threshold})`;
    }

    return {
      symbol,
      indicators: details,
      weightedScore,
      decision,
      confidence,
      reason,
    };
  }

  /**
   * Check risk management rules for open positions
   * @param {string} symbol
   * @param {number} currentPrice
   * @returns {{ action: string|null, reason: string }}
   */
  function checkRisk(symbol, currentPrice) {
    const position = openPositions[symbol];
    if (!position) return { action: null, reason: "No open position" };

    const pnlPercent =
      ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

    // Stop-loss
    if (pnlPercent <= -config.stopLossPercent) {
      return {
        action: "SELL",
        reason: `⛔ STOP-LOSS triggered at ${pnlPercent.toFixed(2)}% (limit: -${config.stopLossPercent}%)`,
        pnlPercent,
      };
    }

    // Take-profit
    if (pnlPercent >= config.takeProfitPercent) {
      return {
        action: "SELL",
        reason: `🎯 TAKE-PROFIT triggered at +${pnlPercent.toFixed(2)}% (target: +${config.takeProfitPercent}%)`,
        pnlPercent,
      };
    }

    return {
      action: null,
      reason: `Position open: P&L ${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}%`,
      pnlPercent,
    };
  }

  /**
   * Determine trade to execute (if any) for a given asset
   * @param {string} symbol
   * @param {number[]} priceHistory
   * @param {number} currentPrice
   * @param {number} availableUsd
   * @param {number} holdingQty
   * @returns {{ trade: object|null, evaluation: object }}
   */
  function decide(symbol, priceHistory, currentPrice, availableUsd, holdingQty) {
    const evaluation = evaluate(symbol, priceHistory);

    if (!config.enabled) {
      return { trade: null, evaluation };
    }

    // Check cooldown
    const now = Date.now();
    if (lastTradeTime[symbol] && now - lastTradeTime[symbol] < config.cooldownMs) {
      return { trade: null, evaluation };
    }

    // Check risk management first (stop-loss / take-profit)
    const risk = checkRisk(symbol, currentPrice);
    if (risk.action === "SELL" && holdingQty > 0) {
      log("risk", risk.reason, { symbol });
      lastTradeTime[symbol] = now;

      // Clear position
      delete openPositions[symbol];

      return {
        trade: {
          symbol,
          action: "SELL",
          price: currentPrice,
          qty: holdingQty,
          total: currentPrice * holdingQty,
          reason: risk.reason,
          source: "ALGO",
          type: "RISK",
        },
        evaluation,
      };
    }

    // Strategy-based decision
    if (evaluation.decision === "BUY" && availableUsd > 0) {
      // Check max positions
      const openCount = Object.keys(openPositions).length;
      if (openCount >= config.maxOpenPositions && !openPositions[symbol]) {
        log("info", `Max positions (${config.maxOpenPositions}) reached, skipping ${symbol}`);
        return { trade: null, evaluation };
      }

      const tradeUsd =
        (availableUsd * config.positionSizePercent) / 100;
      const qty = tradeUsd / currentPrice;

      if (qty > 0 && tradeUsd >= 1) {
        log("trade", `AUTO BUY ${symbol}: ${evaluation.reason}`, { symbol });
        lastTradeTime[symbol] = now;

        // Track position with weighted average entry price
        const existingPos = openPositions[symbol];
        const existingQty = existingPos?.qty || 0;
        const existingEntry = existingPos?.entryPrice || currentPrice;
        const newQty = existingQty + qty;
        const avgEntry = newQty > 0
          ? (existingEntry * existingQty + currentPrice * qty) / newQty
          : currentPrice;
        openPositions[symbol] = {
          entryPrice: avgEntry,
          qty: newQty,
          time: new Date().toISOString(),
        };

        return {
          trade: {
            symbol,
            action: "BUY",
            price: currentPrice,
            qty: parseFloat(qty.toFixed(6)),
            total: tradeUsd,
            reason: evaluation.reason,
            source: "ALGO",
            type: "SIGNAL",
          },
          evaluation,
        };
      }
    } else if (evaluation.decision === "SELL" && holdingQty > 0) {
      log("trade", `AUTO SELL ${symbol}: ${evaluation.reason}`, { symbol });
      lastTradeTime[symbol] = now;
      delete openPositions[symbol];

      return {
        trade: {
          symbol,
          action: "SELL",
          price: currentPrice,
          qty: holdingQty,
          total: currentPrice * holdingQty,
          reason: evaluation.reason,
          source: "ALGO",
          type: "SIGNAL",
        },
        evaluation,
      };
    }

    return { trade: null, evaluation };
  }

  /**
   * Run strategy across all assets
   * @param {object} priceHistories - { [symbol]: number[] }
   * @param {object} currentPrices - { [symbol]: number }
   * @param {number} availableUsd
   * @param {object} holdings - { [symbol]: number }
   * @returns {{ trades: object[], evaluations: object }}
   */
  function runAll(priceHistories, currentPrices, availableUsd, holdings) {
    const trades = [];
    const evaluations = {};
    let remainingUsd = availableUsd;

    for (const symbol of Object.keys(currentPrices)) {
      const result = decide(
        symbol,
        priceHistories[symbol] || [],
        currentPrices[symbol],
        remainingUsd,
        holdings[symbol] || 0
      );

      evaluations[symbol] = result.evaluation;

      if (result.trade) {
        trades.push(result.trade);
        if (result.trade.action === "BUY") {
          remainingUsd -= result.trade.total;
        } else {
          remainingUsd += result.trade.total;
        }
      }
    }

    return { trades, evaluations };
  }

  // Public API
  return {
    evaluate,
    decide,
    runAll,
    checkRisk,

    getConfig: () => ({ ...config }),
    updateConfig: (updates) => {
      config = { ...config, ...updates };
    },
    getLog: () => [...algoLog],
    clearLog: () => {
      algoLog = [];
    },
    getOpenPositions: () => ({ ...openPositions }),
    setOpenPosition: (symbol, position) => {
      if (position) {
        openPositions[symbol] = position;
      } else {
        delete openPositions[symbol];
      }
    },
    log,
  };
}

export { DEFAULT_CONFIG, DEFAULT_WEIGHTS };
