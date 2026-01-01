// ===================================
// Paper Trading Service
// AutoPilot Simülasyon Sistemi
// ===================================

import { fetchBinanceKlines, fetchBinanceTicker, getPopularPairs, fetchAllTradingPairs } from './binanceService';
import { generateCouncilDecision } from './analysisService';
import { calculateDynamicRiskLevels, getSmartRiskLevels } from './riskManagementService';
import { createNotification } from './alertService';
import type { Candle } from '../types';

export interface PaperTrade {
    id: string;
    symbol: string;
    type: 'buy' | 'sell';
    quantity: number;
    entryPrice: number;
    exitPrice?: number;
    entryTime: Date;
    exitTime?: Date;
    pnl?: number;
    pnlPercent?: number;
    status: 'open' | 'closed';
    reason: string;
    confidence: number;
    stopLoss?: number;
    takeProfit?: number;
}

export interface PaperPortfolio {
    balance: number;
    initialBalance: number;
    positions: Map<string, {
        quantity: number;
        avgCost: number;
        stopLoss?: number;
        takeProfit?: number;
    }>;
    trades: PaperTrade[];
    startTime: Date;
    lastUpdate: Date;
}

export interface AutoPilotConfig {
    enabled: boolean;
    maxPositions: number;
    positionSizePercent: number;
    useDynamicSLTP: boolean;      // NEW: Use ATR-based SL/TP
    stopLossPercent: number;      // Fallback if dynamic disabled
    takeProfitPercent: number;    // Fallback if dynamic disabled
    atrMultiplierSL: number;      // NEW: ATR multiplier for SL
    atrMultiplierTP: number;      // NEW: ATR multiplier for TP
    symbols: string[];
    scanIntervalMs: number;
    minConfidence: number;
}

const DEFAULT_CONFIG: AutoPilotConfig = {
    enabled: false,
    maxPositions: 5,
    positionSizePercent: 10,
    useDynamicSLTP: true,
    stopLossPercent: 5,
    takeProfitPercent: 10,
    atrMultiplierSL: 2.0,
    atrMultiplierTP: 3.0,
    symbols: [],
    scanIntervalMs: 15000, // 15 seconds - daha hızlı tarama
    minConfidence: 55,     // Biraz daha düşük threshold
};

// Paper Trading State
let portfolio: PaperPortfolio | null = null;
let config: AutoPilotConfig = loadAutoPilotConfig(); // Load from localStorage on init
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let listeners: ((portfolio: PaperPortfolio) => void)[] = [];

// Load config from localStorage
function loadAutoPilotConfig(): AutoPilotConfig {
    try {
        const saved = localStorage.getItem('autopilot_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_CONFIG, ...parsed };
        }
    } catch (e) {
        console.error('Failed to load AutoPilot config:', e);
    }
    return { ...DEFAULT_CONFIG };
}

// Save config to localStorage
function saveAutoPilotConfig() {
    try {
        localStorage.setItem('autopilot_config', JSON.stringify(config));
    } catch (e) {
        console.error('Failed to save AutoPilot config:', e);
    }
}

// Initialize portfolio
export function initializePaperPortfolio(initialBalance: number = 10000): PaperPortfolio {
    portfolio = {
        balance: initialBalance,
        initialBalance,
        positions: new Map(),
        trades: [],
        startTime: new Date(),
        lastUpdate: new Date(),
    };

    savePaperPortfolio();
    notifyListeners();
    console.log(`📊 Paper Portfolio initialized with $${initialBalance}`);

    return portfolio;
}

// Reset portfolio
export function resetPaperPortfolio(initialBalance: number = 10000): PaperPortfolio {
    localStorage.removeItem('paper_portfolio');
    localStorage.removeItem('paper_trades');
    return initializePaperPortfolio(initialBalance);
}

