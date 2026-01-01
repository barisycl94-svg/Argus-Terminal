import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    FlaskConical, Play, TrendingUp, TrendingDown, LineChart,
    Settings, DollarSign, Percent, Target, AlertTriangle, Award, Clock
} from 'lucide-react';
import {
    LineChart as ReLineChart, Line, XAxis, YAxis, Tooltip,
    ResponsiveContainer, AreaChart, Area, CartesianGrid, ReferenceLine
} from 'recharts';
import { fetchBinanceKlines, CRYPTO_PAIRS } from '../services/binanceService';
import { runBacktest, STRATEGY_INFO, type BacktestStrategy, type BacktestResult } from '../services/backtestEngine';
import './BacktestView.css';

export default function BacktestView() {
    const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
    const [selectedStrategy, setSelectedStrategy] = useState<BacktestStrategy>('argusComposite');
    const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '4h' | '1d'>('4h');
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<BacktestResult | null>(null);

    // Config state
    const [config, setConfig] = useState({
        initialCapital: 10000,
        positionSize: 0.2,
        stopLoss: 0.05,
        takeProfit: 0.15,
        commission: 0.001,
    });

    // Fetch candle data
    const { data: candles = [], isLoading: candlesLoading } = useQuery({
        queryKey: ['backtestCandles', selectedSymbol, selectedTimeframe],
        queryFn: () => fetchBinanceKlines(selectedSymbol, selectedTimeframe, 1000),
    });

    const runBacktestHandler = async () => {
        if (candles.length === 0) return;

        setIsRunning(true);

        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 500));

        const backtestResult = runBacktest(selectedSymbol, candles, {
            ...config,
            strategy: selectedStrategy,
        });

        setResult(backtestResult);
        setIsRunning(false);
    };

    // Prepare chart data
    const equityChartData = result?.equityCurve.map((point, i) => ({
        index: i,
        date: point.date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
        equity: point.equity,
    })) || [];

    return (
        <div className="backtest-view">
            {/* Header */}
            <div className="backtest-header">
                <div className="header-left">
                    <FlaskConical className="lab-icon" />
                    <div>
                        <h1>Backtest Laboratuvarı</h1>
                        <p>Strateji performans testi</p>
                    </div>
                </div>
            </div>

            {/* Configuration Panel */}
            <div className="config-panel">
                <div className="config-section">
                    <h3>Sembol</h3>
                    <div className="symbol-grid">
                        {CRYPTO_PAIRS.slice(0, 10).map((symbol) => (
                            <button
                                key={symbol}
                                className={`symbol-btn ${selectedSymbol === symbol ? 'active' : ''}`}
                                onClick={() => setSelectedSymbol(symbol)}
                            >
                                {symbol.replace('USDT', '')}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="config-section">
                    <h3>Strateji</h3>
                    <div className="strategy-grid">
                        {Object.entries(STRATEGY_INFO).map(([key, info]) => (
                            <button
                                key={key}
                                className={`strategy-btn ${selectedStrategy === key ? 'active' : ''}`}
                                onClick={() => setSelectedStrategy(key as BacktestStrategy)}
                            >
                                <span className="strategy-name">{info.name}</span>
                                <span className="strategy-desc">{info.description}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="config-section">
                    <h3><Clock size={16} /> Zaman Dilimi</h3>
                    <div className="timeframe-grid">
                        {(['1h', '4h', '1d'] as const).map((tf) => (
                            <button
                                key={tf}
                                className={`timeframe-btn ${selectedTimeframe === tf ? 'active' : ''}`}
                                onClick={() => setSelectedTimeframe(tf)}
                            >
                                {tf === '1h' ? '1 Saat' : tf === '4h' ? '4 Saat' : '1 Gün'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="config-section">
                    <h3>Parametreler</h3>
                    <div className="params-grid">
                        <div className="param-item">
                            <label>
                                <DollarSign size={14} />
                                Başlangıç Sermayesi
                            </label>
                            <input
                                type="number"
                                value={config.initialCapital}
                                onChange={(e) => setConfig({ ...config, initialCapital: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="param-item">
                            <label>
                                <Percent size={14} />
                                Pozisyon Boyutu
                            </label>
                            <input
                                type="number"
                                step="0.05"
                                min="0.05"
                                max="1"
                                value={config.positionSize}
                                onChange={(e) => setConfig({ ...config, positionSize: parseFloat(e.target.value) || 0.2 })}
                            />
                        </div>
                        <div className="param-item">
                            <label>
                                <AlertTriangle size={14} />
                                Stop Loss
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="0.5"
                                value={config.stopLoss}
                                onChange={(e) => setConfig({ ...config, stopLoss: parseFloat(e.target.value) || 0.05 })}
                            />
                        </div>
                        <div className="param-item">
                            <label>
                                <Target size={14} />
                                Take Profit
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="1"
                                value={config.takeProfit}
                                onChange={(e) => setConfig({ ...config, takeProfit: parseFloat(e.target.value) || 0.15 })}
                            />
                        </div>
                    </div>
                </div>

                <button
                    className="run-btn"
                    onClick={runBacktestHandler}
                    disabled={isRunning || candlesLoading}
                >
                    {isRunning ? (
                        <>
                            <div className="spinner small"></div>
                            Çalışıyor...
                        </>
                    ) : (
                        <>
                            <Play size={18} />
                            Backtest Başlat
                        </>
                    )}
                </button>
            </div>

            {/* Results */}
            {result && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="results-panel"
                >
                    {/* Summary Cards */}
                    <div className="summary-grid">
                        <div className={`summary-card ${result.totalReturn >= 0 ? 'positive' : 'negative'}`}>
                            <div className="card-icon">
                                {result.totalReturn >= 0 ? <TrendingUp /> : <TrendingDown />}
                            </div>
                            <div className="card-content">
                                <span className="card-label">Toplam Getiri</span>
                                <span className="card-value">
                                    {result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toFixed(2)}
                                </span>
                                <span className="card-sub">
                                    ({result.totalReturnPercent >= 0 ? '+' : ''}{result.totalReturnPercent.toFixed(2)}%)
                                </span>
                            </div>
                        </div>

                        <div className="summary-card">
                            <div className="card-icon win-rate">
                                <Award />
                            </div>
                            <div className="card-content">
                                <span className="card-label">Kazanma Oranı</span>
                                <span className="card-value">{result.winRate.toFixed(1)}%</span>
                                <span className="card-sub">
                                    {result.winningTrades}W / {result.losingTrades}L
                                </span>
                            </div>
                        </div>

                        <div className="summary-card negative">
                            <div className="card-icon">
                                <AlertTriangle />
                            </div>
                            <div className="card-content">
                                <span className="card-label">Max Drawdown</span>
                                <span className="card-value">-{result.maxDrawdownPercent.toFixed(2)}%</span>
                                <span className="card-sub">
                                    (${result.maxDrawdown.toFixed(2)})
                                </span>
                            </div>
                        </div>

                        <div className="summary-card">
                            <div className="card-icon neutral">
                                <LineChart />
                            </div>
                            <div className="card-content">
                                <span className="card-label">Sharpe Ratio</span>
                                <span className="card-value">{result.sharpeRatio.toFixed(2)}</span>
                                <span className="card-sub">
                                    Profit Factor: {result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Equity Chart */}
                    <div className="chart-card">
                        <h3>
                            <LineChart size={18} />
                            Sermaye Eğrisi
                        </h3>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={equityChartData}>
                                    <defs>
                                        <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#00FFA3" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#00FFA3" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#8A8F98"
                                        fontSize={10}
                                        tickLine={false}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        stroke="#8A8F98"
                                        fontSize={10}
                                        tickLine={false}
                                        tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'rgba(18, 18, 26, 0.95)',
                                            border: '1px solid rgba(0, 168, 255, 0.3)',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Sermaye']}
                                    />
                                    <ReferenceLine y={config.initialCapital} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
                                    <Area
                                        type="monotone"
                                        dataKey="equity"
                                        stroke={result.totalReturn >= 0 ? '#00FFA3' : '#FF2E55'}
                                        strokeWidth={2}
                                        fill="url(#equityGradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Trade History */}
                    <div className="trades-card">
                        <h3>İşlem Geçmişi ({result.totalTrades} işlem)</h3>
                        <div className="trades-list">
                            {result.trades.slice(-20).reverse().map((trade) => (
                                <div key={trade.id} className={`trade-item ${(trade.pnl || 0) >= 0 ? 'win' : 'loss'}`}>
                                    <div className="trade-dates">
                                        <span className="entry-date">
                                            {trade.entryDate.toLocaleDateString('tr-TR')}
                                        </span>
                                        <span className="arrow">→</span>
                                        <span className="exit-date">
                                            {trade.exitDate?.toLocaleDateString('tr-TR') || '-'}
                                        </span>
                                    </div>
                                    <div className="trade-prices">
                                        <span>${trade.entryPrice.toFixed(2)}</span>
                                        <span>→</span>
                                        <span>${trade.exitPrice?.toFixed(2) || '-'}</span>
                                    </div>
                                    <div className={`trade-pnl ${(trade.pnl || 0) >= 0 ? 'positive' : 'negative'}`}>
                                        {(trade.pnl || 0) >= 0 ? '+' : ''}${trade.pnl?.toFixed(2) || '0.00'}
                                        <span className="pnl-percent">
                                            ({((trade.pnlPercent || 0) * 100).toFixed(1)}%)
                                        </span>
                                    </div>
                                    <div className="trade-reason">{trade.exitReason || trade.reason}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="stats-grid">
                        <div className="stat-item">
                            <span className="stat-label">Başlangıç</span>
                            <span className="stat-value">${config.initialCapital.toLocaleString()}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Final</span>
                            <span className="stat-value">${result.finalCapital.toFixed(2)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Ortalama Kazanç</span>
                            <span className="stat-value positive">+${result.avgWin.toFixed(2)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Ortalama Kayıp</span>
                            <span className="stat-value negative">-${result.avgLoss.toFixed(2)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Kazanan İşlem</span>
                            <span className="stat-value">{result.winningTrades}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Kaybeden İşlem</span>
                            <span className="stat-value">{result.losingTrades}</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
