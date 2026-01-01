// ===================================
// Chiron - Risk Management & Learning
// Risk Yönetimi ve Öğrenme Sistemi
// ===================================

import type { Candle } from '../types';
import { calculateATR, calculateRSI } from './indicatorService';

export interface RiskMetrics {
    symbol: string;
    timestamp: Date;
    volatilityScore: number; // 0-100 (0 = low volatility, 100 = extreme)
    riskScore: number; // 0-100 (0 = safe, 100 = very risky)
    positionSizeRecommendation: number; // Recommended position size as % of portfolio
    stopLossRecommendation: number; // Recommended stop loss %
    takeProfitRecommendation: number; // Recommended take profit %
    maxLeverage: number; // Maximum safe leverage
    riskRewardRatio: number;
    warnings: string[];
    insights: string[];
}

export interface StrategyPerformance {
    strategyName: string;
    winRate: number;
    avgReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    totalTrades: number;
    lastUsed: Date;
    weight: number; // Learned weight for this strategy
}

export interface ChironState {
    symbol: string;
    strategyWeights: Record<string, number>;
    lastOptimization: Date;
    performanceHistory: StrategyPerformance[];
    learningRate: number;
}

// Calculate comprehensive risk metrics
export function calculateRiskMetrics(symbol: string, candles: Candle[]): RiskMetrics {
    if (candles.length < 30) {
        return createDefaultRiskMetrics(symbol);
    }

    const prices = candles.map(c => c.close);
    const currentPrice = prices[prices.length - 1];
    const warnings: string[] = [];
    const insights: string[] = [];

    // Calculate ATR-based volatility
    const atrValues = calculateATR(candles, 14);
    const currentATR = atrValues[atrValues.length - 1] || 0;
    const avgATR = atrValues.filter(v => v !== null).slice(-30).reduce((a, b) => a + (b || 0), 0) / 30;
    const atrPercent = (currentATR / currentPrice) * 100;

    // Historical volatility (standard deviation)
    const returns = prices.slice(-30).map((p, i, arr) => i > 0 ? (p - arr[i - 1]) / arr[i - 1] : 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const annualizedVolatility = stdDev * Math.sqrt(365) * 100;

    // Volatility score (0-100)
    let volatilityScore = Math.min(100, (annualizedVolatility / 150) * 100);

    // Maximum drawdown in recent period
    let peak = prices[0];
    let maxDrawdown = 0;
    for (const price of prices.slice(-60)) {
        if (price > peak) peak = price;
        const drawdown = (peak - price) / peak;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Risk score calculation
    let riskScore = 0;

    // Volatility contribution (40%)
    riskScore += volatilityScore * 0.4;

    // Drawdown contribution (30%)
    riskScore += (maxDrawdown * 100) * 0.3;

    // RSI extreme contribution (15%)
    const rsiValues = calculateRSI(prices, 14);
    const currentRSI = rsiValues[rsiValues.length - 1] || 50;
    if (currentRSI > 75 || currentRSI < 25) {
        riskScore += 15;
        warnings.push(`RSI aşırı bölgede: ${currentRSI.toFixed(1)}`);
    }

    // ATR expansion (15%)
    if (currentATR > avgATR * 1.5) {
        riskScore += 15;
        warnings.push('Volatilite normalin üzerinde genişlemiş');
    }

    riskScore = Math.min(100, riskScore);

    // Position size recommendation based on risk
    let positionSizeRecommendation = 10; // Default 10%
    if (riskScore < 30) positionSizeRecommendation = 20;
    else if (riskScore < 50) positionSizeRecommendation = 15;
    else if (riskScore < 70) positionSizeRecommendation = 10;
    else if (riskScore < 85) positionSizeRecommendation = 5;
    else positionSizeRecommendation = 2;

    // Stop loss and take profit based on ATR
    const stopLossRecommendation = Math.max(3, Math.min(15, atrPercent * 2));
    const takeProfitRecommendation = stopLossRecommendation * 2; // 2:1 R:R minimum
    const riskRewardRatio = takeProfitRecommendation / stopLossRecommendation;

    // Max leverage recommendation
    let maxLeverage = 1;
    if (riskScore < 30) maxLeverage = 5;
    else if (riskScore < 50) maxLeverage = 3;
    else if (riskScore < 70) maxLeverage = 2;
    else maxLeverage = 1;

    // Generate insights
    if (volatilityScore < 30) {
        insights.push('Düşük volatilite - Breakout potansiyeli');
    }
    if (maxDrawdown < 0.1) {
        insights.push('Stabil fiyat hareketi - Trend takibi uygun');
    }
    if (currentATR < avgATR * 0.7) {
        insights.push('Sıkışma fazı - Büyük hareket yakın olabilir');
    }
    if (currentRSI > 50 && currentRSI < 60) {
        insights.push('Sağlıklı momentum - Trend devam edebilir');
    }

    return {
        symbol,
        timestamp: new Date(),
        volatilityScore,
        riskScore,
        positionSizeRecommendation,
        stopLossRecommendation,
        takeProfitRecommendation,
        maxLeverage,
        riskRewardRatio,
        warnings,
        insights,
    };
}

// Calculate Value at Risk (VaR)
export function calculateVaR(
    candles: Candle[],
    confidenceLevel: number = 0.95,
    holdingPeriod: number = 1,
    portfolioValue: number = 10000
): { var: number; cvar: number; percentVaR: number } {
    if (candles.length < 30) {
        return { var: 0, cvar: 0, percentVaR: 0 };
    }

    const prices = candles.map(c => c.close);
    const returns = prices.map((p, i) => i > 0 ? (p - prices[i - 1]) / prices[i - 1] : 0).slice(1);

    // Sort returns for percentile calculation
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // VaR at confidence level
    const percentileIndex = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    const varReturn = sortedReturns[percentileIndex];

    // Scale for holding period
    const scaledVaR = varReturn * Math.sqrt(holdingPeriod);

    // Conditional VaR (Expected Shortfall)
    const tailReturns = sortedReturns.slice(0, percentileIndex + 1);
    const cvarReturn = tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length;

    return {
        var: Math.abs(scaledVaR * portfolioValue),
        cvar: Math.abs(cvarReturn * portfolioValue),
        percentVaR: Math.abs(scaledVaR * 100),
    };
}

// Optimal portfolio allocation using simplified Kelly Criterion
export function calculateKellySize(
    winRate: number, // 0-1
    avgWinReturn: number, // e.g., 0.10 for 10%
    avgLossReturn: number // e.g., 0.05 for 5%
): { kellyPercent: number; halfKelly: number; quarterKelly: number } {
    // Full Kelly: f* = (bp - q) / b
    // where b = avg win / avg loss, p = win rate, q = 1 - p

    if (winRate <= 0 || avgLossReturn <= 0) {
        return { kellyPercent: 0, halfKelly: 0, quarterKelly: 0 };
    }

    const b = avgWinReturn / avgLossReturn;
    const p = winRate;
    const q = 1 - p;

    const kelly = (b * p - q) / b;
    const kellyPercent = Math.max(0, Math.min(50, kelly * 100)); // Cap at 50%

    return {
        kellyPercent,
        halfKelly: kellyPercent / 2,
        quarterKelly: kellyPercent / 4,
    };
}

// Learning system - Update strategy weights based on performance
export function updateStrategyWeights(
    currentState: ChironState,
    recentPerformance: StrategyPerformance[]
): ChironState {
    const learningRate = currentState.learningRate || 0.1;
    const newWeights = { ...currentState.strategyWeights };

    // Calculate performance scores
    const performanceScores: Record<string, number> = {};
    for (const perf of recentPerformance) {
        // Composite score: win rate + sharpe - drawdown penalty
        const score = (perf.winRate * 0.4) +
            (Math.max(0, perf.sharpeRatio) * 20) -
            (perf.maxDrawdown * 50);
        performanceScores[perf.strategyName] = score;
    }

    // Normalize scores
    const totalScore = Object.values(performanceScores).reduce((a, b) => a + Math.max(0, b), 0);

    if (totalScore > 0) {
        for (const [strategy, score] of Object.entries(performanceScores)) {
            const targetWeight = Math.max(0, score) / totalScore;
            const currentWeight = newWeights[strategy] || 0.2;

            // Smooth update
            newWeights[strategy] = currentWeight + learningRate * (targetWeight - currentWeight);
        }
    }

    // Normalize weights to sum to 1
    const weightSum = Object.values(newWeights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(newWeights)) {
        newWeights[key] = newWeights[key] / weightSum;
    }

    return {
        ...currentState,
        strategyWeights: newWeights,
        lastOptimization: new Date(),
        performanceHistory: recentPerformance,
    };
}

// Risk-adjusted position sizing
export function calculateRiskAdjustedPosition(
    portfolioValue: number,
    riskPerTrade: number, // % of portfolio to risk (e.g., 2%)
    entryPrice: number,
    stopLossPrice: number
): { positionSize: number; quantity: number; riskAmount: number } {
    const riskAmount = portfolioValue * (riskPerTrade / 100);
    const stopLossPercent = Math.abs(entryPrice - stopLossPrice) / entryPrice;

    if (stopLossPercent === 0) {
        return { positionSize: 0, quantity: 0, riskAmount };
    }

    const positionSize = riskAmount / stopLossPercent;
    const quantity = positionSize / entryPrice;

    return {
        positionSize: Math.min(positionSize, portfolioValue * 0.25), // Max 25% in one position
        quantity,
        riskAmount,
    };
}

// Correlation analysis between assets
export function calculateCorrelation(prices1: number[], prices2: number[]): number {
    const n = Math.min(prices1.length, prices2.length);
    if (n < 10) return 0;

    const returns1 = prices1.slice(-n).map((p, i, arr) => i > 0 ? (p - arr[i - 1]) / arr[i - 1] : 0).slice(1);
    const returns2 = prices2.slice(-n).map((p, i, arr) => i > 0 ? (p - arr[i - 1]) / arr[i - 1] : 0).slice(1);

    const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
    const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;

    let cov = 0;
    let var1 = 0;
    let var2 = 0;

    for (let i = 0; i < returns1.length; i++) {
        const d1 = returns1[i] - mean1;
        const d2 = returns2[i] - mean2;
        cov += d1 * d2;
        var1 += d1 * d1;
        var2 += d2 * d2;
    }

    if (var1 === 0 || var2 === 0) return 0;

    return cov / Math.sqrt(var1 * var2);
}

function createDefaultRiskMetrics(symbol: string): RiskMetrics {
    return {
        symbol,
        timestamp: new Date(),
        volatilityScore: 50,
        riskScore: 50,
        positionSizeRecommendation: 5,
        stopLossRecommendation: 5,
        takeProfitRecommendation: 10,
        maxLeverage: 1,
        riskRewardRatio: 2,
        warnings: ['Yeterli veri yok'],
        insights: [],
    };
}