// Load portfolio from localStorage
export function loadPaperPortfolio(): PaperPortfolio | null {
    try {
        const saved = localStorage.getItem('paper_portfolio');
        if (saved) {
            const data = JSON.parse(saved);
            portfolio = {
                ...data,
                positions: new Map(Object.entries(data.positions || {})),
                startTime: new Date(data.startTime),
                lastUpdate: new Date(data.lastUpdate),
                trades: (data.trades || []).map((t: any) => ({
                    ...t,
                    entryTime: new Date(t.entryTime),
                    exitTime: t.exitTime ? new Date(t.exitTime) : undefined,
                })),
            };
        };
        repairPortfolioBalance(); // Auto-repair on load
        return portfolio;
    }
    } catch (e) {
    console.error('Failed to load paper portfolio:', e);
}
return null;
}

// Save portfolio to localStorage
function savePaperPortfolio() {
    if (!portfolio) return;

    const data = {
        ...portfolio,
        positions: Object.fromEntries(portfolio.positions),
    };
    localStorage.setItem('paper_portfolio', JSON.stringify(data));
}

// Get current portfolio
export function getPaperPortfolio(): PaperPortfolio | null {
    if (!portfolio) {
        portfolio = loadPaperPortfolio();
    }
    return portfolio;
}

// Repair balance based on trades and positions
function repairPortfolioBalance() {
    if (!portfolio) return;

    // 1. Calculate realized PnL from closed trades
    const closedTradesPnl = portfolio.trades
        .filter(t => t.status === 'closed')
        .reduce((sum, t) => sum + (t.pnl || 0), 0);

    // 2. Calculate cost of open positions
    let openPositionsCost = 0;
    for (const position of portfolio.positions.values()) {
        openPositionsCost += position.quantity * position.avgCost;
    }

    // 3. Expected Balance = Initial + Realized PnL - Cost of Open Positions
    const expectedBalance = portfolio.initialBalance + closedTradesPnl - openPositionsCost;

    // 4. Update if significantly different (>$1 diff)
    if (Math.abs(portfolio.balance - expectedBalance) > 1) {
        console.log(`🔧 Repairing Balance. Was: $${portfolio.balance.toFixed(2)}, Should be: $${expectedBalance.toFixed(2)}`);
        portfolio.balance = expectedBalance;
        savePaperPortfolio();
    }
}
}

// Subscribe to portfolio updates
export function subscribeToPaperPortfolio(callback: (portfolio: PaperPortfolio) => void) {
    listeners.push(callback);
    return () => {
        listeners = listeners.filter(l => l !== callback);
    };
}

function notifyListeners() {
    if (portfolio) {
        listeners.forEach(l => l(portfolio!));
    }
}

// Calculate portfolio value with detailed position data
export async function calculatePortfolioValue(): Promise<{
    totalValue: number;
    cash: number;
    positionsValue: number;
    pnl: number;
    pnlPercent: number;
    positionDetails: Array<{
        symbol: string;
        quantity: number;
        avgCost: number;
        currentPrice: number;
        currentValue: number;
        pnl: number;
        pnlPercent: number;
        stopLoss?: number;
        takeProfit?: number;
    }>;
}> {
    if (!portfolio) {
        return {
            totalValue: 0, cash: 0, positionsValue: 0, pnl: 0, pnlPercent: 0,
            positionDetails: []
        };
    }

    let positionsValue = 0;
    const positionDetails = [];

    for (const [symbol, position] of portfolio.positions) {
        let currentPrice = position.avgCost; // Default fallback

        try {
            const ticker = await fetchBinanceTicker(symbol);
            if (ticker) {
                currentPrice = ticker.price;
            } else {
                console.warn(`⚠️ Could not fetch price for ${symbol}, using avgCost as fallback.`);
            }
        } catch (e) {
            console.warn(`⚠️ Error fetching price for ${symbol}:`, e);
        }

        const currentValue = position.quantity * currentPrice;
        positionsValue += currentValue;

        const pnl = currentValue - (position.quantity * position.avgCost);
        const pnlPercent = (pnl / (position.quantity * position.avgCost)) * 100;

        positionDetails.push({
            symbol,
            quantity: position.quantity,
            avgCost: position.avgCost,
            currentPrice: currentPrice,
            currentValue,
            pnl,
            pnlPercent,
            stopLoss: position.stopLoss,
            takeProfit: position.takeProfit
        });
    }

    const totalValue = portfolio.balance + positionsValue;
    const pnl = totalValue - portfolio.initialBalance;
    const pnlPercent = (pnl / portfolio.initialBalance) * 100;

    return {
        totalValue,
        cash: portfolio.balance,
        positionsValue,
        pnl,
        pnlPercent,
        positionDetails
    };
}

