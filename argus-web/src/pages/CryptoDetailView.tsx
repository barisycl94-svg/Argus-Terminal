import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft, TrendingUp, TrendingDown, Activity,
    BarChart2, Target, Brain, Shield, Clock,
    AlertCircle, Zap, Info, Bell, Settings,
    Search, Filter, Play, Square, RefreshCw,
    Maximize2, Minimize2, ChevronRight, Download,
    Briefcase, PieChart, Layers, X
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, BarChart, Bar, Cell
} from 'recharts';
import { fetchBinanceKlines, fetchBinanceTicker } from '../services/binanceService';
import { calculateCompositeScore, generateCouncilDecision } from '../services/analysisService';
import { analyzeWithAthena, type AthenaResult } from '../services/athenaService';
import { calculateRiskMetrics, calculateVaR, type RiskMetrics } from '../services/chironService';
import { getAllIndicators } from '../services/indicatorService';
import { paperBuy, paperSell, getPaperPortfolio } from '../services/paperTradingService';
import { useToast } from '../components/Toast';
import OrderBook from '../components/OrderBook';
import NewsFeed from '../components/NewsFeed';
import './CryptoDetailView.css';

type Timeframe = '1h' | '4h' | '1d' | '1w';
type TabType = 'athena' | 'chiron' | 'signals';

