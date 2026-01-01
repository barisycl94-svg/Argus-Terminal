// ===================================
// ARGUS TERMINAL - Indicator Service
// Technical Analysis Calculations
// ===================================

import type { Candle, IndicatorResult } from '../types';

// Simple Moving Average (SMA)
export function calculateSMA(values: number[], period: number): (number | null)[] {
    const smaValues: (number | null)[] = new Array(values.length).fill(null);
    if (values.length < period) return smaValues;

    for (let i = period - 1; i < values.length; i++) {
        const slice = values.slice(i - period + 1, i + 1);
        const sum = slice.reduce((a, b) => a + b, 0);
        smaValues[i] = sum / period;
    }
    return smaValues;
}

// Exponential Moving Average (EMA)
export function calculateEMA(values: number[], period: number): (number | null)[] {
    const emaValues: (number | null)[] = new Array(values.length).fill(null);
    if (values.length < period) return emaValues;

    const k = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emaValues[period - 1] = ema;

    for (let i = period; i < values.length; i++) {
        ema = (values[i] * k) + (ema * (1 - k));
        emaValues[i] = ema;
    }
    return emaValues;
}

// Relative Strength Index (RSI)
export function calculateRSI(values: number[], period: number = 14): (number | null)[] {
    const rsiValues: (number | null)[] = new Array(values.length).fill(null);
    if (values.length <= period) return rsiValues;

    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate initial changes
    for (let i = 1; i <= period; i++) {
        const change = values[i] - values[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? -change : 0);
    }

    let avgGain = gains.reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.reduce((a, b) => a + b, 0) / period;

    // First RSI
    if (avgLoss === 0) {
        rsiValues[period] = 100;
    } else {
        const rs = avgGain / avgLoss;
        rsiValues[period] = 100 - (100 / (1 + rs));
    }

    // Remaining values with Wilder's smoothing
    for (let i = period + 1; i < values.length; i++) {
        const change = values[i] - values[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;

        if (avgLoss === 0) {
            rsiValues[i] = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsiValues[i] = 100 - (100 / (1 + rs));
        }
    }

    return rsiValues;
}

// MACD (Moving Average Convergence Divergence)
export function calculateMACD(
    values: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): { macd: (number | null)[], signal: (number | null)[], histogram: (number | null)[] } {
    const fastEMA = calculateEMA(values, fastPeriod);
    const slowEMA = calculateEMA(values, slowPeriod);

    const macdLine: (number | null)[] = new Array(values.length).fill(null);

    for (let i = 0; i < values.length; i++) {
        if (fastEMA[i] !== null && slowEMA[i] !== null) {
            macdLine[i] = fastEMA[i]! - slowEMA[i]!;
        }
    }

    // Calculate signal line from valid MACD values
    const validMacd: number[] = [];
    let firstValidIndex = -1;
    for (let i = 0; i < macdLine.length; i++) {
        if (macdLine[i] !== null) {
            if (firstValidIndex === -1) firstValidIndex = i;
            validMacd.push(macdLine[i]!);
        }
    }

    const signalLineValid = calculateEMA(validMacd, signalPeriod);
    const signalLine: (number | null)[] = new Array(values.length).fill(null);
    const histogram: (number | null)[] = new Array(values.length).fill(null);

    for (let index = 0; index < signalLineValid.length; index++) {
        const originalIndex = firstValidIndex + index;
        signalLine[originalIndex] = signalLineValid[index];

        if (macdLine[originalIndex] !== null && signalLineValid[index] !== null) {
            histogram[originalIndex] = macdLine[originalIndex]! - signalLineValid[index]!;
        }
    }

    return { macd: macdLine, signal: signalLine, histogram };
}

// Bollinger Bands
export function calculateBollingerBands(
    values: number[],
    period: number = 20,
    stdDevMultiplier: number = 2.0
): { upper: (number | null)[], middle: (number | null)[], lower: (number | null)[] } {
    const sma = calculateSMA(values, period);
    const upper: (number | null)[] = new Array(values.length).fill(null);
    const lower: (number | null)[] = new Array(values.length).fill(null);

    for (let i = period - 1; i < values.length; i++) {
        const slice = values.slice(i - period + 1, i + 1);
        const mean = sma[i]!;
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        upper[i] = mean + (stdDev * stdDevMultiplier);
        lower[i] = mean - (stdDev * stdDevMultiplier);
    }

    return { upper, middle: sma, lower };
}

// ATR (Average True Range)
export function calculateATR(candles: Candle[], period: number = 14): (number | null)[] {
    const atrValues: (number | null)[] = new Array(candles.length).fill(null);
    if (candles.length <= period) return atrValues;

    const trValues: number[] = [];
    trValues.push(candles[0].high - candles[0].low);

    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;

        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trValues.push(tr);
    }

    // Initial ATR
    let atr = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
    atrValues[period - 1] = atr;

    // Smooth ATR
    for (let i = period; i < candles.length; i++) {
        atr = ((atr * (period - 1)) + trValues[i]) / period;
        atrValues[i] = atr;
    }

    return atrValues;
}

