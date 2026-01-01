// ===================================
// ARGUS TERMINAL - Council of Gods Logic
// personality-based modular analysis
// ===================================

import type { Candle, CompositeScore, Signal, SignalAction, MarketRegime, ModuleVote, CouncilDecision } from '../types';
import {
    calculateRSI,
    calculateMACD,
    calculateBollingerBands,
    calculateStochastic,
    calculateCCI,
    calculateADX,
    calculateSMA,
    calculateATR,
} from './indicatorService';

/**
 * ORION - The Hunter (Trend & Divergence)
 * Focuses on MACD momentum and ADX trend strength.
 */
function getOrionVote(candles: Candle[]): ModuleVote {
    const closes = candles.map(c => c.close);
    const last = closes.length - 1;
    const { histogram, macd, signal } = calculateMACD(closes);
    const adx = calculateADX(candles);

    const currH = histogram[last] || 0;
    const prevH = histogram[last - 1] || 0;
    const adxVal = adx[last] || 0;
    const currMACD = macd[last] || 0;
    const currSignal = signal[last] || 0;

    const momentum = currH - prevH;
    let score = (currH * 8) + (momentum * 15);

    // Trend alignment bonus
    if (currMACD > currSignal && momentum > 0) score += 20;
    if (currMACD < currSignal && momentum < 0) score -= 20;

    score = Math.max(-100, Math.min(100, score));

    let reason = "Momentum stabil";
    if (score > 60) reason = "Süper-akışkan momentum artışı tespit edildi";
    else if (score > 20) reason = "Pozitif momentum dalgası oluşuyor";
    else if (score < -60) reason = "Momentum çöküşü, hacimli satış baskısı";
    else if (score < -20) reason = "Negatif ivme hızlanıyor";

    return {
        module: 'Orion',
        score,
        direction: score > 15 ? 'buy' : score < -15 ? 'sell' : 'hold',
        confidence: Math.min(100, (adxVal * 2.5) + 20),
        reason
    };
}

/**
 * ATLAS - The Titan (Market Structure)
 * Focuses on long-term trend and SMA crossovers.
 */
function getAtlasVote(candles: Candle[]): ModuleVote {
    const closes = candles.map(c => c.close);
    const last = closes.length - 1;
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const sma200 = calculateSMA(closes, 200);

    const s20 = sma20[last] || 0;
    const s50 = sma50[last] || 0;
    const s200 = sma200[last] || 0;
    const price = closes[last];

    let score = 0;
    let reason = "Piyasa dengede";

    if (price > s50 && s50 > s200) {
        score = 70;
        reason = "Makro trend boğa piyasasını işaret ediyor";
    } else if (price < s50 && s50 < s200) {
        score = -70;
        reason = "Makro trend ayı piyasası derinleşiyor";
    } else if (price > s20 && s20 > s50) {
        score = 40;
        reason = "Kısa vadeli trend yükseliş modunda";
    } else if (price < s20 && s20 < s50) {
        score = -40;
        reason = "Kısa vadeli trend düşüş baskısı altında";
    }

    // Distance from SMA200 influence
    if (s200 > 0) {
        const dist = (price - s200) / s200;
        if (dist > 0.2) {
            score -= 15; // Mean reversion warning
            reason += " (Aşırı genişleme)";
        } else if (dist < -0.2) {
            score += 15;
            reason += " (Aşırı satım bölgesi)";
        }
    }

    return {
        module: 'Atlas',
        score: Math.max(-100, Math.min(100, score)),
        direction: score > 20 ? 'buy' : score < -20 ? 'sell' : 'hold',
        confidence: 85,
        reason
    };
}

/**
 * AETHER - The Sky (Volatility & Atmosphere)
 * Focuses on Bollinger Bands and volatility.
 */
function getAetherVote(candles: Candle[]): ModuleVote {
    const closes = candles.map(c => c.close);
    const last = closes.length - 1;
    const { upper, lower, middle } = calculateBollingerBands(closes);

    const u = upper[last] || 0;
    const l = lower[last] || 0;
    const mid = middle[last] || 0;
    const p = closes[last];

    // Position within bands
    const bandWidth = u - l;
    const score = ((mid - p) / (u - mid)) * 80;

    let reason = "Volatilite normal";
    if (p <= l) reason = "Fiyat alt bantta, tepki alımı beklenebilir";
    else if (p >= u) reason = "Fiyat üst bantta, kar satışı sinyali";
    else if (p > mid) reason = "Bant içi pozitif akış devam ediyor";
    else reason = "Bant içi negatif baskı hakim";

    return {
        module: 'Aether',
        score: Math.max(-100, Math.min(100, score)),
        direction: score > 20 ? 'buy' : score < -20 ? 'sell' : 'hold',
        confidence: 75,
        reason
    };
}