export default function CryptoDetailView() {
    const { symbol } = useParams<{ symbol: string }>();
    const [timeframe, setTimeframe] = useState<Timeframe>('4h');
    const [activeTab, setActiveTab] = useState<TabType>('athena');
    const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);
    const [isTrading, setIsTrading] = useState(false);
    const { showToast } = useToast();

    // Fetch candle data
    const { data: candles = [], isLoading: candlesLoading } = useQuery({
        queryKey: ['cryptoCandles', symbol, timeframe],
        queryFn: () => fetchBinanceKlines(symbol!, timeframe, 200),
        enabled: !!symbol,
    });

    // Fetch ticker
    const { data: ticker } = useQuery({
        queryKey: ['cryptoTicker', symbol],
        queryFn: () => fetchBinanceTicker(symbol!),
        enabled: !!symbol,
        refetchInterval: 5000,
    });

    // Safe analysis calculations
    const analysis = useMemo(() => {
        if (candles.length < 50) {
            return {
                compositeScore: null,
                councilDecision: null,
                athena: null,
                chiron: null,
                indicators: [],
                varData: null
            };
        }
        try {
            return {
                compositeScore: calculateCompositeScore(candles),
                councilDecision: generateCouncilDecision(candles, symbol || ''),
                athena: analyzeWithAthena(symbol || '', candles),
                chiron: calculateRiskMetrics(symbol || '', candles),
                indicators: getAllIndicators(candles),
                varData: calculateVaR(candles)
            };
        } catch (error) {
            console.error('Analysis error:', error);
            return {
                compositeScore: null,
                councilDecision: null,
                athena: null,
                chiron: null,
                indicators: [],
                varData: null
            };
        }
    }, [candles, symbol]);

    // Prepare chart data
    const chartData = useMemo(() => {
        return candles.map((c) => ({
            date: new Date(c.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric', hour: '2-digit' }),
            price: c.close,
            open: c.open,
            high: c.high,
            low: c.low,
            volume: c.volume
        }));
    }, [candles]);

    const isPositive = ticker ? ticker.changePercent >= 0 : true;
    const displaySymbol = symbol?.replace('USDT', '') || '';

    const formatPrice = (price: number) => {
        if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (price >= 1) return price.toFixed(2);
        if (price >= 0.01) return price.toFixed(4);
        return price.toFixed(6);
    };

    const handleManualBuy = async () => {
        if (!symbol) return;
        setIsTrading(true);
        try {
            const trade = await paperBuy(symbol, 1000, 'Manuel Alış (Detail View)', 100);
            if (trade) {
                showToast('success', 'Alış İşlemi Başarılı', `${symbol} için $1,000 tutarında alım yapıldı.`);
            } else {
                showToast('error', 'İşlem Başarısız', 'Yetersiz bakiye veya piyasa kapalı.');
            }
        } catch (e) {
            showToast('error', 'Hata', 'İşlem sırasında bir hata oluştu.');
        }
        setIsTrading(false);
    };

    const handleManualSell = async () => {
        if (!symbol) return;
        setIsTrading(true);
        try {
            const trade = await paperSell(symbol, undefined, 'Manuel Satış (Detail View)');
            if (trade) {
                showToast('success', 'Satış İşlemi Başarılı', `${symbol} pozisyonu kapatıldı.`);
            } else {
                showToast('error', 'İşlem Başarısız', 'Açık pozisyon bulunamadı.');
            }
        } catch (e) {
            showToast('error', 'Hata', 'İşlem sırasında bir hata oluştu.');
        }
        setIsTrading(false);
    };

    if (!symbol) {
        return <div className="crypto-detail-view"><p>Sembol bulunamadı</p></div>;
    }

    return (
        <div className="crypto-detail-view">
            {/* Header */}
            <div className="detail-header">
                <div className="header-top">
                    <Link to="/" className="back-button">
                        <ArrowLeft size={20} />
                        <span>Geri</span>
                    </Link>
                    <div className="header-actions">
                        <button className="icon-btn" title="Alarm Kur" onClick={() => setIsAlarmModalOpen(true)}>
                            <Bell size={18} />
                        </button>
                        <button className="icon-btn" title="Ayarlar"><Settings size={18} /></button>
                    </div>
                </div>

                <div className="symbol-main">
                    <div className="symbol-info">
                        <h1>{displaySymbol}<span className="pair">/USDT</span></h1>
                        <p className="crypto-name">{displaySymbol} Protocol Trading Node</p>
                    </div>
                    {ticker && (
                        <div className="price-display">
                            <div className="price-value">
                                <span className="currency">$</span>
                                <span className="amount">{formatPrice(ticker.price)}</span>
                            </div>
                            <div className={`price-change ${isPositive ? 'positive' : 'negative'}`}>
                                {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                <span>{isPositive ? '+' : ''}{ticker.changePercent.toFixed(2)}%</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="quick-info-bars">
                    <div className="info-bar">
                        <span className="label">24s Yüksek</span>
                        <span className="value">${formatPrice(ticker?.high || 0)}</span>
                    </div>
                    <div className="info-bar">
                        <span className="label">24s Düşük</span>
                        <span className="value">${formatPrice(ticker?.low || 0)}</span>
                    </div>
                    <div className="info-bar">
                        <span className="label">Hacim</span>
                        <span className="value">${(ticker?.volume || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    </div>
                </div>
            </div>

            <div className="detail-layout">
                <div className="main-content">
                    {/* Primary Chart */}
                    <div className="chart-container card neon-border">
                        <div className="card-header">
                            <div className="title-group">
                                <BarChart2 size={18} className="gold-text" />
                                <h3>Canlı Fiyat Grafiği</h3>
                            </div>
                            <div className="timeframe-selector">
                                {(['1h', '4h', '1d', '1w'] as Timeframe[]).map((tf) => (
                                    <button
                                        key={tf}
                                        className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
                                        onClick={() => setTimeframe(tf)}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="chart-wrapper">
                            {candlesLoading ? (
                                <div className="loading-spinner">
                                    <div className="pulse"></div>
                                    <span>Veriler taranıyor...</span>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={350}>
                                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={isPositive ? "#00ff9d" : "#ff2e55"} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={isPositive ? "#00ff9d" : "#ff2e55"} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#444"
                                            tick={{ fill: '#666', fontSize: 10 }}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            stroke="#444"
                                            tick={{ fill: '#666', fontSize: 10 }}
                                            domain={['dataMin', 'dataMax']}
                                            axisLine={false}
                                            orientation="right"
                                            width={60}
                                            tickFormatter={(val) => val.toFixed(val < 1 ? 5 : 2)}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'rgba(10, 10, 20, 0.9)',
                                                border: '1px solid var(--gold)',
                                                borderRadius: '8px',
                                                backdropFilter: 'blur(10px)'
                                            }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="price"
                                            stroke={isPositive ? "#00ff9d" : "#ff2e55"}
                                            fill="url(#priceGradient)"
                                            strokeWidth={3}
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Analysis Tabs */}
                    <div className="tabs-container card">
                        <div className="tabs-header">
                            <button
                                className={`tab-btn ${activeTab === 'athena' ? 'active' : ''}`}
                                onClick={() => setActiveTab('athena')}
                            >
                                <Brain size={18} />
                                <span>Athena Faktörleri</span>
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'chiron' ? 'active' : ''}`}
                                onClick={() => setActiveTab('chiron')}
                            >
                                <Shield size={18} />
                                <span>Chiron Risk Ağı</span>
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'signals' ? 'active' : ''}`}
                                onClick={() => setActiveTab('signals')}
                            >
                                <Zap size={18} />
                                <span>Teknik Sinyaller</span>
                            </button>
                        </div>

                        <div className="tab-content">
                            {activeTab === 'athena' && analysis.athena && (
                                <div className="athena-view">
                                    <div className="athena-summary">
                                        <div className="score-circle">
                                            <svg viewBox="0 0 100 100">
                                                <circle className="bg" cx="50" cy="50" r="45" />
                                                <circle
                                                    className={`progress ${analysis.athena.sentiment}`}
                                                    cx="50" cy="50" r="45"
                                                    style={{ strokeDasharray: `${analysis.athena.overallScore * 2.8}, 283` }}
                                                />
                                            </svg>
                                            <div className="score-text">
                                                <span className="val">{analysis.athena.overallScore.toFixed(0)}</span>
                                                <span className="lbl">ATHENA</span>
                                            </div>
                                        </div>
                                        <div className="recommendation-box">
                                            <div className={`sentiment-badge ${analysis.athena.sentiment}`}>
                                                {analysis.athena.sentiment.replace('_', ' ').toUpperCase()}
                                            </div>
                                            <p>{analysis.athena.recommendation}</p>
                                        </div>
                                    </div>
                                    <div className="factors-grid">
                                        {analysis.athena.factors.map((f, i) => (
                                            <div key={i} className={`factor-card ${f.signal}`}>
                                                <div className="f-header">
                                                    <span className="f-name">{f.name}</span>
                                                    <span className={`f-signal ${f.signal}`}>{f.signal.toUpperCase()}</span>
                                                </div>
                                                <div className="f-bar">
                                                    <div className="f-fill" style={{ width: `${f.value}%` }}></div>
                                                </div>
                                                <span className="f-desc">{f.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'chiron' && analysis.chiron && (
                                <div className="chiron-view">
                                    <div className="risk-meters">
                                        <div className="risk-card">
                                            <span className="label">Risk Skoru</span>
                                            <span className={`value ${analysis.chiron.riskScore > 70 ? 'extreme' : analysis.chiron.riskScore > 50 ? 'high' : 'safe'}`}>
                                                {analysis.chiron.riskScore.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="risk-card">
                                            <span className="label">Volatilite</span>
                                            <span className="value">{analysis.chiron.volatilityScore.toFixed(1)}%</span>
                                        </div>
                                        <div className="risk-card">
                                            <span className="label">Maks. Kaldıraç</span>
                                            <span className="value">{analysis.chiron.maxLeverage}x</span>
                                        </div>
                                        <div className="risk-card">
                                            <span className="label">Pozisyon Boyutu</span>
                                            <span className="value">%{analysis.chiron.positionSizeRecommendation}</span>
                                        </div>
                                    </div>
                                    <div className="risk-strategy">
                                        <div className="strategy-box">
                                            <h4><Target size={16} /> Önerilen Seviyeler</h4>
                                            <div className="levels">
                                                <div className="level-item tp">
                                                    <span className="lbl">Take Profit</span>
                                                    <span className="val">%{analysis.chiron.takeProfitRecommendation.toFixed(1)}</span>
                                                </div>
                                                <div className="level-item sl">
                                                    <span className="lbl">Stop Loss</span>
                                                    <span className="val">%{analysis.chiron.stopLossRecommendation.toFixed(1)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="insights-box">
                                            <h4><Info size={16} /> Chiron Analizleri</h4>
                                            <ul>
                                                {analysis.chiron.insights.map((ins, i) => <li key={i}>{ins}</li>)}
                                                {analysis.chiron.warnings.map((warn, i) => <li key={i} className="warning">{warn}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'signals' && (
                                <div className="signals-view">
                                    <div className="indicators-list">
                                        {analysis.indicators.map((ind, i) => (
                                            <div key={i} className="indicator-row">
                                                <span className="name">{ind.name}</span>
                                                <div className="value-group">
                                                    <span className="val">{typeof ind.value === 'number' ? ind.value.toFixed(2) : '-'}</span>
                                                    {ind.signal && (
                                                        <span className={`sig-badge ${ind.signal}`}>{ind.signal.toUpperCase()}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Council Discussion */}
                    <div className="council-section card">
                        <div className="section-header">
                            <Shield size={20} className="gold-text" />
                            <h3>Argus Konseyi Tartışması</h3>
                        </div>
                        {analysis.councilDecision ? (
                            <div className="council-content">
                                <div className="decision-summary-box">
                                    <div className={`final-action ${analysis.councilDecision.finalAction}`}>
                                        {analysis.councilDecision.finalAction === 'buy' ? 'GÜÇLÜ AL' : analysis.councilDecision.finalAction === 'sell' ? 'GÜÇLÜ SAT' : 'TARAFSIZ'}
                                    </div>
                                    <div className="confidence-meter">
                                        <div className="meter-label">Konsey Güveni: %{analysis.councilDecision.confidence.toFixed(0)}</div>
                                        <div className="meter-bar">
                                            <div className="meter-fill" style={{ width: `${analysis.councilDecision.confidence}%` }}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Votes Grid */}
                                <div className="votes-detailed-grid">
                                    {analysis.councilDecision.votes.map((vote, i) => (
                                        <div key={i} className={`mini-vote-card ${vote.direction}`}>
                                            <div className="v-head">
                                                <span className="v-name">{vote.module}</span>
                                                <span className={`v-dir ${vote.direction}`}>
                                                    {vote.direction === 'buy' ? 'AL' : vote.direction === 'sell' ? 'SAT' : 'BEKLE'}
                                                </span>
                                            </div>
                                            <p className="v-reason">"{vote.reason}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="loading-council">Tanrılar karar veriyor...</div>
                        )}
                    </div>
                </div>

                <div className="sidebar">
                    {/* Quick Trade Panel */}
                    <div className="trade-panel card glass">
                        <h3>Hızlı İşlem</h3>
                        <div className="trade-actions">
                            <button
                                className="trade-btn buy"
                                onClick={handleManualBuy}
                                disabled={isTrading}
                            >
                                {isTrading ? '...' : 'AL'}
                            </button>
                            <button
                                className="trade-btn sell"
                                onClick={handleManualSell}
                                disabled={isTrading}
                            >
                                {isTrading ? '...' : 'SAT'}
                            </button>
                        </div>
                        <div className="balance-info">
                            <span>Bakiye:</span>
                            <span>$12,450.00</span>
                        </div>
                    </div>

                    {/* Order Book */}
                    <div className="sidebar-card card">
                        <OrderBook symbol={symbol} />
                    </div>

                    {/* News Feed */}
                    <div className="sidebar-card card">
                        <NewsFeed symbol={symbol} />
                    </div>

                    {/* Active Alerts */}
                    <div className="sidebar-card card">
                        <div className="card-header">
                            <Bell size={18} />
                            <h3>Aktif Alarmlar</h3>
                        </div>
                        <div className="alert-list">
                            <div className="alert-item">
                                <span className="label">Fiyat {'>'} $105,000</span>
                                <time>2dk önce</time>
                            </div>
                            <div className="alert-item">
                                <span className="label">RSI {'<'} 30</span>
                                <time>1s önce</time>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Alarm Modal Overlay */}
            {isAlarmModalOpen && (
                <div className="modal-overlay" onClick={() => setIsAlarmModalOpen(false)}>
                    <div className="alarm-modal card neon-border" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Bell size={20} className="gold-text" /> Fiyat Alarmı Kur</h3>
                            <button className="close-btn" onClick={() => setIsAlarmModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="alarm-symbol">
                                <span>{displaySymbol}</span>
                                <span className="current-price-small">${formatPrice(ticker?.price || 0)}</span>
                            </div>
                            <div className="alarm-form">
                                <div className="form-group">
                                    <label>Koşul</label>
                                    <div className="condition-btns">
                                        <button className="condition-btn active">Fiyat {'>'}</button>
                                        <button className="condition-btn">Fiyat {'<'}</button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Hedef Fiyat ($)</label>
                                    <input type="number" placeholder={ticker?.price.toString()} />
                                </div>
                                <div className="form-group">
                                    <label>Alarm Notu</label>
                                    <input type="text" placeholder="Fiyat hedefe ulaştı!" />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={() => setIsAlarmModalOpen(false)}>İptal</button>
                            <button className="confirm-btn">Alarmı Kaydet</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


