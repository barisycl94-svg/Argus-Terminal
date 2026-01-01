// ===================================
// Backtest Engine
// Strateji Test Sistemi
// ===================================

import type { Candle, Signal } from '../types';
import { calculateRSI, calculateMACD, calculateBollingerBands, calculateSMA, calculateEMA } from './indicatorService';

export type BacktestStrategy =
    | 'rsiMeanReversion'
    | 'macdCrossover'
    | 'bollingerBreakout'
    | 'goldenCross'
    | 'trendFollowing'
    | 'argusComposite';

export interface BacktestConfig {
    strategy: BacktestStrategy;
    initialCapital: number;
    positionSize: number; // Percentage of capital per trade (0-1)
    stopLoss: number; // Percentage (0-1)
    takeProfit: number; // Percentage (0-1)
    commission: number; // Per trade (0-1)
}

export interface BacktestTrade {
    id: string;
    type: 'buy' | 'sell';
    entryDate: Date;
    exitDate?: Date;
    entryPrice: number;
    exitPrice?: number;
    quantity: number;
    pnl?: number;
    pnlPercent?: number;
    reason: string;
    exitReason?: string;
}

export interface BacktestResult {
    strategy: BacktestStrategy;
    symbol: string;
    startDate: Date;
    endDate: Date;
    initialCapital: number;
    finalCapital: number;
    totalReturn: number;
    totalReturnPercent: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    sharpeRatio: number;
    trades: BacktestTrade[];
    equityCurve: { date: Date; equity: number }[];
    signals: { date: Date; type: 'buy' | 'sell'; price: number; reason: string }[];
}

const DEFAULT_CONFIG: BacktestConfig = {
    strategy: 'rsiMeanReversion',
    initialCapital: 10000,
    positionSize: 0.2, // 20% per trade
    stopLoss: 0.05, // 5% stop loss
    takeProfit: 0.15, // 15% take profit
    commission: 0.001, // 0.1% per trade
};

