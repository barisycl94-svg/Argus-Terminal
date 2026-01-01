// ===================================
// Athena - Smart Beta & Factor Analysis
// Akıllı Faktör Analizi
// ===================================

import type { Candle } from '../types';
import { calculateRSI, calculateMACD, calculateBollingerBands, calculateATR } from './indicatorService';

export interface FactorScore {
    name: string;
    value: number;
    signal: 'bullish' | 'bearish' | 'neutral';
    weight: number;
    description: string;
}

export interface AthenaResult {
    symbol: string;
    timestamp: Date;
    overallScore: number;
    sentiment: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    factors: FactorScore[];
    riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    volatility: number;
    recommendation: string;
}

// Factor weights
const FACTOR_WEIGHTS = {
    momentum: 0.20,
    trend: 0.20,
    volatility: 0.15,
    volume: 0.15,
    meanReversion: 0.15,
    priceAction: 0.15,
};

export function analyzeWithAthena(symbol: string, candles: Candle[]): AthenaResult {
    if (candles.length < 50) {
        return createDefaultResult(symbol);
    }

    const prices = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);

    // Calculate all factors
    const factors: FactorScore[] = [];

    // 1. Momentum Factor
    const momentumFactor = calculateMomentumFactor(prices);
    factors.push(momentumFactor);

    // 2. Trend Factor
    const trendFactor = calculateTrendFactor(prices);
    factors.push(trendFactor);

    // 3. Volatility Factor
    const volatilityFactor = calculateVolatilityFactor(candles);
    factors.push(volatilityFactor);

    // 4. Volume Factor
    const volumeFactor = calculateVolumeFactor(volumes, prices);
    factors.push(volumeFactor);

    // 5. Mean Reversion Factor
    const meanReversionFactor = calculateMeanReversionFactor(prices);
    factors.push(meanReversionFactor);

    // 6. Price Action Factor
    const priceActionFactor = calculatePriceActionFactor(candles);
    factors.push(priceActionFactor);

    // Calculate overall score
    const overallScore = factors.reduce((sum, f) => sum + (f.value * f.weight), 0);

    // Determine sentiment
    let sentiment: AthenaResult['sentiment'] = 'hold';
    if (overallScore >= 70) sentiment = 'strong_buy';
    else if (overallScore >= 55) sentiment = 'buy';
    else if (overallScore <= 30) sentiment = 'strong_sell';
    else if (overallScore <= 45) sentiment = 'sell';

    // Calculate volatility percentage
    const atrValues = calculateATR(candles, 14);
    const currentATR = atrValues[atrValues.length - 1] || 0;
    const volatility = (currentATR / prices[prices.length - 1]) * 100;

    // Determine risk level
    let riskLevel: AthenaResult['riskLevel'] = 'medium';
    if (volatility < 2) riskLevel = 'low';
    else if (volatility > 5) riskLevel = 'high';
    else if (volatility > 10) riskLevel = 'extreme';

    // Generate recommendation
    const recommendation = generateRecommendation(sentiment, factors, riskLevel);

    return {
        symbol,
        timestamp: new Date(),
        overallScore,
        sentiment,
        factors,
        riskLevel,
        volatility,
        recommendation,
    };
}

function calculateMomentumFactor(prices: number[]): FactorScore {
    const rsiValues = calculateRSI(prices, 14);
    const currentRSI = rsiValues[rsiValues.length - 1] || 50;

    // ROC (Rate of Change)
    const roc10 = ((prices[prices.length - 1] - prices[prices.length - 11]) / prices[prices.length - 11]) * 100;
    const roc20 = ((prices[prices.length - 1] - prices[prices.length - 21]) / prices[prices.length - 21]) * 100;

    // Combine signals
    let score = 50;

    // RSI contribution
    if (currentRSI > 70) score -= 15;
    else if (currentRSI > 60) score += 5;
    else if (currentRSI < 30) score += 15;
    else if (currentRSI < 40) score -= 5;

    // ROC contribution
    if (roc10 > 5) score += 10;
    else if (roc10 > 2) score += 5;
    else if (roc10 < -5) score -= 10;
    else if (roc10 < -2) score -= 5;

    if (roc20 > 10) score += 10;
    else if (roc20 < -10) score -= 10;

    score = Math.max(0, Math.min(100, score));

    return {
        name: 'Momentum',
        value: score,
        signal: score > 55 ? 'bullish' : score < 45 ? 'bearish' : 'neutral',
        weight: FACTOR_WEIGHTS.momentum,
        description: `RSI: ${currentRSI.toFixed(1)}, ROC10: ${roc10.toFixed(1)}%`,
    };
}

