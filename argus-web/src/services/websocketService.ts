// Binance WebSocket Service for Real-time Price Updates

import { useState, useEffect } from 'react';

type PriceCallback = (symbol: string, price: number, change24h: number) => void;
type TickerData = {
    symbol: string;
    price: number;
    change24h: number;
    volume24h: number;
    high24h: number;
    low24h: number;
};

class BinanceWebSocket {
    private ws: WebSocket | null = null;
    private subscribers: Map<string, Set<PriceCallback>> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 3000;
    private isConnecting = false;
    private tickerData: Map<string, TickerData> = new Map();

    constructor() {
        this.connect();
    }

    private connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.isConnecting = true;

        try {
            // Connect to all tickers stream
            this.ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');

            this.ws.onopen = () => {
                console.log('🟢 Binance WebSocket connected');
                this.reconnectAttempts = 0;
                this.isConnecting = false;
            };

            this.ws.onmessage = (event) => {
                try {
                    const tickers = JSON.parse(event.data);

                    if (Array.isArray(tickers)) {
                        tickers.forEach((ticker: any) => {
                            const symbol = ticker.s; // e.g., "BTCUSDT"
                            const price = parseFloat(ticker.c); // Current price
                            const change24h = parseFloat(ticker.P); // 24h change percentage
                            const volume24h = parseFloat(ticker.v); // Volume
                            const high24h = parseFloat(ticker.h);
                            const low24h = parseFloat(ticker.l);

                            // Store ticker data
                            this.tickerData.set(symbol, {
                                symbol,
                                price,
                                change24h,
                                volume24h,
                                high24h,
                                low24h
                            });

                            // Notify subscribers
                            const callbacks = this.subscribers.get(symbol);
                            if (callbacks) {
                                callbacks.forEach(callback => {
                                    try {
                                        callback(symbol, price, change24h);
                                    } catch (e) {
                                        console.error('Callback error:', e);
                                    }
                                });
                            }
                        });
                    }
                } catch (e) {
                    console.error('WebSocket message parse error:', e);
                }
            };

            this.ws.onerror = (error) => {
                console.error('🔴 Binance WebSocket error:', error);
                this.isConnecting = false;
            };

            this.ws.onclose = () => {
                console.log('🟡 Binance WebSocket closed');
                this.isConnecting = false;
                this.ws = null;

                // Attempt to reconnect
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
                    setTimeout(() => this.connect(), this.reconnectDelay);
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.isConnecting = false;
        }
    }

    subscribe(symbol: string, callback: PriceCallback): () => void {
        const upperSymbol = symbol.toUpperCase();

        if (!this.subscribers.has(upperSymbol)) {
            this.subscribers.set(upperSymbol, new Set());
        }

        this.subscribers.get(upperSymbol)!.add(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(upperSymbol);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this.subscribers.delete(upperSymbol);
                }
            }
        };
    }

    getTickerData(symbol: string): TickerData | undefined {
        return this.tickerData.get(symbol.toUpperCase());
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.subscribers.clear();
    }
}

// Singleton instance
export const binanceWS = new BinanceWebSocket();

// React Hook for using WebSocket prices
export function useRealtimePrice(symbol: string) {
    const [price, setPrice] = useState<number | null>(null);
    const [change24h, setChange24h] = useState<number | null>(null);

    useEffect(() => {
        if (!symbol) return;

        const unsubscribe = binanceWS.subscribe(symbol, (_, newPrice, newChange) => {
            setPrice(newPrice);
            setChange24h(newChange);
        });

        // Get initial data if available
        const initial = binanceWS.getTickerData(symbol);
        if (initial) {
            setPrice(initial.price);
            setChange24h(initial.change24h);
        }

        return unsubscribe;
    }, [symbol]);

    return { price, change24h };
}