/**
 * HERMES - The Messenger (Speed & Momentum)
 * Fast reactive logic based on RSI and Stochastics.
 */
function getHermesVote(candles: Candle[]): ModuleVote {
    const closes = candles.map(c => c.close);
    const last = closes.length - 1;
    const rsi = calculateRSI(closes, 14)[last] || 50;
    const { k, d } = calculateStochastic(candles);
    const sk = k[last] || 50;
    const sd = d[last] || 50;

    let score = (50 - rsi) * 2;

    // Overbought/Oversold adjustments
    if (rsi < 30 && sk < 20) score += 30;
    if (rsi > 70 && sk > 80) score -= 30;

    score = Math.max(-100, Math.min(100, score));

    let reason = "Momentum nötr";
    if (rsi < 30) reason = "Aşırı satım: Toparlanma sinyalleri";
    else if (rsi > 70) reason = "Aşırı alım: Düzeltme riski yüksek";
    else if (sk > sd) reason = "Stokastik yukarı yönlü kesişim";
    else reason = "Fiyat hızı yavaşlıyor";

    return {
        module: 'Hermes',
        score,
        direction: score > 15 ? 'buy' : score < -15 ? 'sell' : 'hold',
        confidence: 70,
        reason
    };
}

/**
 * CHRONOS - The Time Keeper (Cycles & Reversion)
 * Cycle analysis based on CCI and Williams %R.
 */
function getChronosVote(candles: Candle[]): ModuleVote {
    const last = candles.length - 1;
    const cci = calculateCCI(candles)[last] || 0;

    // Chronos monitors deviations from the mean cycle
    const score = -cci / 1.5;

    let reason = "Döngüsel denge";
    if (cci > 200) reason = "Döngü tepe noktasına ulaştı, satış yakın";
    else if (cci < -200) reason = "Döngü dip yaptı, güçlü dönüş beklentisi";
    else if (Math.abs(cci) > 100) reason = "Döngüsel aşırılık başladı";

    return {
        module: 'Chronos',
        score: Math.max(-100, Math.min(100, score)),
        direction: score > 20 ? 'buy' : score < -20 ? 'sell' : 'hold',
        confidence: 72,
        reason
    };
}

/**
 * POSEIDON - The Whale Detective (Volume Flow)
 */
function getPoseidonVote(candles: Candle[]): ModuleVote {
    const volumes = candles.map(c => c.volume);
    const closes = candles.map(c => c.close);
    const last = volumes.length - 1;

    const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVol = volumes[last];
    const volRatio = currentVol / avgVol;

    const priceChange = (closes[last] - closes[last - 1]) / closes[last - 1];
    let score = priceChange * volRatio * 1500;

    let reason = "Hacim stabil";
    if (volRatio > 2.5) reason = "OLAĞANÜSTÜ HACİM: Balina aktivitesi!";
    else if (volRatio > 1.5) reason = "Hacim artışı: Kurumsal ilgi";
    else if (volRatio < 0.6) reason = "Düşük hacim: İlgi kaybı";

    return {
        module: 'Poseidon',
        score: Math.max(-100, Math.min(100, score)),
        direction: score > 10 ? 'buy' : score < -10 ? 'sell' : 'hold',
        confidence: Math.min(100, volRatio * 40 + 20),
        reason
    };
}

/**
 * ARGUS - The All-Seeing Eye (Guardian)
 */
function getArgusVote(prevVotes: ModuleVote[]): ModuleVote {
    const avgScore = prevVotes.reduce((a, b) => a + b.score, 0) / prevVotes.length;
    const consensus = prevVotes.filter(v => v.direction === (avgScore > 0 ? 'buy' : 'sell')).length;

    let reason = "Modüller arası uyumsuzluk";
    if (consensus >= 5) reason = "GÜÇLÜ KONSEY KONSENSÜSÜ";
    else if (consensus >= 3) reason = "Ilımlı konsensüs oluşuyor";

    return {
        module: 'Argus',
        score: avgScore,
        direction: avgScore > 10 ? 'buy' : avgScore < -10 ? 'sell' : 'hold',
        confidence: 90 + consensus,
        reason
    };
}

