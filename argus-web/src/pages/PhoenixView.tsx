import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    Flame, TrendingUp, TrendingDown, Zap, Volume2, Target,
    RefreshCw, Filter, ChevronRight, ArrowUpRight, Star
} from 'lucide-react';
import {
    scanCryptoMarket,
    fetchTopMovers,
    CRYPTO_CATEGORIES
} from '../services/binanceService';
import type { Quote } from '../types';
import './PhoenixView.css';

type ScanMode = 'momentum' | 'oversold' | 'breakout' | 'highVolume';

const SCAN_MODES: { id: ScanMode; name: string; icon: any; description: string }[] = [
    { id: 'momentum', name: 'Momentum', icon: Zap, description: 'Güçlü yükseliş trendi' },
    { id: 'oversold', name: 'Aşırı Satım', icon: TrendingDown, description: 'Potansiyel dip' },
    { id: 'breakout', name: 'Breakout', icon: Target, description: '24s yükseklere yakın' },
    { id: 'highVolume', name: 'Yüksek Hacim', icon: Volume2, description: 'Ortalamanın üstünde işlem' },
];

export default function PhoenixView() {
    const [selectedMode, setSelectedMode] = useState<ScanMode>('momentum');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Fetch scan results
    const { data: scanResults, isLoading: scanLoading, refetch: refetchScan } = useQuery({
        queryKey: ['phoenixScan'],
        queryFn: scanCryptoMarket,
        refetchInterval: 60000, // Refresh every minute
    });

    // Fetch top movers
    const { data: topMovers } = useQuery({
        queryKey: ['topMovers'],
        queryFn: fetchTopMovers,
        refetchInterval: 30000,
    });

    const getCurrentResults = (): Quote[] => {
        if (!scanResults) return [];

        let results = scanResults[selectedMode] || [];

        // Filter by category if selected
        if (selectedCategory && CRYPTO_CATEGORIES[selectedCategory as keyof typeof CRYPTO_CATEGORIES]) {
            const categorySymbols = CRYPTO_CATEGORIES[selectedCategory as keyof typeof CRYPTO_CATEGORIES];
            results = results.filter(r => categorySymbols.includes(r.symbol));
        }

        return results;
    };

    const results = getCurrentResults();

    return (
        <div className="phoenix-view">
            {/* Header */}
            <div className="phoenix-header">
                <div className="header-left">
                    <Flame className="phoenix-icon" />
                    <div>
                        <h1>Phoenix Tarayıcı</h1>
                        <p>Kripto fırsat keşfi</p>
                    </div>
                </div>
                <button
                    className="refresh-btn"
                    onClick={() => refetchScan()}
                    disabled={scanLoading}
                >
                    <RefreshCw className={scanLoading ? 'spinning' : ''} />
                </button>
            </div>

            {/* Scan Mode Selector */}
            <div className="mode-selector">
                {SCAN_MODES.map((mode) => {
                    const Icon = mode.icon;
                    return (
                        <button
                            key={mode.id}
                            className={`mode-btn ${selectedMode === mode.id ? 'active' : ''}`}
                            onClick={() => setSelectedMode(mode.id)}
                        >
                            <Icon size={18} />
                            <span className="mode-name">{mode.name}</span>
                            <span className="mode-desc">{mode.description}</span>
                        </button>
                    );
                })}
            </div>

            {/* Category Filter */}
            <div className="category-filter">
                <Filter size={16} />
                <div className="category-chips">
                    <button
                        className={`category-chip ${!selectedCategory ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(null)}
                    >
                        Tümü
                    </button>
                    {Object.keys(CRYPTO_CATEGORIES).map((cat) => (
                        <button
                            key={cat}
                            className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Top Movers Summary */}
            {topMovers && (
                <div className="movers-summary">
                    <div className="mover-section gainers">
                        <div className="mover-header">
                            <TrendingUp size={16} />
                            <span>Top 3 Yükselen</span>
                        </div>
                        <div className="mover-list">
                            {topMovers.gainers.slice(0, 3).map((m) => (
                                <Link key={m.symbol} to={`/crypto/${m.symbol}`} className="mover-item">
                                    <span className="symbol">{m.symbol.replace('USDT', '')}</span>
                                    <span className="change positive">+{m.changePercent.toFixed(1)}%</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div className="mover-section losers">
                        <div className="mover-header">
                            <TrendingDown size={16} />
                            <span>Top 3 Düşen</span>
                        </div>
                        <div className="mover-list">
                            {topMovers.losers.slice(0, 3).map((m) => (
                                <Link key={m.symbol} to={`/crypto/${m.symbol}`} className="mover-item">
                                    <span className="symbol">{m.symbol.replace('USDT', '')}</span>
                                    <span className="change negative">{m.changePercent.toFixed(1)}%</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Scan Results */}
            <section className="scan-results">
                <div className="section-header">
                    <h2>
                        {SCAN_MODES.find(m => m.id === selectedMode)?.name} Sonuçları
                    </h2>
                    <span className="result-count">{results.length} kripto bulundu</span>
                </div>

                {scanLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Taranıyor...</p>
                    </div>
                ) : results.length === 0 ? (
                    <div className="empty-state">
                        <Flame className="empty-icon" />
                        <p>Bu kriterlere uyan kripto bulunamadı</p>
                    </div>
                ) : (
                    <div className="results-grid">
                        <AnimatePresence>
                            {results.map((result, index) => (
                                <ScanResultCard key={result.symbol} result={result} index={index} />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </section>

            {/* Quick Stats */}
            <div className="phoenix-stats">
                <div className="stat">
                    <span className="stat-value">{scanResults?.momentum.length || 0}</span>
                    <span className="stat-label">Momentum</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{scanResults?.oversold.length || 0}</span>
                    <span className="stat-label">Aşırı Satım</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{scanResults?.breakout.length || 0}</span>
                    <span className="stat-label">Breakout</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{scanResults?.highVolume.length || 0}</span>
                    <span className="stat-label">Yüksek Hacim</span>
                </div>
            </div>
        </div>
    );
}

// Result Card Component
function ScanResultCard({ result, index }: { result: Quote; index: number }) {
    const isPositive = result.changePercent >= 0;
    const symbol = result.symbol.replace('USDT', '');

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: index * 0.03 }}
            className={`result-card ${isPositive ? 'positive' : 'negative'}`}
        >
            <div className="result-header">
                <div className="result-symbol">
                    <span className="symbol">{symbol}</span>
                    <span className="name">{result.name}</span>
                </div>
                <button className="favorite-btn">
                    <Star size={16} />
                </button>
            </div>

            <div className="result-price">
                ${result.price < 1 ? result.price.toPrecision(4) : result.price.toFixed(2)}
            </div>

            <div className={`result-change ${isPositive ? 'positive' : 'negative'}`}>
                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>{isPositive ? '+' : ''}{result.changePercent.toFixed(2)}%</span>
            </div>

            <div className="result-stats">
                <div className="stat-item">
                    <span className="label">24s Yüksek</span>
                    <span className="value">${result.high?.toFixed(2) || '-'}</span>
                </div>
                <div className="stat-item">
                    <span className="label">24s Düşük</span>
                    <span className="value">${result.low?.toFixed(2) || '-'}</span>
                </div>
            </div>

            <Link to={`/crypto/${result.symbol}`} className="result-link">
                <span>Analiz Et</span>
                <ChevronRight size={14} />
            </Link>

            <div className={`result-glow ${isPositive ? 'glow-positive' : 'glow-negative'}`}></div>
        </motion.div>
    );
}