export function runBacktest(
    symbol: string,
    candles: Candle[],
    config: Partial<BacktestConfig> = {}
): BacktestResult {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    if (candles.length < 50) {
        return createEmptyResult(symbol, cfg);
    }

    const prices = candles.map(c => c.close);
    let capital = cfg.initialCapital;
    let position: BacktestTrade | null = null;
    const trades: BacktestTrade[] = [];
    const equityCurve: { date: Date; equity: number }[] = [];
    const signals: { date: Date; type: 'buy' | 'sell'; price: number; reason: string }[] = [];

    // Pre-calculate indicators
    const indicators = calculateIndicators(candles, cfg.strategy);

    // Track peak for drawdown
    let peakEquity = capital;
    let maxDrawdown = 0;

    // Main backtest loop
    for (let i = 50; i < candles.length; i++) {
        const candle = candles[i];
        const price = candle.close;

        // Calculate current equity
        let currentEquity = capital;
        if (position) {
            const positionValue = position.quantity * price;
            currentEquity = capital + positionValue - (position.quantity * position.entryPrice);
        }

        equityCurve.push({ date: candle.date, equity: currentEquity });

        // Track drawdown
        if (currentEquity > peakEquity) {
            peakEquity = currentEquity;
        }
        const drawdown = (peakEquity - currentEquity) / peakEquity;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }

        // Generate signal
        const signal = generateSignal(i, candles, indicators, cfg.strategy);

        // Execute trades
        if (!position && signal === 'buy') {
            // Open position
            const positionCapital = capital * cfg.positionSize;
            const quantity = positionCapital / price;
            const commission = positionCapital * cfg.commission;
            capital -= commission;

            position = {
                id: `trade-${trades.length + 1}`,
                type: 'buy',
                entryDate: candle.date,
                entryPrice: price,
                quantity,
                reason: getSignalReason(cfg.strategy, 'buy', indicators, i),
            };

            signals.push({ date: candle.date, type: 'buy', price, reason: position.reason });
        } else if (position) {
            // Check exit conditions
            const pnlPercent = (price - position.entryPrice) / position.entryPrice;
            let exitReason: string | null = null;

            if (signal === 'sell') {
                exitReason = getSignalReason(cfg.strategy, 'sell', indicators, i);
            } else if (pnlPercent <= -cfg.stopLoss) {
                exitReason = `Stop Loss (${(pnlPercent * 100).toFixed(1)}%)`;
            } else if (pnlPercent >= cfg.takeProfit) {
                exitReason = `Take Profit (${(pnlPercent * 100).toFixed(1)}%)`;
            }

            if (exitReason) {
                // Close position
                const exitValue = position.quantity * price;
                const commission = exitValue * cfg.commission;
                const pnl = (price - position.entryPrice) * position.quantity - commission;

                capital += position.quantity * position.entryPrice + pnl;

                const completedTrade: BacktestTrade = {
                    ...position,
                    exitDate: candle.date,
                    exitPrice: price,
                    pnl,
                    pnlPercent,
                    exitReason,
                };

                trades.push(completedTrade);
                signals.push({ date: candle.date, type: 'sell', price, reason: exitReason });
                position = null;
            }
        }
    }

    // Close any remaining position
    if (position) {
        const lastPrice = candles[candles.length - 1].close;
        const pnl = (lastPrice - position.entryPrice) * position.quantity;
        const pnlPercent = (lastPrice - position.entryPrice) / position.entryPrice;

        capital += position.quantity * position.entryPrice + pnl;

        trades.push({
            ...position,
            exitDate: candles[candles.length - 1].date,
            exitPrice: lastPrice,
            pnl,
            pnlPercent,
            exitReason: 'End of Backtest',
        });
    }

    // Calculate statistics
    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.pnl || 0) <= 0);

    const avgWin = winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length
        : 0;
    const avgLoss = losingTrades.length > 0
        ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length)
        : 0;

    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));

    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Sharpe Ratio (simplified)
    const returns = equityCurve.map((e, i) => i > 0 ? (e.equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity : 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev > 0 ? (avgReturn * Math.sqrt(252)) / stdDev : 0;

    return {
        strategy: cfg.strategy,
        symbol,
        startDate: candles[50].date,
        endDate: candles[candles.length - 1].date,
        initialCapital: cfg.initialCapital,
        finalCapital: capital,
        totalReturn: capital - cfg.initialCapital,
        totalReturnPercent: ((capital - cfg.initialCapital) / cfg.initialCapital) * 100,
        maxDrawdown: maxDrawdown * cfg.initialCapital,
        maxDrawdownPercent: maxDrawdown * 100,
        winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        avgWin,
        avgLoss,
        profitFactor,
        sharpeRatio,
        trades,
        equityCurve,
        signals,
    };
}

function calculateIndicators(candles: Candle[], strategy: BacktestStrategy): any {
    const prices = candles.map(c => c.close);

    return {
        rsi: calculateRSI(prices, 14),
        macd: calculateMACD(prices),
        bollinger: calculateBollingerBands(prices),
        sma20: calculateSMA(prices, 20),
        sma50: calculateSMA(prices, 50),
        sma200: calculateSMA(prices, 200),
        ema12: calculateEMA(prices, 12),
        ema26: calculateEMA(prices, 26),
    };
}

function generateSignal(
    index: number,
    candles: Candle[],
    indicators: any,
    strategy: BacktestStrategy
): 'buy' | 'sell' | 'hold' {
    const price = candles[index].close;
    const prevPrice = candles[index - 1].close;

    switch (strategy) {
        case 'rsiMeanReversion': {
            const rsi = indicators.rsi[index];
            const prevRsi = indicators.rsi[index - 1];
            if (rsi !== null && prevRsi !== null) {
                if (rsi < 30 && prevRsi <= rsi) return 'buy'; // Oversold + turning up
                if (rsi > 70 && prevRsi >= rsi) return 'sell'; // Overbought + turning down
            }
            break;
        }

        case 'macdCrossover': {
            const macdLine = indicators.macd.macdLine[index];
            const signalLine = indicators.macd.signalLine[index];
            const prevMacd = indicators.macd.macdLine[index - 1];
            const prevSignal = indicators.macd.signalLine[index - 1];

            if (macdLine !== null && signalLine !== null && prevMacd !== null && prevSignal !== null) {
                if (prevMacd <= prevSignal && macdLine > signalLine) return 'buy'; // Bullish crossover
                if (prevMacd >= prevSignal && macdLine < signalLine) return 'sell'; // Bearish crossover
            }
            break;
        }

        case 'bollingerBreakout': {
            const upper = indicators.bollinger.upper[index];
            const lower = indicators.bollinger.lower[index];
            const middle = indicators.bollinger.middle[index];

            if (upper !== null && lower !== null) {
                if (price < lower) return 'buy'; // Price below lower band
                if (price > upper) return 'sell'; // Price above upper band
            }
            break;
        }

        case 'goldenCross': {
            const sma50 = indicators.sma50[index];
            const sma200 = indicators.sma200[index];
            const prevSma50 = indicators.sma50[index - 1];
            const prevSma200 = indicators.sma200[index - 1];

            if (sma50 !== null && sma200 !== null && prevSma50 !== null && prevSma200 !== null) {
                if (prevSma50 <= prevSma200 && sma50 > sma200) return 'buy'; // Golden cross
                if (prevSma50 >= prevSma200 && sma50 < sma200) return 'sell'; // Death cross
            }
            break;
        }

        case 'trendFollowing': {
            const sma20 = indicators.sma20[index];
            const sma50 = indicators.sma50[index];
            const rsi = indicators.rsi[index];

            if (sma20 !== null && sma50 !== null && rsi !== null) {
                if (price > sma20 && sma20 > sma50 && rsi > 50 && rsi < 70) return 'buy';
                if (price < sma20 && sma20 < sma50 && rsi < 50) return 'sell';
            }
            break;
        }

        case 'argusComposite': {
            const rsi = indicators.rsi[index];
            const macdHist = indicators.macd.histogram[index];
            const sma20 = indicators.sma20[index];
            const lower = indicators.bollinger.lower[index];
            const upper = indicators.bollinger.upper[index];

            let score = 0;

            if (rsi !== null) {
                if (rsi < 30) score += 2;
                else if (rsi < 40) score += 1;
                else if (rsi > 70) score -= 2;
                else if (rsi > 60) score -= 1;
            }

            if (macdHist !== null) {
                if (macdHist > 0) score += 1;
                else score -= 1;
            }

            if (sma20 !== null) {
                if (price > sma20) score += 1;
                else score -= 1;
            }

            if (lower !== null && price < lower) score += 2;
            if (upper !== null && price > upper) score -= 2;

            if (score >= 3) return 'buy';
            if (score <= -3) return 'sell';
            break;
        }
    }

    return 'hold';
}

function getSignalReason(
    strategy: BacktestStrategy,
    type: 'buy' | 'sell',
    indicators: any,
    index: number
): string {
    const reasons: Record<BacktestStrategy, { buy: string; sell: string }> = {
        rsiMeanReversion: {
            buy: `RSI Oversold (${indicators.rsi[index]?.toFixed(1) || '-'})`,
            sell: `RSI Overbought (${indicators.rsi[index]?.toFixed(1) || '-'})`,
        },
        macdCrossover: {
            buy: 'MACD Bullish Crossover',
            sell: 'MACD Bearish Crossover',
        },
        bollingerBreakout: {
            buy: 'Price Below Lower Band',
            sell: 'Price Above Upper Band',
        },
        goldenCross: {
            buy: 'Golden Cross (SMA50 > SMA200)',
            sell: 'Death Cross (SMA50 < SMA200)',
        },
        trendFollowing: {
            buy: 'Uptrend Confirmed',
            sell: 'Downtrend Confirmed',
        },
        argusComposite: {
            buy: 'Argus Composite Signal (Strong Buy)',
            sell: 'Argus Composite Signal (Strong Sell)',
        },
    };

    return reasons[strategy][type];
}

function createEmptyResult(symbol: string, config: BacktestConfig): BacktestResult {
    return {
        strategy: config.strategy,
        symbol,
        startDate: new Date(),
        endDate: new Date(),
        initialCapital: config.initialCapital,
        finalCapital: config.initialCapital,
        totalReturn: 0,
        totalReturnPercent: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        winRate: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        trades: [],
        equityCurve: [],
        signals: [],
    };
}

// Strategy descriptions
export const STRATEGY_INFO: Record<BacktestStrategy, { name: string; description: string }> = {
    rsiMeanReversion: {
        name: 'RSI Mean Reversion',
        description: 'RSI 30 altında alım, 70 üstünde satım. Aşırı alım/satım bölgelerinden dönüş yakalamayı hedefler.',
    },
    macdCrossover: {
        name: 'MACD Crossover',
        description: 'MACD çizgisi sinyal çizgisini yukarı kesince alım, aşağı kesince satım.',
    },
    bollingerBreakout: {
        name: 'Bollinger Band Breakout',
        description: 'Fiyat alt banda değdiğinde alım, üst banda değdiğinde satım.',
    },
    goldenCross: {
        name: 'Golden/Death Cross',
        description: 'SMA50 SMA200\'ü yukarı kesince alım (Golden Cross), aşağı kesince satım (Death Cross).',
    },
    trendFollowing: {
        name: 'Trend Following',
        description: 'Yükselen trendde alım, düşen trendde satım. SMA ve RSI kombinasyonu kullanır.',
    },
    argusComposite: {
        name: 'Argus Composite',
        description: 'Birden fazla indikatörü birleştiren kompozit strateji. RSI, MACD, Bollinger ve SMA sinyallerini ağırlıklandırır.',
    },
};