// Stochastic Oscillator
export function calculateStochastic(
    candles: Candle[],
    kPeriod: number = 14,
    dPeriod: number = 3
): { k: (number | null)[], d: (number | null)[] } {
    const kValues: (number | null)[] = new Array(candles.length).fill(null);
    const dValues: (number | null)[] = new Array(candles.length).fill(null);

    if (candles.length < kPeriod) return { k: kValues, d: dValues };

    for (let i = kPeriod - 1; i < candles.length; i++) {
        const slice = candles.slice(i - kPeriod + 1, i + 1);
        const lowestLow = Math.min(...slice.map(c => c.low));
        const highestHigh = Math.max(...slice.map(c => c.high));
        const close = candles[i].close;

        if (highestHigh !== lowestLow) {
            kValues[i] = ((close - lowestLow) / (highestHigh - lowestLow)) * 100;
        } else {
            kValues[i] = 50;
        }
    }

    // %D is SMA of %K
    for (let i = kPeriod + dPeriod - 2; i < candles.length; i++) {
        const kSlice = kValues.slice(i - dPeriod + 1, i + 1).filter(v => v !== null) as number[];
        if (kSlice.length === dPeriod) {
            dValues[i] = kSlice.reduce((a, b) => a + b, 0) / dPeriod;
        }
    }

    return { k: kValues, d: dValues };
}

// CCI (Commodity Channel Index)
export function calculateCCI(candles: Candle[], period: number = 20): (number | null)[] {
    const cciValues: (number | null)[] = new Array(candles.length).fill(null);
    if (candles.length < period) return cciValues;

    const typicalPrices = candles.map(c => (c.high + c.low + c.close) / 3);
    const sma = calculateSMA(typicalPrices, period);

    for (let i = period - 1; i < candles.length; i++) {
        const slice = typicalPrices.slice(i - period + 1, i + 1);
        const mean = sma[i]!;
        const meanDeviation = slice.reduce((sum, val) => sum + Math.abs(val - mean), 0) / period;

        if (meanDeviation !== 0) {
            cciValues[i] = (typicalPrices[i] - mean) / (0.015 * meanDeviation);
        }
    }

    return cciValues;
}

// ADX (Average Directional Index)
export function calculateADX(candles: Candle[], period: number = 14): (number | null)[] {
    const adxValues: (number | null)[] = new Array(candles.length).fill(null);
    if (candles.length <= period * 2) return adxValues;

    const tr: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];

    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            tr.push(candles[i].high - candles[i].low);
            plusDM.push(0);
            minusDM.push(0);
        } else {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevHigh = candles[i - 1].high;
            const prevLow = candles[i - 1].low;
            const prevClose = candles[i - 1].close;

            tr.push(Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            ));

            const upMove = high - prevHigh;
            const downMove = prevLow - low;

            plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
            minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        }
    }

    // Wilder's Smoothing
    const smooth = (values: number[]) => {
        const smoothed = new Array(values.length).fill(0);
        smoothed[period] = values.slice(0, period + 1).reduce((a, b) => a + b, 0);
        for (let i = period + 1; i < values.length; i++) {
            smoothed[i] = smoothed[i - 1] - (smoothed[i - 1] / period) + values[i];
        }
        return smoothed;
    };

    const trSmooth = smooth(tr);
    const plusDMSmooth = smooth(plusDM);
    const minusDMSmooth = smooth(minusDM);

    const dxValues: number[] = [];
    for (let i = period; i < candles.length; i++) {
        const plusDI = (plusDMSmooth[i] / trSmooth[i]) * 100;
        const minusDI = (minusDMSmooth[i] / trSmooth[i]) * 100;
        const diSum = plusDI + minusDI;
        dxValues.push(diSum !== 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0);
    }

    // ADX is smoothed DX
    for (let i = period * 2; i < candles.length; i++) {
        const dxSlice = dxValues.slice(i - period * 2, i - period);
        if (dxSlice.length > 0) {
            adxValues[i] = dxSlice.reduce((a, b) => a + b, 0) / dxSlice.length;
        }
    }

    return adxValues;
}

