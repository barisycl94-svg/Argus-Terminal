// ===================================
// Binance API Service
// Kripto Piyasa Verileri
// ===================================

import type { Candle, Quote } from '../types';

const BINANCE_API = 'https://api.binance.com/api/v3';
const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

// Stablecoin ve hariç tutulacak semboller
const EXCLUDED_PATTERNS = [
    // Stablecoins
    'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FDUSD', 'USDD', 'GUSD',
    'FRAX', 'LUSD', 'SUSD', 'CUSD', 'USTC', 'UST', 'EUSD', 'AEUR', 'EUR',
    // Leveraged tokens
    'UP', 'DOWN', 'BEAR', 'BULL',
    // Other excluded
    'BTTC', 'NFT', 'LUNC', 'LUNA2',
];

// Cache for all trading pairs
let allTradingPairs: string[] = [];
let pairsLastFetched: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Interval mapping
const INTERVAL_MAP: Record<string, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d',
    '1w': '1w',
};

// Check if symbol should be excluded
function isExcludedSymbol(symbol: string): boolean {
    const baseAsset = symbol.replace('USDT', '');

    // Check if it's a stablecoin or excluded pattern
    for (const pattern of EXCLUDED_PATTERNS) {
        if (baseAsset === pattern || baseAsset.includes(pattern)) {
            return true;
        }
    }

    // Exclude leveraged tokens (ending with numbers like 2L, 3L, 2S, 3S)
    if (/\d+(L|S)$/.test(baseAsset)) {
        return true;
    }

    return false;
}

// Fetch all USDT trading pairs from Binance (excluding stablecoins)
export async function fetchAllTradingPairs(): Promise<string[]> {
    const now = Date.now();

    // Return cached data if valid
    if (allTradingPairs.length > 0 && (now - pairsLastFetched) < CACHE_DURATION) {
        return allTradingPairs;
    }

    try {
        const url = `${BINANCE_API}/exchangeInfo`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Exchange info fetch failed');

        const data = await response.json();

        allTradingPairs = data.symbols
            .filter((s: any) =>
                s.quoteAsset === 'USDT' &&
                s.status === 'TRADING' &&
                s.isSpotTradingAllowed === true &&
                !isExcludedSymbol(s.symbol)
            )
            .map((s: any) => s.symbol)
            .sort();

        pairsLastFetched = now;
        console.log(`📊 Loaded ${allTradingPairs.length} USDT trading pairs from Binance`);

        return allTradingPairs;
    } catch (error) {
        console.error('Failed to fetch trading pairs:', error);
        return getDefaultPairs();
    }
}

// Default popular pairs (fallback)
function getDefaultPairs(): string[] {
    return [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
        'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
        'LINKUSDT', 'LTCUSDT', 'ATOMUSDT', 'UNIUSDT', 'APTUSDT',
        'ARBUSDT', 'OPUSDT', 'NEARUSDT', 'FILUSDT', 'INJUSDT'
    ];
}

// Get popular pairs for watchlist (top by volume)
export async function getPopularPairs(limit: number = 50): Promise<string[]> {
    try {
        const url = `${BINANCE_API}/ticker/24hr`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ticker fetch failed');

        const data = await response.json();

        const pairs = data
            .filter((t: any) =>
                t.symbol.endsWith('USDT') &&
                !isExcludedSymbol(t.symbol) &&
                parseFloat(t.quoteVolume) > 1000000 // Min $1M volume
            )
            .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, limit)
            .map((t: any) => t.symbol);

        return pairs;
    } catch (error) {
        console.error('Failed to get popular pairs:', error);
        return getDefaultPairs();
    }
}