export function generateCouncilDecision(candles: Candle[], symbol: string): CouncilDecision {
    if (!candles || candles.length < 50) {
        return createFallbackDecision(symbol);
    }

    const votes: ModuleVote[] = [];

    // Individual module analysis
    votes.push(getOrionVote(candles));
    votes.push(getAtlasVote(candles));
    votes.push(getAetherVote(candles));
    votes.push(getHermesVote(candles));
    votes.push(getChronosVote(candles));
    votes.push(getPoseidonVote(candles));

    // Guardian analysis based on others
    votes.push(getArgusVote(votes));

    const avgScore = votes.reduce((a, b) => a + b.score, 0) / votes.length;
    const buyVotes = votes.filter(v => v.direction === 'buy').length;
    const sellVotes = votes.filter(v => v.direction === 'sell').length;

    // Direct Action Triggers (Restore)
    const closes = candles.map(c => c.close);
    const last = closes.length - 1;
    const rsi = calculateRSI(closes, 14)[last] || 50;

    let finalAction: SignalAction = 'hold';
    let triggerReason = "";

    // Extreme Oversold Trigger
    if (rsi < 24) {
        finalAction = 'buy';
        triggerReason = "KRİTİK AŞIRI SATIM TETİKLENDİ (RSI < 24)";
    }
    // Extreme Overbought Trigger
    else if (rsi > 78) {
        finalAction = 'sell';
        triggerReason = "KRİTİK AŞIRI ALIM TETİKLENDİ (RSI > 78)";
    }
    // Consensus Trigger
    else if (buyVotes >= 4) {
        finalAction = 'buy';
    } else if (sellVotes >= 4) {
        finalAction = 'sell';
    }

    // Boosted confidence calculation
    let confidence = Math.abs(avgScore) * 0.5 + (Math.max(buyVotes, sellVotes) * 10);
    if (buyVotes >= 4 || sellVotes >= 4) {
        confidence = Math.max(65, confidence); // Minimum 65% for trade execution
    }
    if (buyVotes >= 6 || sellVotes >= 6) {
        confidence = Math.max(85, confidence); // Ultra high confidence
    }
    confidence = Math.min(100, confidence);

    return {
        id: crypto.randomUUID(),
        symbol,
        timestamp: new Date(),
        finalAction,
        overallScore: avgScore,
        confidence,
        votes,
        conflicts: [],
        dominantSignals: [],
        reason: triggerReason || `Konsey ${buyVotes} Al, ${sellVotes} Sat oyu ile ${finalAction.toUpperCase()} kararı verdi.`
    };
}

function createFallbackDecision(symbol: string): CouncilDecision {
    return {
        id: 'fallback',
        symbol,
        timestamp: new Date(),
        finalAction: 'hold',
        overallScore: 0,
        confidence: 0,
        votes: [],
        conflicts: [],
        dominantSignals: [],
        reason: "Yetersiz veri (Minimum 50 mum gerekli)"
    };
}

// Full compatibility exports
export function calculateCompositeScore(candles: Candle[]) {
    const decision = generateCouncilDecision(candles, 'TEMP');
    return {
        totalScore: decision.overallScore,
        breakdown: {},
        sentiment: decision.finalAction
    };
}

export function detectMarketRegime(candles: Candle[]): MarketRegime {
    const closes = candles.map(c => c.close);
    const last = closes.length - 1;
    const adx = calculateADX(candles)[last] || 0;

    if (adx > 25) return 'trending';
    if (adx < 15) return 'ranging';
    return 'volatile';
}

export function generateSignals(candles: Candle[]): Signal[] {
    const decision = generateCouncilDecision(candles, 'TEMP');
    if (decision.finalAction === 'hold') return [];

    return [{
        id: decision.id,
        symbol: decision.symbol,
        action: decision.finalAction,
        price: candles[candles.length - 1].close,
        confidence: decision.confidence,
        timestamp: decision.timestamp,
        reason: decision.reason
    }];
}
