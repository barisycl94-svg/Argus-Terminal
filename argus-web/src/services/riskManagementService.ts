// ===================================
// Risk Management Service
// Dinamik Stop-Loss & Take-Profit Hesaplama
// ===================================

import { calculateATR } from './indicatorService';
import type { Candle } from '../types';

export interface RiskLevels {
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;  // Conservative TP
    takeProfit2: number;  // Standard TP
    takeProfit3: number;  // Aggressive TP
    stopLossPercent: number;
    takeProfitPercent: number;
    riskRewardRatio: number;
    atrValue: number;
    volatilityLevel: 'low' | 'medium' | 'high';
}

export interface PositionSizeResult {
    recommendedSize: number;
    maxSize: number;
    riskAmount: number;
    portfolioRiskPercent: number;
}

// Calculate dynamic stop-loss and take-profit based on ATR
export function calculateDynamicRiskLevels(
    candles: Candle[],
    entryPrice: number,
    direction: 'long' | 'short' = 'long',
    atrMultiplierSL: number = 2.0,    // SL distance in ATR multiples
    atrMultiplierTP: number = 3.0     // TP distance in ATR multiples
): RiskLevels {
    // Calculate ATR
    const atrValues = calculateATR(candles, 14);
    const currentATR = atrValues[atrValues.length - 1] || entryPrice * 0.02; // Default 2% if no ATR

    // Determine volatility level
    const avgPrice = candles.slice(-14).reduce((sum, c) => sum + c.close, 0) / 14;
    const atrPercent = (currentATR / avgPrice) * 100;

    let volatilityLevel: 'low' | 'medium' | 'high';
    if (atrPercent < 2) volatilityLevel = 'low';
    else if (atrPercent < 5) volatilityLevel = 'medium';
    else volatilityLevel = 'high';

    // Adjust multipliers based on volatility
    let adjustedSLMult = atrMultiplierSL;
    let adjustedTPMult = atrMultiplierTP;

    if (volatilityLevel === 'high') {
        adjustedSLMult *= 0.8; // Tighter SL in high volatility
        adjustedTPMult *= 1.2; // Larger TP potential
    } else if (volatilityLevel === 'low') {
        adjustedSLMult *= 1.2; // Wider SL in low volatility
        adjustedTPMult *= 0.9; // Smaller TP expectations
    }

    // Calculate levels
    let stopLoss: number;
    let takeProfit1: number;
    let takeProfit2: number;
    let takeProfit3: number;

    if (direction === 'long') {
        stopLoss = entryPrice - (currentATR * adjustedSLMult);
        takeProfit1 = entryPrice + (currentATR * adjustedTPMult * 0.5);
        takeProfit2 = entryPrice + (currentATR * adjustedTPMult);
        takeProfit3 = entryPrice + (currentATR * adjustedTPMult * 1.5);
    } else {
        stopLoss = entryPrice + (currentATR * adjustedSLMult);
        takeProfit1 = entryPrice - (currentATR * adjustedTPMult * 0.5);
        takeProfit2 = entryPrice - (currentATR * adjustedTPMult);
        takeProfit3 = entryPrice - (currentATR * adjustedTPMult * 1.5);
    }

    const stopLossPercent = Math.abs((entryPrice - stopLoss) / entryPrice) * 100;
    const takeProfitPercent = Math.abs((takeProfit2 - entryPrice) / entryPrice) * 100;
    const riskRewardRatio = takeProfitPercent / stopLossPercent;

    return {
        entryPrice,
        stopLoss,
        takeProfit1,
        takeProfit2,
        takeProfit3,
        stopLossPercent,
        takeProfitPercent,
        riskRewardRatio,
        atrValue: currentATR,
        volatilityLevel,
    };
}

// Calculate optimal position size based on risk
export function calculatePositionSize(
    portfolioValue: number,
    entryPrice: number,
    stopLoss: number,
    maxRiskPercent: number = 2  // Max 2% portfolio risk per trade
): PositionSizeResult {
    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    const riskAmount = portfolioValue * (maxRiskPercent / 100);
    const recommendedSize = riskAmount / riskPerUnit;
    const maxSize = portfolioValue * 0.1 / entryPrice; // Max 10% in single position

    return {
        recommendedSize: Math.min(recommendedSize, maxSize),
        maxSize,
        riskAmount,
        portfolioRiskPercent: maxRiskPercent,
    };
}