// Execute paper buy
export async function paperBuy(
    symbol: string,
    amountUSD: number,
    reason: string,
    confidence: number
): Promise<PaperTrade | null> {
    if (!portfolio) return null;

    if (portfolio.positions.has(symbol)) {
        console.log(`⚠️ Position already exists for ${symbol}. Skipping buy.`);
        return null;
    }

    if (portfolio.balance < amountUSD) {
        console.log(`❌ Insufficient balance for ${symbol}`);
        return null;
    }

    const ticker = await fetchBinanceTicker(symbol);
    if (!ticker) return null;

    const quantity = amountUSD / ticker.price;

    // Update balance
    portfolio.balance -= amountUSD;

    // Update position
    const existing = portfolio.positions.get(symbol);
    if (existing) {
        const totalQty = existing.quantity + quantity;
        const newAvgCost = ((existing.quantity * existing.avgCost) + amountUSD) / totalQty;
        portfolio.positions.set(symbol, { quantity: totalQty, avgCost: newAvgCost });
    } else {
        portfolio.positions.set(symbol, { quantity, avgCost: ticker.price });
    }

    // Create trade record
    const trade: PaperTrade = {
        id: Date.now().toString(),
        symbol,
        type: 'buy',
        quantity,
        entryPrice: ticker.price,
        entryTime: new Date(),
        status: 'open',
        reason,
        confidence,
    };

    portfolio.trades.push(trade);
    portfolio.lastUpdate = new Date();

    savePaperPortfolio();
    notifyListeners();

    console.log(`🟢 BUY ${symbol}: ${quantity.toFixed(6)} @ $${ticker.price.toFixed(4)} | Reason: ${reason}`);

    return trade;
}

