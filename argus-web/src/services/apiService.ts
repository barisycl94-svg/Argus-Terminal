// ===================================
// ARGUS TERMINAL - API Service
// Market Data Fetching
// ===================================

import type { Candle, Quote, NewsItem } from '../types';

// Yahoo Finance API (via proxy or direct)
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

// API Keys (should be in environment variables in production)
const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY || '';

// Helper to parse Yahoo Finance response
function parseYahooCandles(data: any): Candle[] {
    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};

    return timestamps.map((ts: number, i: number) => ({
        id: `${ts}-${i}`,
        date: new Date(ts * 1000),
        open: quotes.open?.[i] || 0,
        high: quotes.high?.[i] || 0,
        low: quotes.low?.[i] || 0,
        close: quotes.close?.[i] || 0,
        volume: quotes.volume?.[i] || 0,
    })).filter((c: Candle) => c.open > 0 && c.close > 0);
}

// Fetch historical candle data
export async function fetchCandles(
    symbol: string,
    interval: '1d' | '1h' | '5m' = '1d',
    range: '1mo' | '3mo' | '6mo' | '1y' | '5y' = '6mo'
): Promise<Candle[]> {
    try {
        // Using a CORS proxy for browser compatibility
        const corsProxy = 'https://api.allorigins.win/raw?url=';
        const url = `${YAHOO_BASE}/chart/${symbol}?interval=${interval}&range=${range}`;

        const response = await fetch(corsProxy + encodeURIComponent(url));
        if (!response.ok) throw new Error('Failed to fetch data');

        const data = await response.json();
        return parseYahooCandles(data);
    } catch (error) {
        console.error('Error fetching candles:', error);
        // Return mock data if API fails
        return generateMockCandles(120, 100);
    }
}

// Fetch real-time quote
export async function fetchQuote(symbol: string): Promise<Quote | null> {
    try {
        const corsProxy = 'https://api.allorigins.win/raw?url=';
        const url = `${YAHOO_BASE}/chart/${symbol}?interval=1d&range=5d`;

        const response = await fetch(corsProxy + encodeURIComponent(url));
        if (!response.ok) return null;

        const data = await response.json();
        const result = data?.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const quotes = result.indicators?.quote?.[0];
        const closes = quotes?.close?.filter((c: number) => c != null) || [];
        const lastClose = closes[closes.length - 1] || meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose || meta.previousClose || lastClose;

        return {
            symbol: meta.symbol,
            name: meta.shortName || meta.longName || symbol,
            price: lastClose,
            change: lastClose - prevClose,
            changePercent: ((lastClose - prevClose) / prevClose) * 100,
            previousClose: prevClose,
            volume: meta.regularMarketVolume,
            timestamp: new Date(),
        };
    } catch (error) {
        console.error('Error fetching quote:', error);
        return null;
    }
}

// Fetch multiple quotes
export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
    const quotes = await Promise.all(symbols.map(s => fetchQuote(s)));
    return quotes.filter((q): q is Quote => q !== null);
}

// Search symbols
export async function searchSymbols(query: string): Promise<Array<{ symbol: string; name: string }>> {
    try {
        if (!query || query.length < 2) return [];

        const corsProxy = 'https://api.allorigins.win/raw?url=';
        const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;

        const response = await fetch(corsProxy + encodeURIComponent(url));
        if (!response.ok) return [];

        const data = await response.json();
        return (data.quotes || []).map((q: any) => ({
            symbol: q.symbol,
            name: q.shortname || q.longname || q.symbol,
        }));
    } catch (error) {
        console.error('Error searching symbols:', error);
        return [];
    }
}

// Fetch news for a symbol
export async function fetchNews(symbol?: string): Promise<NewsItem[]> {
    try {
        // Using Finnhub for news if API key is available
        if (FINNHUB_API_KEY) {
            const url = symbol
                ? `${FINNHUB_BASE}/company-news?symbol=${symbol}&from=${getDateString(-7)}&to=${getDateString(0)}&token=${FINNHUB_API_KEY}`
                : `${FINNHUB_BASE}/news?category=general&token=${FINNHUB_API_KEY}`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                return data.slice(0, 20).map((n: any) => ({
                    id: n.id?.toString() || Math.random().toString(),
                    title: n.headline,
                    summary: n.summary,
                    url: n.url,
                    source: n.source,
                    publishedAt: new Date(n.datetime * 1000),
                    sentiment: 'neutral' as const,
                }));
            }
        }

        // Fallback to mock news
        return getMockNews();
    } catch (error) {
        console.error('Error fetching news:', error);
        return getMockNews();
    }
}

// Helper: Get date string for API calls
function getDateString(daysOffset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
}

// Generate mock candle data
export function generateMockCandles(count: number, startPrice: number): Candle[] {
    const candles: Candle[] = [];
    let currentPrice = startPrice;
    const now = new Date();

    for (let i = 0; i < count; i++) {
        const change = (Math.random() - 0.48) * 4; // Slight upward bias
        const open = currentPrice;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;
        const volume = Math.floor(Math.random() * 9000000 + 1000000);

        const date = new Date(now);
        date.setDate(date.getDate() - (count - 1 - i));

        candles.push({
            id: `mock-${i}`,
            date,
            open,
            high,
            low,
            close,
            volume,
        });

        currentPrice = close;
    }

    return candles;
}

// Generate mock quotes
export function getMockQuotes(): Quote[] {
    const symbols = [
        { symbol: 'AAPL', name: 'Apple Inc.' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.' },
        { symbol: 'MSFT', name: 'Microsoft Corp.' },
        { symbol: 'AMZN', name: 'Amazon.com Inc.' },
        { symbol: 'TSLA', name: 'Tesla Inc.' },
        { symbol: 'META', name: 'Meta Platforms' },
        { symbol: 'NVDA', name: 'NVIDIA Corp.' },
        { symbol: 'AMD', name: 'AMD Inc.' },
        { symbol: 'NFLX', name: 'Netflix Inc.' },
        { symbol: 'JPM', name: 'JPMorgan Chase' },
    ];

    return symbols.map(s => ({
        symbol: s.symbol,
        name: s.name,
        price: Math.random() * 300 + 50,
        change: (Math.random() - 0.5) * 20,
        changePercent: (Math.random() - 0.5) * 10,
        volume: Math.floor(Math.random() * 50000000),
        timestamp: new Date(),
    }));
}

// Generate mock news
function getMockNews(): NewsItem[] {
    return [
        {
            id: '1',
            title: 'Fed Faiz Kararı Açıklandı - Piyasalar Tepki Veriyor',
            summary: 'Federal Reserve beklendiği gibi faiz oranlarını sabit tuttu...',
            url: '#',
            source: 'Bloomberg',
            publishedAt: new Date(),
            sentiment: 'neutral',
        },
        {
            id: '2',
            title: 'Teknoloji Hisseleri Güçlü Kazançlarla Yükseliyor',
            summary: 'NASDAQ endeksi güçlü bilanço sonuçlarıyla yükselişini sürdürüyor...',
            url: '#',
            source: 'Reuters',
            publishedAt: new Date(Date.now() - 3600000),
            sentiment: 'positive',
        },
        {
            id: '3',
            title: 'Kripto Piyasalarında Volatilite Artıyor',
            summary: 'Bitcoin ve diğer kripto paralar son 24 saatte hareketli seyrediyor...',
            url: '#',
            source: 'CoinDesk',
            publishedAt: new Date(Date.now() - 7200000),
            sentiment: 'neutral',
        },
    ];
}