function calculateTrendFactor(prices: number[]): FactorScore {
    // Calculate SMAs
    const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const currentPrice = prices[prices.length - 1];

    // MACD
    const macdResult = calculateMACD(prices);
    const currentMACD = macdResult.macd[macdResult.macd.length - 1] || 0;
    const currentSignal = macdResult.signal[macdResult.signal.length - 1] || 0;
    const histogram = macdResult.histogram[macdResult.histogram.length - 1] || 0;

    let score = 50;

    // Price vs SMA
    if (currentPrice > sma20 && sma20 > sma50) score += 20; // Strong uptrend
    else if (currentPrice > sma20) score += 10;
    else if (currentPrice < sma20 && sma20 < sma50) score -= 20; // Strong downtrend
    else if (currentPrice < sma20) score -= 10;

    // MACD
    if (histogram > 0 && currentMACD > currentSignal) score += 15;
    else if (histogram < 0 && currentMACD < currentSignal) score -= 15;

    score = Math.max(0, Math.min(100, score));

    const trendDirection = currentPrice > sma50 ? 'Yükseliş' : 'Düşüş';

    return {
        name: 'Trend',
        value: score,
        signal: score > 55 ? 'bullish' : score < 45 ? 'bearish' : 'neutral',
        weight: FACTOR_WEIGHTS.trend,
        description: `${trendDirection} trendi, SMA20: ${sma20.toFixed(2)}`,
    };
}

function calculateVolatilityFactor(candles: Candle[]): FactorScore {
    const atrValues = calculateATR(candles, 14);
    const currentATR = atrValues[atrValues.length - 1] || 0;
    const avgATR = atrValues.filter(v => v !== null).slice(-30).reduce((a, b) => a + (b || 0), 0) / 30;

    const prices = candles.map(c => c.close);
    const bollinger = calculateBollingerBands(prices, 20, 2);
    const upper = bollinger.upper[bollinger.upper.length - 1] || 0;
    const lower = bollinger.lower[bollinger.lower.length - 1] || 0;
    const middle = bollinger.middle[bollinger.middle.length - 1] || 0;
    const currentPrice = prices[prices.length - 1];

    // Bollinger width as volatility measure
    const bbWidth = (upper - lower) / middle * 100;

    let score = 50;

    // High volatility can be risky or opportunity
    if (currentATR > avgATR * 1.5) {
        score -= 10; // High volatility = higher risk
    } else if (currentATR < avgATR * 0.7) {
        score += 10; // Low volatility = potential breakout
    }

    // Position in Bollinger
    if (currentPrice < lower) score += 15; // Oversold
    else if (currentPrice > upper) score -= 15; // Overbought
    else if (currentPrice > middle) score += 5;
    else score -= 5;

    score = Math.max(0, Math.min(100, score));

    return {
        name: 'Volatilite',
        value: score,
        signal: score > 55 ? 'bullish' : score < 45 ? 'bearish' : 'neutral',
        weight: FACTOR_WEIGHTS.volatility,
        description: `ATR: ${currentATR.toFixed(2)}, BB Width: ${bbWidth.toFixed(1)}%`,
    };
}

function calculateVolumeFactor(volumes: number[], prices: number[]): FactorScore {
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const avgVolume = volumes.slice(-30).reduce((a, b) => a + b, 0) / 30;

    const volumeRatio = recentVolume / avgVolume;

    // Price direction with volume
    const priceChange = prices[prices.length - 1] - prices[prices.length - 6];
    const priceUp = priceChange > 0;

    let score = 50;

    if (volumeRatio > 1.5 && priceUp) score += 20; // High volume + price up = bullish
    else if (volumeRatio > 1.5 && !priceUp) score -= 15; // High volume + price down = distribution
    else if (volumeRatio < 0.5 && priceUp) score -= 5; // Low volume rally = weak
    else if (volumeRatio < 0.5 && !priceUp) score += 5; // Low volume decline = possibly ending

    score = Math.max(0, Math.min(100, score));

    return {
        name: 'Hacim',
        value: score,
        signal: score > 55 ? 'bullish' : score < 45 ? 'bearish' : 'neutral',
        weight: FACTOR_WEIGHTS.volume,
        description: `Hacim Oranı: ${volumeRatio.toFixed(2)}x ortalama`,
    };
}