// Get support and resistance levels from candles
export function getSupportResistanceLevels(candles: Candle[], lookback: number = 50): {
    supports: number[];
    resistances: number[];
    pivotPoint: number;
    nearestSupport: number;
    nearestResistance: number;
} {
    const recentCandles = candles.slice(-lookback);

    // Find swing highs and lows
    const swingHighs: number[] = [];
    const swingLows: number[] = [];

    for (let i = 2; i < recentCandles.length - 2; i++) {
        const current = recentCandles[i];
        const prev1 = recentCandles[i - 1];
        const prev2 = recentCandles[i - 2];
        const next1 = recentCandles[i + 1];
        const next2 = recentCandles[i + 2];

        // Swing high
        if (current.high > prev1.high && current.high > prev2.high &&
            current.high > next1.high && current.high > next2.high) {
            swingHighs.push(current.high);
        }

        // Swing low
        if (current.low < prev1.low && current.low < prev2.low &&
            current.low < next1.low && current.low < next2.low) {
            swingLows.push(current.low);
        }
    }

    // Calculate pivot point (classic formula)
    const lastCandle = recentCandles[recentCandles.length - 1];
    const pivotPoint = (lastCandle.high + lastCandle.low + lastCandle.close) / 3;

    // Get unique levels sorted
    const supports = [...new Set(swingLows)].sort((a, b) => b - a);
    const resistances = [...new Set(swingHighs)].sort((a, b) => a - b);

    // Find nearest levels to current price
    const currentPrice = lastCandle.close;
    const nearestSupport = supports.find(s => s < currentPrice) || supports[0] || currentPrice * 0.95;
    const nearestResistance = resistances.find(r => r > currentPrice) || resistances[resistances.length - 1] || currentPrice * 1.05;

    return {
        supports: supports.slice(0, 5),
        resistances: resistances.slice(0, 5),
        pivotPoint,
        nearestSupport,
        nearestResistance,
    };
}

// Calculate trailing stop level
export function calculateTrailingStop(
    entryPrice: number,
    currentPrice: number,
    highestPrice: number,
    atr: number,
    trailingMultiplier: number = 2.5
): number {
    // Use ATR-based trailing stop
    const atrTrail = highestPrice - (atr * trailingMultiplier);

    // Also consider percentage-based trail
    const percentTrail = highestPrice * 0.95; // 5% from high

    // Use the higher (tighter) of the two
    const trailingStop = Math.max(atrTrail, percentTrail);

    // Never move stop below entry (lock in breakeven)
    if (currentPrice > entryPrice * 1.02) {
        return Math.max(trailingStop, entryPrice);
    }

    return trailingStop;
}

// Smart SL/TP calculator that uses multiple methods
export function getSmartRiskLevels(
    candles: Candle[],
    entryPrice: number,
    direction: 'long' | 'short' = 'long'
): RiskLevels & {
    method: string;
    supportResistance: ReturnType<typeof getSupportResistanceLevels>;
} {
    // Get ATR-based levels
    const atrLevels = calculateDynamicRiskLevels(candles, entryPrice, direction);

    // Get support/resistance levels
    const srLevels = getSupportResistanceLevels(candles, 100);

    // Combine methods for smarter levels
    let smartSL = atrLevels.stopLoss;
    let smartTP = atrLevels.takeProfit2;
    let method = 'ATR-Based';

    if (direction === 'long') {
        // Use nearest support as SL if it's closer than ATR-based SL
        if (srLevels.nearestSupport > atrLevels.stopLoss && srLevels.nearestSupport < entryPrice) {
            smartSL = srLevels.nearestSupport * 0.995; // Slightly below support
            method = 'Support-Based';
        }

        // Use nearest resistance as TP if reasonable
        if (srLevels.nearestResistance < atrLevels.takeProfit2 && srLevels.nearestResistance > entryPrice) {
            smartTP = srLevels.nearestResistance * 0.995; // Slightly below resistance
        }
    } else {
        // Short position logic
        if (srLevels.nearestResistance < atrLevels.stopLoss && srLevels.nearestResistance > entryPrice) {
            smartSL = srLevels.nearestResistance * 1.005;
            method = 'Resistance-Based';
        }

        if (srLevels.nearestSupport > atrLevels.takeProfit2 && srLevels.nearestSupport < entryPrice) {
            smartTP = srLevels.nearestSupport * 1.005;
        }
    }

    // Recalculate percentages with smart levels
    const stopLossPercent = Math.abs((entryPrice - smartSL) / entryPrice) * 100;
    const takeProfitPercent = Math.abs((smartTP - entryPrice) / entryPrice) * 100;

    return {
        ...atrLevels,
        stopLoss: smartSL,
        takeProfit2: smartTP,
        stopLossPercent,
        takeProfitPercent,
        riskRewardRatio: takeProfitPercent / stopLossPercent,
        method,
        supportResistance: srLevels,
    };
}
