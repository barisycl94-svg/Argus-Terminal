import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    ArrowLeft, TrendingUp, TrendingDown, Activity,
    BarChart2, Target, AlertTriangle, Zap, Info
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    AreaChart, Area, CartesianGrid
} from 'recharts';
import { fetchCandles, fetchQuote } from '../services/apiService';
import { calculateCompositeScore, generateSignals } from '../services/analysisService';
import { getAllIndicators } from '../services/indicatorService';
import type { Candle, Signal, CompositeScore, IndicatorResult } from '../types';
import './StockDetailView.css';

export default function StockDetailView() {
    const { symbol } = useParams<{ symbol: string }>();
    const [timeframe, setTimeframe] = useState<'1mo' | '3mo' | '6mo' | '1y'>('6mo');

    // Fetch candle data
    const { data: candles = [], isLoading: candlesLoading } = useQuery({
        queryKey: ['candles', symbol, timeframe],
        queryFn: () => fetchCandles(symbol!, '1d', timeframe),
        enabled: !!symbol,
    });

    // Fetch quote
    const { data: quote } = useQuery({
        queryKey: ['quote', symbol],
        queryFn: () => fetchQuote(symbol!),
        enabled: !!symbol,
        refetchInterval: 30000,
    });

    // Calculate analysis
    const compositeScore = candles.length > 0 ? calculateCompositeScore(candles) : null;
    const signals = candles.length > 0 ? generateSignals(candles) : [];
    const indicators = candles.length > 0 ? getAllIndicators(candles) : [];

    // Prepare chart data
    const chartData = candles.map((c) => ({
        date: new Date(c.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
        price: c.close,
        volume: c.volume,
    }));

    const isPositive = quote ? quote.changePercent >= 0 : true;

    return (
        <div className="stock-detail-view">
            {/* Header */}
            <div className="detail-header">
                <Link to="/" className="back-btn">
                    <ArrowLeft size={20} />
                    <span>Geri</span>
                </Link>

                <div className="symbol-info">
                    <h1>{symbol}</h1>
                    {quote && <span className="company-name">{quote.name}</span>}
                </div>
            </div>

            {/* Price Section */}
            {quote && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="price-section"
                >
                    <div className="current-price">
                        ${quote.price.toFixed(2)}
                    </div>
                    <div className={`price-change ${isPositive ? 'positive' : 'negative'}`}>
                        {isPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                        <span>{isPositive ? '+' : ''}{quote.change.toFixed(2)}</span>
                        <span>({isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%)</span>
                    </div>
                </motion.div>
            )}

            {/* Timeframe Selector */}
            <div className="timeframe-selector">
                {(['1mo', '3mo', '6mo', '1y'] as const).map((tf) => (
                    <button
                        key={tf}
                        className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
                        onClick={() => setTimeframe(tf)}
                    >
                        {tf === '1mo' ? '1 Ay' : tf === '3mo' ? '3 Ay' : tf === '6mo' ? '6 Ay' : '1 Yıl'}
                    </button>
                ))}
            </div>

            {/* Price Chart */}
            <div className="chart-section card">
                <h3>
                    <BarChart2 size={18} />
                    Fiyat Grafiği
                </h3>
                {candlesLoading ? (
                    <div className="chart-loading">
                        <div className="spinner"></div>
                    </div>
                ) : (
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isPositive ? '#00FFA3' : '#FF2E55'} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={isPositive ? '#00FFA3' : '#FF2E55'} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#8A8F98"
                                    fontSize={11}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="#8A8F98"
                                    fontSize={11}
                                    tickLine={false}
                                    domain={['auto', 'auto']}
                                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(18, 18, 26, 0.95)',
                                        border: '1px solid rgba(0, 168, 255, 0.3)',
                                        borderRadius: '8px',
                                        color: '#fff'
                                    }}
                                    formatter={(value) => [`$${(value as number)?.toFixed(2) ?? '-'}`, 'Fiyat']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="price"
                                    stroke={isPositive ? '#00FFA3' : '#FF2E55'}
                                    strokeWidth={2}
                                    fill="url(#priceGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Composite Score */}
            {compositeScore && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`score-card card ${compositeScore.sentiment === 'buy' ? 'buy' : compositeScore.sentiment === 'sell' ? 'sell' : 'hold'}`}
                >
                    <h3>
                        <Target size={18} />
                        Kompozit Skor
                    </h3>
                    <div className="score-main">
                        <div className="score-circle">
                            <svg viewBox="0 0 120 120">
                                <circle
                                    cx="60"
                                    cy="60"
                                    r="50"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeWidth="10"
                                />
                                <circle
                                    cx="60"
                                    cy="60"
                                    r="50"
                                    fill="none"
                                    stroke={compositeScore.totalScore >= 0 ? '#00FFA3' : '#FF2E55'}
                                    strokeWidth="10"
                                    strokeDasharray={`${Math.abs(compositeScore.totalScore) * 3.14} 314`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 60 60)"
                                />
                            </svg>
                            <span className={`score-number ${compositeScore.totalScore >= 0 ? 'positive' : 'negative'}`}>
                                {compositeScore.totalScore >= 0 ? '+' : ''}{compositeScore.totalScore.toFixed(0)}
                            </span>
                        </div>
                        <div className="score-sentiment">
                            <span className="sentiment-label">Sinyal</span>
                            <span className={`sentiment-value ${compositeScore.sentiment}`}>
                                {compositeScore.sentiment === 'buy' ? 'AL' :
                                    compositeScore.sentiment === 'sell' ? 'SAT' : 'BEKLE'}
                            </span>
                        </div>
                    </div>

                    {/* Score Breakdown */}
                    <div className="score-breakdown">
                        <h4>Detay</h4>
                        <div className="breakdown-grid">
                            {Object.entries(compositeScore.breakdown).map(([name, value]) => (
                                <div key={name} className="breakdown-item">
                                    <span className="item-name">{name}</span>
                                    <span className={`item-value ${value >= 0 ? 'positive' : 'negative'}`}>
                                        {value >= 0 ? '+' : ''}{value.toFixed(0)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Indicators */}
            <div className="indicators-section card">
                <h3>
                    <Activity size={18} />
                    Teknik İndikatörler
                </h3>
                <div className="indicators-grid">
                    {indicators.filter(i => i.value !== null).slice(0, 8).map((indicator) => (
                        <div key={indicator.name} className="indicator-item">
                            <span className="indicator-name">{indicator.name}</span>
                            <span className="indicator-value">
                                {typeof indicator.value === 'number' ? indicator.value.toFixed(2) : '-'}
                            </span>
                            {indicator.signal && (
                                <span className={`indicator-signal ${indicator.signal}`}>
                                    {indicator.signal === 'buy' ? 'AL' : indicator.signal === 'sell' ? 'SAT' : 'BEKLE'}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Signals */}
            {signals.length > 0 && (
                <div className="signals-section card">
                    <h3>
                        <Zap size={18} />
                        Aktif Sinyaller
                    </h3>
                    <div className="signals-list">
                        {signals.map((signal) => (
                            <motion.div
                                key={signal.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`signal-card ${signal.action}`}
                            >
                                <div className="signal-header">
                                    <span className="signal-name">{signal.strategyName}</span>
                                    <span className={`signal-action ${signal.action}`}>
                                        {signal.action === 'buy' ? 'AL' : signal.action === 'sell' ? 'SAT' : 'BEKLE'}
                                    </span>
                                </div>
                                <p className="signal-reason">{signal.reason}</p>
                                <div className="signal-confidence">
                                    <div
                                        className="confidence-fill"
                                        style={{ width: `${signal.confidence}%` }}
                                    ></div>
                                    <span>{signal.confidence.toFixed(0)}% güven</span>
                                </div>

                                <details className="signal-details">
                                    <summary>
                                        <Info size={14} />
                                        Nasıl çalışır?
                                    </summary>
                                    <p>{signal.simplifiedExplanation}</p>
                                </details>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