// Fetch klines (candlestick data) from Binance
export async function fetchBinanceKlines(
    symbol: string,
    interval: string = '1h',
    limit: number = 500
): Promise<Candle[]> {
    try {
        const binanceInterval = INTERVAL_MAP[interval] || '1h';
        const url = `${BINANCE_API}/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Binance API error');

        const data = await response.json();

        return data.map((k: any[]) => ({
            date: new Date(k[0]),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
        }));
    } catch (error) {
        console.error('Binance klines error:', error);
        return generateMockCryptoCandles(symbol, limit);
    }
}

// Fetch Order Book (Depth)
export async function fetchOrderBook(symbol: string, limit: number = 10): Promise<{ bids: [string, string][], asks: [string, string][] } | null> {
    try {
        const url = `${BINANCE_API}/depth?symbol=${symbol}&limit=${limit}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch depth');
        const data = await response.json();
        return {
            bids: data.bids,
            asks: data.asks
        };
    } catch (error) {
        console.error(`Error fetching depth for ${symbol}:`, error);
        return null;
    }
}

// Fetch 24hr ticker for a single symbol
export async function fetchBinanceTicker(symbol: string): Promise<Quote | null> {
    try {
        const url = `${BINANCE_API}/ticker/24hr?symbol=${symbol}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ticker fetch failed');

        const data = await response.json();

        return {
            symbol: data.symbol,
            name: getCryptoName(data.symbol),
            price: parseFloat(data.lastPrice),
            change: parseFloat(data.priceChange),
            changePercent: parseFloat(data.priceChangePercent),
            high: parseFloat(data.highPrice),
            low: parseFloat(data.lowPrice),
            volume: parseFloat(data.volume),
            previousClose: parseFloat(data.prevClosePrice),
        };
    } catch (error) {
        console.error('Binance ticker error:', error);
        return null;
    }
}

// Fetch multiple tickers
export async function fetchBinanceTickers(symbols: string[]): Promise<Quote[]> {
    try {
        const url = `${BINANCE_API}/ticker/24hr`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Tickers fetch failed');

        const data = await response.json();

        return data
            .filter((t: any) => symbols.includes(t.symbol))
            .map((t: any) => ({
                symbol: t.symbol,
                name: getCryptoName(t.symbol),
                price: parseFloat(t.lastPrice),
                change: parseFloat(t.priceChange),
                changePercent: parseFloat(t.priceChangePercent),
                high: parseFloat(t.highPrice),
                low: parseFloat(t.lowPrice),
                volume: parseFloat(t.volume),
                previousClose: parseFloat(t.prevClosePrice),
            }));
    } catch (error) {
        console.error('Binance tickers error:', error);
        return [];
    }
}

// Fetch ALL tickers (for full market view)
export async function fetchAllTickers(): Promise<Quote[]> {
    try {
        const url = `${BINANCE_API}/ticker/24hr`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('All tickers fetch failed');

        const data = await response.json();

        return data
            .filter((t: any) =>
                t.symbol.endsWith('USDT') &&
                !isExcludedSymbol(t.symbol) &&
                parseFloat(t.quoteVolume) > 100000 // Min $100K volume
            )
            .map((t: any) => ({
                symbol: t.symbol,
                name: getCryptoName(t.symbol),
                price: parseFloat(t.lastPrice),
                change: parseFloat(t.priceChange),
                changePercent: parseFloat(t.priceChangePercent),
                high: parseFloat(t.highPrice),
                low: parseFloat(t.lowPrice),
                volume: parseFloat(t.volume),
                quoteVolume: parseFloat(t.quoteVolume),
                previousClose: parseFloat(t.prevClosePrice),
            }))
            .sort((a: any, b: any) => b.quoteVolume - a.quoteVolume);
    } catch (error) {
        console.error('All tickers error:', error);
        return [];
    }
}

// Fetch top gainers and losers
export async function fetchTopMovers(): Promise<{ gainers: Quote[], losers: Quote[] }> {
    try {
        const url = `${BINANCE_API}/ticker/24hr`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Movers fetch failed');

        const data = await response.json();

        const usdtPairs = data
            .filter((t: any) =>
                t.symbol.endsWith('USDT') &&
                !isExcludedSymbol(t.symbol) &&
                parseFloat(t.quoteVolume) > 5000000 // Min $5M volume
            )
            .map((t: any) => ({
                symbol: t.symbol,
                name: getCryptoName(t.symbol),
                price: parseFloat(t.lastPrice),
                change: parseFloat(t.priceChange),
                changePercent: parseFloat(t.priceChangePercent),
                high: parseFloat(t.highPrice),
                low: parseFloat(t.lowPrice),
                volume: parseFloat(t.volume),
                previousClose: parseFloat(t.prevClosePrice),
            }));

        const sorted = [...usdtPairs].sort((a, b) => b.changePercent - a.changePercent);

        return {
            gainers: sorted.slice(0, 10),
            losers: sorted.slice(-10).reverse(),
        };
    } catch (error) {
        console.error('Top movers error:', error);
        return { gainers: [], losers: [] };
    }
}

// Phoenix Scanner - Find trading opportunities
export async function scanCryptoMarket(): Promise<{
    momentum: Quote[],
    oversold: Quote[],
    breakout: Quote[],
    highVolume: Quote[]
}> {
    try {
        const url = `${BINANCE_API}/ticker/24hr`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Scan failed');

        const data = await response.json();

        const usdtPairs = data
            .filter((t: any) =>
                t.symbol.endsWith('USDT') &&
                !isExcludedSymbol(t.symbol) &&
                parseFloat(t.quoteVolume) > 1000000 // Min $1M volume
            )
            .map((t: any) => ({
                symbol: t.symbol,
                name: getCryptoName(t.symbol),
                price: parseFloat(t.lastPrice),
                change: parseFloat(t.priceChange),
                changePercent: parseFloat(t.priceChangePercent),
                high: parseFloat(t.highPrice),
                low: parseFloat(t.lowPrice),
                volume: parseFloat(t.volume),
                previousClose: parseFloat(t.prevClosePrice),
                quoteVolume: parseFloat(t.quoteVolume),
            }));

        // Momentum: Strong positive movement
        const momentum = usdtPairs
            .filter((q: any) => q.changePercent > 5 && q.changePercent < 50)
            .sort((a: any, b: any) => b.changePercent - a.changePercent)
            .slice(0, 15);

        // Oversold: Big drops (potential bounce)  
        const oversold = usdtPairs
            .filter((q: any) => q.changePercent < -5 && q.changePercent > -50)
            .sort((a: any, b: any) => a.changePercent - b.changePercent)
            .slice(0, 15);

        // Breakout: Near 24h high
        const breakout = usdtPairs
            .filter((q: any) => {
                const nearHigh = (q.price / q.high) > 0.98;
                return nearHigh && q.changePercent > 0;
            })
            .sort((a: any, b: any) => b.changePercent - a.changePercent)
            .slice(0, 15);

        // High Volume: Above average volume
        const avgVolume = usdtPairs.reduce((sum: number, q: any) => sum + q.quoteVolume, 0) / usdtPairs.length;
        const highVolume = usdtPairs
            .filter((q: any) => q.quoteVolume > avgVolume * 2)
            .sort((a: any, b: any) => b.quoteVolume - a.quoteVolume)
            .slice(0, 15);

        return { momentum, oversold, breakout, highVolume };
    } catch (error) {
        console.error('Scan error:', error);
        return { momentum: [], oversold: [], breakout: [], highVolume: [] };
    }
}

// Search symbols
export async function searchBinanceSymbols(query: string): Promise<{ symbol: string; name: string }[]> {
    try {
        const allPairs = await fetchAllTradingPairs();

        const filtered = allPairs
            .filter(s => s.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 30)
            .map(s => ({
                symbol: s,
                name: getCryptoName(s),
            }));

        return filtered;
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

// WebSocket connection for real-time data
export class BinanceWebSocket {
    private ws: WebSocket | null = null;
    private callbacks: Map<string, (data: any) => void> = new Map();

    connect(symbols: string[], onUpdate: (data: any) => void) {
        const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
        this.ws = new WebSocket(`${BINANCE_WS}/${streams}`);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onUpdate({
                symbol: data.s,
                price: parseFloat(data.c),
                change: parseFloat(data.p),
                changePercent: parseFloat(data.P),
                volume: parseFloat(data.v),
                high: parseFloat(data.h),
                low: parseFloat(data.l),
            });
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Crypto name database (expanded)
const CRYPTO_NAMES: Record<string, string> = {
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'BNB': 'BNB',
    'SOL': 'Solana',
    'XRP': 'XRP',
    'ADA': 'Cardano',
    'DOGE': 'Dogecoin',
    'AVAX': 'Avalanche',
    'DOT': 'Polkadot',
    'MATIC': 'Polygon',
    'LINK': 'Chainlink',
    'LTC': 'Litecoin',
    'ATOM': 'Cosmos',
    'UNI': 'Uniswap',
    'APT': 'Aptos',
    'ARB': 'Arbitrum',
    'OP': 'Optimism',
    'NEAR': 'NEAR Protocol',
    'FIL': 'Filecoin',
    'INJ': 'Injective',
    'SUI': 'Sui',
    'SEI': 'Sei',
    'TIA': 'Celestia',
    'JUP': 'Jupiter',
    'WIF': 'dogwifhat',
    'PEPE': 'Pepe',
    'SHIB': 'Shiba Inu',
    'FET': 'Fetch.ai',
    'RENDER': 'Render',
    'AR': 'Arweave',
    'TRX': 'TRON',
    'TON': 'Toncoin',
    'BCH': 'Bitcoin Cash',
    'ETC': 'Ethereum Classic',
    'XLM': 'Stellar',
    'HBAR': 'Hedera',
    'VET': 'VeChain',
    'ICP': 'Internet Computer',
    'FTM': 'Fantom',
    'ALGO': 'Algorand',
    'AAVE': 'Aave',
    'MKR': 'Maker',
    'CRV': 'Curve',
    'LDO': 'Lido DAO',
    'GRT': 'The Graph',
    'SAND': 'The Sandbox',
    'MANA': 'Decentraland',
    'AXS': 'Axie Infinity',
    'ENJ': 'Enjin Coin',
    'GALA': 'Gala',
    'IMX': 'Immutable X',
    'BONK': 'Bonk',
    'FLOKI': 'Floki',
    'RUNE': 'THORChain',
    'CAKE': 'PancakeSwap',
    'SNX': 'Synthetix',
    'COMP': 'Compound',
    '1INCH': '1inch',
    'SUSHI': 'SushiSwap',
    'YFI': 'yearn.finance',
    'BAL': 'Balancer',
    'OCEAN': 'Ocean Protocol',
    'AGIX': 'SingularityNET',
    'TAO': 'Bittensor',
    'WLD': 'Worldcoin',
    'BLUR': 'Blur',
    'STRK': 'Starknet',
    'MANTA': 'Manta Network',
    'PYTH': 'Pyth Network',
    'JTO': 'Jito',
    'DYM': 'Dymension',
    'ONDO': 'Ondo',
    'ENA': 'Ethena',
    'W': 'Wormhole',
    'EIGEN': 'EigenLayer',
    'ZRO': 'LayerZero',
    'ZK': 'ZKsync',
    'IO': 'io.net',
    'NOT': 'Notcoin',
    'LISTA': 'Lista DAO',
    'BB': 'BounceBit',
    'REZ': 'Renzo',
    'AEVO': 'Aevo',
    'ETHFI': 'Ether.fi',
    'SAGA': 'Saga',
    'TNSR': 'Tensor',
    'ACE': 'Fusionist',
    'AI': 'Sleepless AI',
    'XAI': 'Xai',
    'MAVIA': 'Heroes of Mavia',
    'PORTAL': 'Portal',
    'PIXEL': 'Pixels',
    'VANRY': 'Vanar Chain',
    'ALT': 'AltLayer',
    'NFP': 'NFPrompt',
    'BOME': 'BOOK OF MEME',
    'MEW': 'cat in a dogs world',
    'PEOPLE': 'ConstitutionDAO',
    'ENS': 'Ethereum Name Service',
    'APE': 'ApeCoin',
    'JASMY': 'JasmyCoin',
    'CHZ': 'Chiliz',
    'CFX': 'Conflux',
    'STX': 'Stacks',
    'KAVA': 'Kava',
    'ZIL': 'Zilliqa',
    'ONE': 'Harmony',
    'ROSE': 'Oasis Network',
    'QTUM': 'Qtum',
    'IOTA': 'IOTA',
    'ZEC': 'Zcash',
    'DASH': 'Dash',
    'NEO': 'Neo',
    'WAVES': 'Waves',
    'CELO': 'Celo',
    'FLOW': 'Flow',
    'EGLD': 'MultiversX',
    'KSM': 'Kusama',
    'THETA': 'Theta Network',
    'MINA': 'Mina Protocol',
};

// Get crypto name from symbol
function getCryptoName(symbol: string): string {
    const baseAsset = symbol.replace('USDT', '');
    return CRYPTO_NAMES[baseAsset] || baseAsset;
}

// Mock data generators
function generateMockCryptoCandles(symbol: string, count: number): Candle[] {
    const candles: Candle[] = [];
    let basePrice = symbol === 'BTCUSDT' ? 42000 : symbol === 'ETHUSDT' ? 2200 : 100;

    for (let i = count - 1; i >= 0; i--) {
        const date = new Date();
        date.setHours(date.getHours() - i);

        const volatility = 0.02;
        const change = (Math.random() - 0.5) * 2 * volatility;
        const open = basePrice;
        const close = basePrice * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);

        candles.push({
            date,
            open,
            high,
            low,
            close,
            volume: Math.random() * 1000000
        });

        basePrice = close;
    }

    return candles;
}

// Export for crypto categories
export const CRYPTO_CATEGORIES = {
    'Layer 1': ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'ADAUSDT', 'DOTUSDT', 'NEARUSDT', 'APTUSDT', 'SUIUSDT', 'SEIUSDT'],
    'Layer 2': ['MATICUSDT', 'ARBUSDT', 'OPUSDT', 'STRKUSDT', 'MANTAUSDT', 'ZKUSDT'],
    'DeFi': ['UNIUSDT', 'AAVEUSDT', 'MKRUSDT', 'CRVUSDT', 'LDOUSDT', 'JUPUSDT', 'ENAUSDT', 'ONDOUSDT'],
    'AI & Data': ['FETUSDT', 'RENDERUSDT', 'AGIXUSDT', 'OCEANUSDT', 'TAOUSDT', 'WLDUSDT', 'IOUSDT'],
    'Gaming': ['AXSUSDT', 'SANDUSDT', 'MANAUSDT', 'ENJUSDT', 'GALAUSDT', 'IMXUSDT', 'PIXELUSDT', 'PORTALUSDT'],
    'Meme': ['DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'WIFUSDT', 'BONKUSDT', 'FLOKIUSDT', 'MEWUSDT', 'BOMEUSDT', 'NOTUSDT'],
    'Infrastructure': ['LINKUSDT', 'FILUSDT', 'ARUSDT', 'GRTUSDT', 'ATOMUSDT', 'PYTHUSDT', 'ZROUSDT'],
    'Exchange': ['BNBUSDT', 'CAKEUSDT'],
};

// Export legacy constant for backward compatibility
export const CRYPTO_PAIRS = getDefaultPairs();