function calculateMeanReversionFactor(prices: number[]): FactorScore {
    const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentPrice = prices[prices.length - 1];

    // Distance from mean
    const deviation = ((currentPrice - sma20) / sma20) * 100;

    // RSI for mean reversion signals
    const rsiValues = calculateRSI(prices, 14);
    const currentRSI = rsiValues[rsiValues.length - 1] || 50;

    let score = 50;

    // Far below mean = buy opportunity (mean reversion)
    if (deviation < -10 && currentRSI < 35) score += 25;
    else if (deviation < -5 && currentRSI < 40) score += 15;
    else if (deviation > 10 && currentRSI > 65) score -= 25;
    else if (deviation > 5 && currentRSI > 60) score -= 15;

    score = Math.max(0, Math.min(100, score));

    return {
        name: 'Mean Reversion',
        value: score,
        signal: score > 55 ? 'bullish' : score < 45 ? 'bearish' : 'neutral',
        weight: FACTOR_WEIGHTS.meanReversion,
        description: `Ortalamadan Sapma: ${deviation.toFixed(1)}%`,
    };
}

function calculatePriceActionFactor(candles: Candle[]): FactorScore {
    const recent = candles.slice(-10);

    // Higher highs and higher lows
    let higherHighs = 0;
    let higherLows = 0;
    let lowerHighs = 0;
    let lowerLows = 0;

    for (let i = 1; i < recent.length; i++) {
        if (recent[i].high > recent[i - 1].high) higherHighs++;
        else lowerHighs++;

        if (recent[i].low > recent[i - 1].low) higherLows++;
        else lowerLows++;
    }

    // Candle patterns
    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];

    const lastBullish = lastCandle.close > lastCandle.open;
    const prevBullish = prevCandle.close > prevCandle.open;

    // Body size relative to range
    const lastBodyRatio = Math.abs(lastCandle.close - lastCandle.open) / (lastCandle.high - lastCandle.low);

    let score = 50;

    // Trend structure
    if (higherHighs > 6 && higherLows > 6) score += 20; // Strong uptrend
    else if (lowerHighs > 6 && lowerLows > 6) score -= 20; // Strong downtrend
    else if (higherHighs > higherLows) score += 10;
    else if (lowerLows > lowerHighs) score -= 10;

    // Bullish/Bearish sequence
    if (lastBullish && prevBullish) score += 5;
    else if (!lastBullish && !prevBullish) score -= 5;

    // Strong candle body
    if (lastBodyRatio > 0.7 && lastBullish) score += 5;
    else if (lastBodyRatio > 0.7 && !lastBullish) score -= 5;

    score = Math.max(0, Math.min(100, score));

    return {
        name: 'Fiyat Aksiyonu',
        value: score,
        signal: score > 55 ? 'bullish' : score < 45 ? 'bearish' : 'neutral',
        weight: FACTOR_WEIGHTS.priceAction,
        description: `HH: ${higherHighs}, HL: ${higherLows}, LH: ${lowerHighs}, LL: ${lowerLows}`,
    };
}

function generateRecommendation(
    sentiment: AthenaResult['sentiment'],
    factors: FactorScore[],
    riskLevel: AthenaResult['riskLevel']
): string {
    const bullishFactors = factors.filter(f => f.signal === 'bullish').map(f => f.name);
    const bearishFactors = factors.filter(f => f.signal === 'bearish').map(f => f.name);

    let rec = '';

    switch (sentiment) {
        case 'strong_buy':
            rec = `Güçlü alım sinyali. ${bullishFactors.join(', ')} faktörleri destekliyor.`;
            break;
        case 'buy':
            rec = `Alım fırsatı. ${bullishFactors.join(', ')} olumlu görünüyor.`;
            break;
        case 'hold':
            rec = 'Bekle. Karışık sinyaller mevcut, net bir yön belirsiz.';
            break;
        case 'sell':
            rec = `Satış düşünülebilir. ${bearishFactors.join(', ')} olumsuz sinyal veriyor.`;
            break;
        case 'strong_sell':
            rec = `Güçlü satış sinyali. ${bearishFactors.join(', ')} negatif görünüyor.`;
            break;
    }

    if (riskLevel === 'high' || riskLevel === 'extreme') {
        rec += ' ⚠️ Yüksek volatilite, pozisyon boyutunu düşürün.';
    }

    return rec;
}

function createDefaultResult(symbol: string): AthenaResult {
    return {
        symbol,
        timestamp: new Date(),
        overallScore: 50,
        sentiment: 'hold',
        factors: [],
        riskLevel: 'medium',
        volatility: 0,
        recommendation: 'Yeterli veri yok.',
    };
}