// Execute paper sell
export async function paperSell(
    symbol: string,
    quantity?: number,
    reason: string = 'Manual sell'
): Promise<PaperTrade | null> {
    if (!portfolio) return null;

    const position = portfolio.positions.get(symbol);
    if (!position) {
        console.log(`❌ No position in ${symbol}`);
        return null;
    }

    const sellQty = quantity || position.quantity;
    if (sellQty > position.quantity) {
        console.log(`❌ Insufficient ${symbol} quantity`);
        return null;
    }

    const ticker = await fetchBinanceTicker(symbol);
    if (!ticker) return null;

    const proceeds = sellQty * ticker.price;
    const cost = sellQty * position.avgCost;
    const pnl = proceeds - cost;
    const pnlPercent = (pnl / cost) * 100;

    // Update balance
    portfolio.balance += proceeds;

    // Update position
    const remainingQty = position.quantity - sellQty;
    if (remainingQty > 0.000001) {
        portfolio.positions.set(symbol, { ...position, quantity: remainingQty });
    } else {
        portfolio.positions.delete(symbol);
    }

    // Create trade record
    const trade: PaperTrade = {
        id: Date.now().toString(),
        symbol,
        type: 'sell',
        quantity: sellQty,
        entryPrice: position.avgCost,
        exitPrice: ticker.price,
        entryTime: new Date(), // This should be the original entry time ideally
        exitTime: new Date(),
        pnl,
        pnlPercent,
        status: 'closed',
        reason,
        confidence: 0,
    };

    portfolio.trades.push(trade);
    portfolio.lastUpdate = new Date();

    savePaperPortfolio();
    notifyListeners();

    console.log(`🔴 SELL ${symbol}: ${sellQty.toFixed(6)} @ $${ticker.price.toFixed(4)} | PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);

    return trade;
}

// AutoPilot scan and trade
async function autoPilotScan() {
    if (!portfolio || !config.enabled) return;

    console.log('🔍 AutoPilot scanning...');

    const openPositions = portfolio.positions.size;
    const canOpenNew = openPositions < config.maxPositions;

    // Check existing positions for stop-loss / take-profit
    for (const [symbol, position] of portfolio.positions) {
        const ticker = await fetchBinanceTicker(symbol);
        if (!ticker) continue;

        const currentPrice = ticker.price;

        // Check dynamic SL/TP levels stored in position
        if (config.useDynamicSLTP && position.stopLoss && position.takeProfit) {
            // Dynamic Stop-Loss
            if (currentPrice <= position.stopLoss) {
                const pnlPercent = ((currentPrice - position.avgCost) / position.avgCost) * 100;
                await paperSell(symbol, undefined, `🛑 Dynamic SL: $${position.stopLoss.toFixed(4)} (${pnlPercent.toFixed(2)}%)`);
                createNotification('trade', `Stop-Loss: ${symbol.replace('USDT', '')}`, `Dinamik SL tetiklendi @ $${currentPrice.toFixed(4)}`, symbol);
                continue;
            }

            // Dynamic Take-Profit
            if (currentPrice >= position.takeProfit) {
                const pnlPercent = ((currentPrice - position.avgCost) / position.avgCost) * 100;
                await paperSell(symbol, undefined, `🎯 Dynamic TP: $${position.takeProfit.toFixed(4)} (${pnlPercent.toFixed(2)}%)`);
                createNotification('trade', `Take-Profit: ${symbol.replace('USDT', '')}`, `Dinamik TP tetiklendi @ $${currentPrice.toFixed(4)}`, symbol);
                continue;
            }
        } else {
            // Fallback to percentage-based SL/TP
            const currentPnlPercent = ((currentPrice - position.avgCost) / position.avgCost) * 100;

            if (currentPnlPercent <= -config.stopLossPercent) {
                await paperSell(symbol, undefined, `Stop-loss triggered at ${currentPnlPercent.toFixed(2)}%`);
                continue;
            }

            if (currentPnlPercent >= config.takeProfitPercent) {
                await paperSell(symbol, undefined, `Take-profit triggered at ${currentPnlPercent.toFixed(2)}%`);
                continue;
            }
        }

        // Check for sell signal from analysis
        try {
            const candles = await fetchBinanceKlines(symbol, '4h', 200);
            if (candles.length > 50) {
                const decision = generateCouncilDecision(candles, symbol);
                if (decision.finalAction === 'sell' && decision.confidence >= config.minConfidence) {
                    await paperSell(symbol, undefined, decision.reason);
                    createNotification('signal', `Satış Sinyali: ${symbol.replace('USDT', '')}`, decision.reason, symbol);
                }
            }
        } catch (e) {
            console.error(`Error analyzing ${symbol}:`, e);
        }
    }

    // Look for new buy opportunities
    if (canOpenNew) {
        // Scan ALL USDT pairs from Binance
        const symbolsToScan = config.symbols.length > 0
            ? config.symbols
            : await fetchAllTradingPairs();

        console.log(`🔍 Scanning ${symbolsToScan.length} coins for buy opportunities...`);

        for (const symbol of symbolsToScan) {
            // Skip if already have position
            // Skip if already have position (Strict Check)
            if (portfolio.positions.has(symbol)) {
                // console.log(`Skipping ${symbol}, already in portfolio`);
                continue;
            }

            // Skip if max positions reached
            if (portfolio.positions.size >= config.maxPositions) break;

            try {
                const candles = await fetchBinanceKlines(symbol, '4h', 200);
                if (candles.length < 50) continue;

                const decision = generateCouncilDecision(candles, symbol);

                // Log all module votes for debugging
                const buyModules = decision.votes.filter(v => v.direction === 'buy').map(v => v.module);
                const sellModules = decision.votes.filter(v => v.direction === 'sell').map(v => v.module);
                const holdModules = decision.votes.filter(v => v.direction === 'hold').map(v => v.module);

                console.log(`📊 ${symbol}: Action=${decision.finalAction} Conf=${decision.confidence.toFixed(0)}% | BUY:[${buyModules.join(',')}] SELL:[${sellModules.join(',')}] HOLD:[${holdModules.join(',')}]`);

                if (decision.finalAction === 'buy' && decision.confidence >= config.minConfidence) {
                    const positionValue = await calculatePortfolioValue();
                    const tradeSize = positionValue.totalValue * (config.positionSizePercent / 100);

                    if (tradeSize <= portfolio.balance) {
                        // Get current price for entry
                        const ticker = await fetchBinanceTicker(symbol);
                        if (!ticker) continue;

                        const entryPrice = ticker.price;

                        // Calculate dynamic SL/TP levels
                        let stopLoss: number | undefined;
                        let takeProfit: number | undefined;

                        if (config.useDynamicSLTP) {
                            const riskLevels = getSmartRiskLevels(candles, entryPrice, 'long');
                            stopLoss = riskLevels.stopLoss;
                            takeProfit = riskLevels.takeProfit2;

                            console.log(`📊 ${symbol} Risk Levels: SL=$${stopLoss.toFixed(4)} (${riskLevels.stopLossPercent.toFixed(2)}%), TP=$${takeProfit.toFixed(4)} (${riskLevels.takeProfitPercent.toFixed(2)}%), R:R=${riskLevels.riskRewardRatio.toFixed(2)}`);
                        }

                        // Execute buy with SL/TP
                        await paperBuyWithLevels(symbol, tradeSize, decision.reason, decision.confidence, stopLoss, takeProfit);

                        createNotification('trade', `Alım: ${symbol.replace('USDT', '')}`, `${decision.reason} @ $${entryPrice.toFixed(4)}`, symbol);
                    }
                }
            } catch (e) {
                console.error(`Error analyzing ${symbol}:`, e);
            }

            // Smaller delay for faster scanning
            await new Promise(r => setTimeout(r, 50));
        }
    }

    console.log(`✅ AutoPilot scan complete. Positions: ${portfolio.positions.size}/${config.maxPositions}`);
}

// Paper buy with SL/TP levels
async function paperBuyWithLevels(
    symbol: string,
    amountUSD: number,
    reason: string,
    confidence: number,
    stopLoss?: number,
    takeProfit?: number
): Promise<PaperTrade | null> {
    if (!portfolio) return null;

    if (portfolio.positions.has(symbol)) {
        console.log(`⚠️ Position already exists for ${symbol}. Skipping buy.`);
        return null;
    }

    if (portfolio.balance < amountUSD) {
        console.log(`❌ Insufficient balance for ${symbol}`);
        return null;
    }

    const ticker = await fetchBinanceTicker(symbol);
    if (!ticker) return null;

    const quantity = amountUSD / ticker.price;

    portfolio.balance -= amountUSD;

    // Update position with SL/TP
    const existing = portfolio.positions.get(symbol);
    if (existing) {
        const totalQty = existing.quantity + quantity;
        const newAvgCost = ((existing.quantity * existing.avgCost) + amountUSD) / totalQty;
        portfolio.positions.set(symbol, {
            quantity: totalQty,
            avgCost: newAvgCost,
            stopLoss: stopLoss || existing.stopLoss,
            takeProfit: takeProfit || existing.takeProfit
        });
    } else {
        portfolio.positions.set(symbol, {
            quantity,
            avgCost: ticker.price,
            stopLoss,
            takeProfit
        });
    }

    const trade: PaperTrade = {
        id: Date.now().toString(),
        symbol,
        type: 'buy',
        quantity,
        entryPrice: ticker.price,
        entryTime: new Date(),
        status: 'open',
        reason,
        confidence,
        stopLoss,
        takeProfit,
    };

    portfolio.trades.push(trade);
    portfolio.lastUpdate = new Date();

    savePaperPortfolio();
    notifyListeners();

    console.log(`🟢 BUY ${symbol}: ${quantity.toFixed(6)} @ $${ticker.price.toFixed(4)} | SL: $${stopLoss?.toFixed(4) || 'N/A'} | TP: $${takeProfit?.toFixed(4) || 'N/A'}`);

    return trade;
}

// Start AutoPilot
export function startAutoPilot(customConfig?: Partial<AutoPilotConfig>) {
    if (!portfolio) {
        initializePaperPortfolio();
    }

    config = { ...config, ...customConfig, enabled: true };
    saveAutoPilotConfig(); // Save to localStorage

    if (isRunning) {
        console.log('AutoPilot already running');
        return;
    }

    isRunning = true;

    // Run immediately
    autoPilotScan();

    // Then run on interval
    intervalId = setInterval(autoPilotScan, config.scanIntervalMs);

    console.log('🚀 AutoPilot started');
    console.log(`   Scan interval: ${config.scanIntervalMs / 1000}s`);
    console.log(`   Max positions: ${config.maxPositions}`);
    console.log(`   Position size: ${config.positionSizePercent}%`);
    console.log(`   Dynamic SL/TP: ${config.useDynamicSLTP ? 'Yes' : 'No'}`);
    console.log(`   Stop-loss: ${config.stopLossPercent}%`);
    console.log(`   Take-profit: ${config.takeProfitPercent}%`);
    console.log(`   Min confidence: ${config.minConfidence}%`);
}

// Stop AutoPilot
export function stopAutoPilot() {
    config.enabled = false;
    isRunning = false;

    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }

    console.log('⏹️ AutoPilot stopped');
}

// Get AutoPilot status
export function getAutoPilotStatus() {
    return {
        isRunning,
        config,
        portfolio: portfolio ? {
            balance: portfolio.balance,
            positions: portfolio.positions.size,
            trades: portfolio.trades.length,
        } : null,
    };
}

// Get config
export function getAutoPilotConfig(): AutoPilotConfig {
    return { ...config };
}

// Update config
export function updateAutoPilotConfig(newConfig: Partial<AutoPilotConfig>) {
    config = { ...config, ...newConfig };
    saveAutoPilotConfig(); // Save to localStorage
    console.log('📊 AutoPilot config updated and saved:', newConfig);
}

// Get trading history
export function getTradingHistory(): PaperTrade[] {
    return portfolio?.trades || [];
}

// Get performance stats
export function getPerformanceStats() {
    if (!portfolio) return null;

    const trades = portfolio.trades.filter(t => t.status === 'closed');
    const winners = trades.filter(t => (t.pnl || 0) > 0);
    const losers = trades.filter(t => (t.pnl || 0) < 0);

    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgWin = winners.length > 0
        ? winners.reduce((sum, t) => sum + (t.pnl || 0), 0) / winners.length
        : 0;
    const avgLoss = losers.length > 0
        ? losers.reduce((sum, t) => sum + (t.pnl || 0), 0) / losers.length
        : 0;

    return {
        totalTrades: trades.length,
        winners: winners.length,
        losers: losers.length,
        winRate: trades.length > 0 ? (winners.length / trades.length) * 100 : 0,
        totalPnl,
        avgWin,
        avgLoss,
        profitFactor: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0,
        largestWin: Math.max(...trades.map(t => t.pnl || 0), 0),
        largestLoss: Math.min(...trades.map(t => t.pnl || 0), 0),
    };
}