// Williams %R
export function calculateWilliamsR(candles: Candle[], period: number = 14): (number | null)[] {
    const wrValues: (number | null)[] = new Array(candles.length).fill(null);
    if (candles.length < period) return wrValues;

    for (let i = period - 1; i < candles.length; i++) {
        const slice = candles.slice(i - period + 1, i + 1);
        const highestHigh = Math.max(...slice.map(c => c.high));
        const lowestLow = Math.min(...slice.map(c => c.low));
        const close = candles[i].close;

        if (highestHigh !== lowestLow) {
            wrValues[i] = ((highestHigh - close) / (highestHigh - lowestLow)) * -100;
        }
    }

    return wrValues;
}

// Get all indicator results for a candle set
export function getAllIndicators(candles: Candle[]): IndicatorResult[] {
    const closes = candles.map(c => c.close);
    const lastIndex = candles.length - 1;

    const rsi = calculateRSI(closes);
    const { macd, signal: macdSignal, histogram } = calculateMACD(closes);
    const { upper: bbUpper, middle: bbMiddle, lower: bbLower } = calculateBollingerBands(closes);
    const { k: stochK, d: stochD } = calculateStochastic(candles);
    const cci = calculateCCI(candles);
    const adx = calculateADX(candles);
    const atr = calculateATR(candles);
    const williamsR = calculateWilliamsR(candles);

    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);

    return [
        { name: 'RSI (14)', value: rsi[lastIndex], signal: getRSISignal(rsi[lastIndex]) },
        { name: 'MACD', value: macd[lastIndex], signal: getMACDSignal(histogram[lastIndex]) },
        { name: 'MACD Signal', value: macdSignal[lastIndex] },
        { name: 'MACD Histogram', value: histogram[lastIndex] },
        { name: 'Bollinger Upper', value: bbUpper[lastIndex] },
        { name: 'Bollinger Middle', value: bbMiddle[lastIndex] },
        { name: 'Bollinger Lower', value: bbLower[lastIndex] },
        { name: 'Stochastic %K', value: stochK[lastIndex], signal: getStochSignal(stochK[lastIndex], stochD[lastIndex]) },
        { name: 'Stochastic %D', value: stochD[lastIndex] },
        { name: 'CCI (20)', value: cci[lastIndex], signal: getCCISignal(cci[lastIndex]) },
        { name: 'ADX (14)', value: adx[lastIndex], interpretation: getADXInterpretation(adx[lastIndex]) },
        { name: 'ATR (14)', value: atr[lastIndex] },
        { name: 'Williams %R', value: williamsR[lastIndex], signal: getWilliamsRSignal(williamsR[lastIndex]) },
        { name: 'SMA 20', value: sma20[lastIndex] },
        { name: 'SMA 50', value: sma50[lastIndex] },
        { name: 'EMA 12', value: ema12[lastIndex] },
        { name: 'EMA 26', value: ema26[lastIndex] },
    ];
}

// Signal helpers
function getRSISignal(value: number | null): 'buy' | 'sell' | 'hold' {
    if (value === null) return 'hold';
    if (value < 30) return 'buy';
    if (value > 70) return 'sell';
    return 'hold';
}

function getMACDSignal(histogram: number | null): 'buy' | 'sell' | 'hold' {
    if (histogram === null) return 'hold';
    if (histogram > 0) return 'buy';
    if (histogram < 0) return 'sell';
    return 'hold';
}

function getStochSignal(k: number | null, d: number | null): 'buy' | 'sell' | 'hold' {
    if (k === null || d === null) return 'hold';
    if (k < 20 && d < 20) return 'buy';
    if (k > 80 && d > 80) return 'sell';
    return 'hold';
}

function getCCISignal(value: number | null): 'buy' | 'sell' | 'hold' {
    if (value === null) return 'hold';
    if (value < -100) return 'buy';
    if (value > 100) return 'sell';
    return 'hold';
}

function getWilliamsRSignal(value: number | null): 'buy' | 'sell' | 'hold' {
    if (value === null) return 'hold';
    if (value < -80) return 'buy';
    if (value > -20) return 'sell';
    return 'hold';
}

function getADXInterpretation(value: number | null): string {
    if (value === null) return 'Bilinmiyor';
    if (value > 50) return 'Çok Güçlü Trend';
    if (value > 25) return 'Güçlü Trend';
    if (value > 20) return 'Zayıf Trend';
    return 'Trend Yok (Yatay)';
}
