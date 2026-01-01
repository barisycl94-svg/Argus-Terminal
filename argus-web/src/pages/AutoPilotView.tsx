import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Zap, Play, Square, RefreshCw, DollarSign, TrendingUp, TrendingDown,
    Activity, Target, AlertTriangle, Settings, BarChart2, Clock,
    Wallet, ArrowUpRight, ArrowDownRight, Percent
} from 'lucide-react';
import {
    initializePaperPortfolio,
    resetPaperPortfolio,
    getPaperPortfolio,
    startAutoPilot,
    stopAutoPilot,
    getAutoPilotStatus,
    getAutoPilotConfig,
    updateAutoPilotConfig,
    calculatePortfolioValue,
    getPerformanceStats,
    subscribeToPaperPortfolio,
    type PaperPortfolio,
    type PaperTrade,
} from '../services/paperTradingService';
import './AutoPilotView.css';

export default function AutoPilotView() {
    const [portfolio, setPortfolio] = useState<PaperPortfolio | null>(null);
    const [status, setStatus] = useState(getAutoPilotStatus());
    const [config, setConfig] = useState(getAutoPilotConfig());
    const [portfolioValue, setPortfolioValue] = useState({
        totalValue: 0,
        cash: 0,
        positionsValue: 0,
        pnl: 0,
        pnlPercent: 0,
    });
    const [stats, setStats] = useState(getPerformanceStats());
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        // Load or initialize portfolio
        let p = getPaperPortfolio();
        if (!p) {
            p = initializePaperPortfolio(10000);
        }
        setPortfolio(p);

        // Subscribe to updates
        const unsubscribe = subscribeToPaperPortfolio((updated) => {
            setPortfolio({ ...updated });
            updateValues();
        });

        // Initial value calculation
        updateValues();

        // Update values every 10 seconds
        const interval = setInterval(updateValues, 10000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, []);

    const updateValues = async () => {
        const value = await calculatePortfolioValue();
        setPortfolioValue(value);
        setStats(getPerformanceStats());
        setStatus(getAutoPilotStatus());
    };

    const handleStartStop = () => {
        if (status.isRunning) {
            stopAutoPilot();
        } else {
            startAutoPilot(config);
        }
        setStatus(getAutoPilotStatus());
    };

    const handleReset = () => {
        // if (confirm('Portföy sıfırlanacak ve tüm işlem geçmişi silinecek. Emin misiniz?')) {
        stopAutoPilot();
        resetPaperPortfolio(10000);
        const newPortfolio = getPaperPortfolio();
        setPortfolio(newPortfolio ? { ...newPortfolio } : null);
        updateValues();
        // }
    };

    const handleConfigChange = (key: string, value: number) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);
        updateAutoPilotConfig(newConfig);
    };

    const positions = portfolio ? Array.from(portfolio.positions.entries()) : [];
    const recentTrades = portfolio?.trades.slice(-10).reverse() || [];

    // Calculate Unrealized PnL from open positions
    const unrealizedPnL = portfolioValue.positionDetails
        ? portfolioValue.positionDetails.reduce((acc, pos) => acc + pos.pnl, 0)
        : 0;

    return (
        <div className="autopilot-view">
            {/* Header */}
            <div className="autopilot-header">
                <div className="header-info">
                    <Zap className={`header-icon ${status.isRunning ? 'active' : ''}`} />
                    <div>
                        <h1>AutoPilot</h1>
                        <p>Paper Trading Simülasyonu</p>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className={`action-btn ${status.isRunning ? 'stop' : 'start'}`}
                        onClick={handleStartStop}
                    >
                        {status.isRunning ? (
                            <><Square size={18} /> Durdur</>
                        ) : (
                            <><Play size={18} /> Başlat</>
                        )}
                    </button>
                    <button className="action-btn secondary" onClick={handleReset}>
                        <RefreshCw size={18} />
                        Sıfırla
                    </button>
                    <button
                        className="action-btn secondary"
                        onClick={() => setShowSettings(!showSettings)}
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            {/* Status Banner */}
            <div className={`status-banner ${status.isRunning ? 'running' : 'stopped'}`}>
                <Activity className="status-icon" />
                <span className="status-text">
                    {status.isRunning ? 'AutoPilot aktif olarak çalışıyor' : 'AutoPilot durdu'}
                </span>
                {status.isRunning && (
                    <span className="scan-info">
                        Her {config.scanIntervalMs / 1000}s taranıyor
                    </span>
                )}
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="settings-panel"
                >
                    <h3><Settings size={18} /> AutoPilot Ayarları</h3>
                    <p className="settings-info">
                        7 Argus modülü (Orion, Atlas, Aether, Hermes, Chronos, Poseidon, Argus) analiz ediyor
                    </p>
                    <div className="settings-grid">
                        <div className="setting-item">
                            <label>Max Pozisyon</label>
                            <input
                                type="number"
                                value={config.maxPositions}
                                onChange={(e) => handleConfigChange('maxPositions', parseInt(e.target.value))}
                                min={1}
                                max={20}
                            />
                        </div>
                        <div className="setting-item">
                            <label>Pozisyon Boyutu (%)</label>
                            <input
                                type="number"
                                value={config.positionSizePercent}
                                onChange={(e) => handleConfigChange('positionSizePercent', parseInt(e.target.value))}
                                min={1}
                                max={50}
                            />
                        </div>
                        <div className="setting-item">
                            <label>Dinamik SL/TP</label>
                            <button
                                className={`toggle-btn ${config.useDynamicSLTP ? 'active' : ''}`}
                                onClick={() => handleConfigChange('useDynamicSLTP', config.useDynamicSLTP ? 0 : 1)}
                            >
                                {config.useDynamicSLTP ? 'Aktif (ATR)' : 'Kapalı'}
                            </button>
                        </div>
                        <div className="setting-item">
                            <label>Stop-Loss (%)</label>
                            <input
                                type="number"
                                value={config.stopLossPercent}
                                onChange={(e) => handleConfigChange('stopLossPercent', parseInt(e.target.value))}
                                min={1}
                                max={50}
                                disabled={config.useDynamicSLTP}
                            />
                        </div>
                        <div className="setting-item">
                            <label>Take-Profit (%)</label>
                            <input
                                type="number"
                                value={config.takeProfitPercent}
                                onChange={(e) => handleConfigChange('takeProfitPercent', parseInt(e.target.value))}
                                min={1}
                                max={100}
                                disabled={config.useDynamicSLTP}
                            />
                        </div>
                        <div className="setting-item">
                            <label>Min Güven (%)</label>
                            <input
                                type="number"
                                value={config.minConfidence}
                                onChange={(e) => handleConfigChange('minConfidence', parseInt(e.target.value))}
                                min={30}
                                max={100}
                            />
                        </div>
                        <div className="setting-item">
                            <label>Tarama Aralığı (sn)</label>
                            <input
                                type="number"
                                value={config.scanIntervalMs / 1000}
                                onChange={(e) => handleConfigChange('scanIntervalMs', parseInt(e.target.value) * 1000)}
                                min={10}
                                max={300}
                            />
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Portfolio Summary */}
            <div className="summary-grid">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="summary-card main"
                >
                    <div className="card-header">
                        <Wallet size={20} />
                        <span>Toplam Değer</span>
                    </div>
                    <div className="card-value">
                        ${portfolioValue.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`card-change ${portfolioValue.pnl >= 0 ? 'positive' : 'negative'}`}>
                        {portfolioValue.pnl >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        <span>
                            {portfolioValue.pnl >= 0 ? '+' : ''}${portfolioValue.pnl.toFixed(2)} ({portfolioValue.pnlPercent.toFixed(2)}%)
                        </span>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="summary-card"
                >
                    <div className="card-header">
                        <DollarSign size={20} />
                        <span>Nakit</span>
                    </div>
                    <div className="card-value">
                        ${portfolioValue.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="card-sub">
                        {((portfolioValue.cash / portfolioValue.totalValue) * 100 || 0).toFixed(1)}% portföy
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="summary-card"
                >
                    <div className="card-header">
                        <Target size={20} />
                        <span>Açık Pozisyonlar</span>
                    </div>
                    <div className="card-value">{positions.length}</div>
                    <div className="card-sub">
                        <span className={unrealizedPnL >= 0 ? 'positive-text' : 'negative-text'} style={{ fontWeight: 'bold' }}>
                            {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}
                        </span>
                        {' '} (Açık K/Z)
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="summary-card"
                >
                    <div className="card-header">
                        <Percent size={20} />
                        <span>Win Rate</span>
                    </div>
                    <div className={`card-value ${(stats?.winRate || 0) >= 50 ? 'positive' : 'negative'}`}>
                        {(stats?.winRate || 0).toFixed(1)}%
                    </div>
                    <div className="card-sub">
                        {stats?.winners || 0}W / {stats?.losers || 0}L
                    </div>
                </motion.div>
            </div>

            {/* Performance Stats */}
            {stats && stats.totalTrades > 0 && (
                <div className="performance-section">
                    <h3><BarChart2 size={18} /> Performans İstatistikleri</h3>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <span className="stat-label">Toplam İşlem</span>
                            <span className="stat-value">{stats.totalTrades}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Toplam K/Z</span>
                            <span className={`stat-value ${stats.totalPnl >= 0 ? 'positive' : 'negative'}`}>
                                {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Ort. Kazanç</span>
                            <span className="stat-value positive">+${stats.avgWin.toFixed(2)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Ort. Kayıp</span>
                            <span className="stat-value negative">${stats.avgLoss.toFixed(2)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Profit Factor</span>
                            <span className="stat-value">{stats.profitFactor.toFixed(2)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">En Büyük Kazanç</span>
                            <span className="stat-value positive">+${stats.largestWin.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Open Positions */}
            <div className="positions-section">
                <h3><Target size={18} /> Açık Pozisyonlar</h3>
                {portfolioValue.positionDetails && portfolioValue.positionDetails.length > 0 ? (
                    <div className="positions-list">
                        {portfolioValue.positionDetails.map((pos) => (
                            <Link
                                key={pos.symbol}
                                to={`/crypto/${pos.symbol}`}
                                className="position-card"
                            >
                                <div className="position-info-group">
                                    <div className="position-symbol">
                                        {pos.symbol.replace('USDT', '')}
                                        <span className="pair">/USDT</span>
                                    </div>
                                    <div className="position-side">
                                        <span className="badge long">LONG</span>
                                    </div>
                                </div>

                                <div className="position-details">
                                    <div className="detail-row">
                                        <span className="label">Miktar:</span>
                                        <span className="value">{pos.quantity.toFixed(6)}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="label">Ort. Maliyet:</span>
                                        <span className="value">${pos.avgCost.toFixed(4)}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="label">Anlık Fiyat:</span>
                                        <span className="value highlight">${pos.currentPrice.toFixed(4)}</span>
                                    </div>
                                </div>

                                <div className="position-pnl-group">
                                    <div className="position-value">
                                        ${pos.currentValue.toFixed(2)}
                                    </div>
                                    <div className={`position-pnl ${pos.pnl >= 0 ? 'positive' : 'negative'}`}>
                                        {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)} ({pos.pnlPercent.toFixed(2)}%)
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : positions.length > 0 ? (
                    // Fallback for when details aren't ready yet but positions exist
                    <div className="positions-list">
                        {positions.map(([symbol, position]) => (
                            <Link key={symbol} to={`/crypto/${symbol}`} className="position-card">
                                <div className="position-symbol">
                                    {symbol.replace('USDT', '')}
                                    <span className="pair">/USDT</span>
                                </div>
                                <div className="position-details">
                                    <span className="qty">{position.quantity.toFixed(6)}</span>
                                    <span className="cost">@ ${position.avgCost.toFixed(4)}</span>
                                </div>
                                <div className="position-value">
                                    ${(position.quantity * position.avgCost).toFixed(2)}
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <Activity size={48} />
                        <p>Açık pozisyon yok</p>
                        {!status.isRunning && <p className="hint">AutoPilot'u başlatarak otomatik işlem yaptırın</p>}
                    </div>
                )}
            </div>

            {/* Recent Trades */}
            <div className="trades-section">
                <h3><Clock size={18} /> Son İşlemler</h3>
                {recentTrades.length === 0 ? (
                    <div className="empty-state small">
                        <p>Henüz işlem yapılmadı</p>
                    </div>
                ) : (
                    <div className="trades-list">
                        {recentTrades.map((trade) => (
                            <div
                                key={trade.id}
                                className={`trade-card ${trade.type}`}
                            >
                                <div className={`trade-type ${trade.type}`}>
                                    {trade.type === 'buy' ? <ArrowUpRight /> : <ArrowDownRight />}
                                </div>
                                <div className="trade-info">
                                    <span className="trade-symbol">{trade.symbol.replace('USDT', '')}</span>
                                    <span className="trade-time">
                                        {new Date(trade.entryTime).toLocaleString('tr-TR')}
                                    </span>
                                </div>
                                <div className="trade-details">
                                    <span className="trade-price">
                                        {trade.quantity.toFixed(4)} @ ${trade.entryPrice.toFixed(4)}
                                    </span>
                                    {trade.pnl !== undefined && (
                                        <span className={`trade-pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
                                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                                <div className="trade-reason">{trade.reason}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Warning */}
            <div className="warning-banner">
                <AlertTriangle size={18} />
                <p>
                    <strong>Paper Trading:</strong> Bu simülasyon gerçek para kullanmaz.
                    Tüm işlemler sanal olup eğitim amaçlıdır.
                </p>
            </div>
        </div>
    );
}
