import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingUp, TrendingDown, Star } from 'lucide-react';
import { fetchBinanceTickers, getPopularPairs } from '../services/binanceService';
import type { Quote } from '../types';
import './MarketView.css';

export default function MarketView() {
    const [searchQuery, setSearchQuery] = useState('');
    const [watchlist, setWatchlist] = useState<string[]>(() => {
        const saved = localStorage.getItem('crypto_watchlist');
        return saved ? JSON.parse(saved) : [];
    });

    // Initialize watchlist with popular pairs if empty
    useEffect(() => {
        if (watchlist.length === 0) {
            getPopularPairs(10).then(pairs => {
                setWatchlist(pairs);
            }).catch(err => {
                console.error('Failed to get popular pairs:', err);
                // Fallback pairs
                setWatchlist(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT']);
            });
        }
    }, []);

    // Save watchlist to localStorage
    useEffect(() => {
        if (watchlist.length > 0) {
            localStorage.setItem('crypto_watchlist', JSON.stringify(watchlist));
        }
    }, [watchlist]);

    // Fetch quotes from Binance for watchlist
    const { data: quotes = [], isLoading } = useQuery({
        queryKey: ['cryptoQuotes', watchlist],
        queryFn: () => fetchBinanceTickers(watchlist),
        refetchInterval: 10000,
        enabled: watchlist.length > 0,
    });

    // Filter quotes by search
    const filteredQuotes = quotes.filter(q =>
        q.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleWatchlist = (symbol: string) => {
        setWatchlist(prev =>
            prev.includes(symbol)
                ? prev.filter(s => s !== symbol)
                : [...prev, symbol]
        );
    };

    const formatPrice = (price: number) => {
        if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (price >= 1) return price.toFixed(2);
        if (price >= 0.01) return price.toFixed(4);
        return price.toFixed(6);
    };

    return (
        <div className="market-view">
            <div className="market-header">
                <h1>Kripto Piyasaları</h1>
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Coin ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="loading-grid">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="skeleton-card" />
                    ))}
                </div>
            ) : (
                <div className="crypto-grid">
                    {filteredQuotes.map((quote: Quote) => (
                        <Link
                            key={quote.symbol}
                            to={`/crypto/${quote.symbol}`}
                            className="crypto-card"
                        >
                            <div className="card-header">
                                <div className="symbol-info">
                                    <span className="symbol">{quote.symbol.replace('USDT', '')}</span>
                                    <span className="pair">/USDT</span>
                                </div>
                                <button
                                    className={`star-btn ${watchlist.includes(quote.symbol) ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        toggleWatchlist(quote.symbol);
                                    }}
                                >
                                    <Star size={16} fill={watchlist.includes(quote.symbol) ? '#FFD700' : 'none'} />
                                </button>
                            </div>
                            <div className="price-info">
                                <span className="price">${formatPrice(quote.price)}</span>
                                <span className={`change ${quote.changePercent >= 0 ? 'positive' : 'negative'}`}>
                                    {quote.changePercent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                    {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
                                </span>
                            </div>
                            <div className="volume-info">
                                <span>Vol: ${(quote.volume / 1000000).toFixed(1)}M</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {filteredQuotes.length === 0 && !isLoading && (
                <div className="empty-state">
                    <p>Sonuç bulunamadı</p>
                </div>
            )}
        </div>
    );
}
