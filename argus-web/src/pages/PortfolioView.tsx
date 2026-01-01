import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Wallet, TrendingUp, TrendingDown, PieChart, DollarSign,
    ArrowUpRight, ArrowDownRight, Activity, Plus, Trash2, X, Download
} from 'lucide-react';
import { fetchBinanceTickers, searchBinanceSymbols } from '../services/binanceService';
import './PortfolioView.css';

interface Position {
    symbol: string;
    quantity: number;
    avgCost: number;
}

interface Transaction {
    id: string;
    type: 'buy' | 'sell';
    symbol: string;
    quantity: number;
    price: number;
    date: Date;
}

export default function PortfolioView() {
    const [activeTab, setActiveTab] = useState<'positions' | 'history'>('positions');
    const [showAddModal, setShowAddModal] = useState(false);
    const [positions, setPositions] = useState<Position[]>(() => {
        const saved = localStorage.getItem('crypto_portfolio');
        return saved ? JSON.parse(saved) : [
            { symbol: 'BTCUSDT', quantity: 0.5, avgCost: 42000 },
            { symbol: 'ETHUSDT', quantity: 5, avgCost: 2200 },
            { symbol: 'SOLUSDT', quantity: 50, avgCost: 95 },
        ];
    });
    const [transactions, setTransactions] = useState<Transaction[]>(() => {
        const saved = localStorage.getItem('crypto_transactions');
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.map((t: any) => ({ ...t, date: new Date(t.date) }));
        }
        return [];
    });

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('crypto_portfolio', JSON.stringify(positions));
    }, [positions]);

    useEffect(() => {
        localStorage.setItem('crypto_transactions', JSON.stringify(transactions));
    }, [transactions]);

    // Fetch current prices
    const symbols = positions.map(p => p.symbol);
    const { data: quotes = [] } = useQuery({
        queryKey: ['portfolioQuotes', symbols],
        queryFn: () => fetchBinanceTickers(symbols),
        refetchInterval: 10000,
        enabled: symbols.length > 0,
    });

    // Calculate portfolio stats
    const portfolioData = positions.map(pos => {
        const quote = quotes.find(q => q.symbol === pos.symbol);
        const currentPrice = quote?.price || pos.avgCost;
        const value = pos.quantity * currentPrice;
        const cost = pos.quantity * pos.avgCost;
        const pnl = value - cost;
        const pnlPercent = cost > 0 ? ((value - cost) / cost) * 100 : 0;

        return {
            ...pos,
            name: quote?.name || pos.symbol.replace('USDT', ''),
            currentPrice,
            value,
            cost,
            pnl,
            pnlPercent,
            changePercent: quote?.changePercent || 0,
        };
    });

    const totalValue = portfolioData.reduce((sum, p) => sum + p.value, 0);
    const totalCost = portfolioData.reduce((sum, p) => sum + p.cost, 0);
    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const dayChange = portfolioData.reduce((sum, p) => sum + (p.value * p.changePercent / 100), 0);
    const dayChangePercent = totalValue > 0 ? (dayChange / totalValue) * 100 : 0;

    const addPosition = (symbol: string, quantity: number, avgCost: number) => {
        const existing = positions.find(p => p.symbol === symbol);
        if (existing) {
            // Update existing position (average cost)
            const totalQty = existing.quantity + quantity;
            const newAvgCost = ((existing.quantity * existing.avgCost) + (quantity * avgCost)) / totalQty;
            setPositions(positions.map(p =>
                p.symbol === symbol ? { ...p, quantity: totalQty, avgCost: newAvgCost } : p
            ));
        } else {
            setPositions([...positions, { symbol, quantity, avgCost }]);
        }

        // Add transaction
        setTransactions([
            { id: Date.now().toString(), type: 'buy', symbol, quantity, price: avgCost, date: new Date() },
            ...transactions
        ]);

        setShowAddModal(false);
    };

    const removePosition = (symbol: string) => {
        const pos = positions.find(p => p.symbol === symbol);
        if (pos) {
            const quote = quotes.find(q => q.symbol === symbol);
            setTransactions([
                { id: Date.now().toString(), type: 'sell', symbol, quantity: pos.quantity, price: quote?.price || pos.avgCost, date: new Date() },
                ...transactions
            ]);
        }
        setPositions(positions.filter(p => p.symbol !== symbol));
    };

    const exportPortfolio = () => {
        const data = {
            exportDate: new Date().toISOString(),
            positions: positions,
            transactions: transactions,
            summary: {
                totalValue,
                totalCost,
                totalPnl,
                totalPnlPercent,
            }
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `argus_portfolio_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const exportCSV = () => {
        const headers = ['Symbol', 'Quantity', 'Avg Cost', 'Current Price', 'Value', 'PnL', 'PnL %'];
        const rows = portfolioData.map(p => [
            p.symbol,
            p.quantity,
            p.avgCost.toFixed(4),
            p.currentPrice.toFixed(4),
            p.value.toFixed(2),
            p.pnl.toFixed(2),
            p.pnlPercent.toFixed(2) + '%'
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `argus_portfolio_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="portfolio-view">
            {/* Summary Cards */}
            <div className="summary-grid">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="summary-card main"
                >
                    <div className="card-header">
                        <Wallet className="card-icon" />
                        <span>Portföy Değeri</span>
                    </div>
                    <div className="card-value">
                        ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`card-change ${dayChangePercent >= 0 ? 'positive' : 'negative'}`}>
                        {dayChangePercent >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        <span>${Math.abs(dayChange).toFixed(2)} ({dayChangePercent >= 0 ? '+' : ''}{dayChangePercent.toFixed(2)}%)</span>
                        <span className="period">Bugün</span>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="summary-card"
                >
                    <div className="card-header">
                        <TrendingUp className={`card-icon ${totalPnl >= 0 ? 'positive' : 'negative'}`} />
                        <span>Toplam Kar/Zarar</span>
                    </div>
                    <div className={`card-value ${totalPnl >= 0 ? 'positive' : 'negative'}`}>
                        {totalPnl >= 0 ? '+' : '-'}${Math.abs(totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`card-percent ${totalPnlPercent >= 0 ? 'positive' : 'negative'}`}>
                        {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="summary-card"
                >
                    <div className="card-header">
                        <DollarSign className="card-icon cash" />
                        <span>Toplam Maliyet</span>
                    </div>
                    <div className="card-value">
                        ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="card-percent muted">
                        {positions.length} pozisyon
                    </div>
                </motion.div>
            </div>

            {/* Tab Selector */}
            <div className="tab-selector">
                <button
                    className={`tab-btn ${activeTab === 'positions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('positions')}
                >
                    <PieChart size={18} />
                    Pozisyonlar
                </button>
                <button
                    className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    <Activity size={18} />
                    İşlem Geçmişi
                </button>
            </div>

            {/* Positions */}
            {activeTab === 'positions' && (
                <div className="positions-section">
                    <div className="positions-header">
                        <h3>{positions.length} Pozisyon</h3>
                        <div className="header-actions">
                            <button className="export-btn" onClick={exportCSV} title="CSV olarak indir">
                                <Download size={16} />
                                CSV
                            </button>
                            <button className="export-btn" onClick={exportPortfolio} title="JSON olarak indir">
                                <Download size={16} />
                                JSON
                            </button>
                            <button className="add-btn" onClick={() => setShowAddModal(true)}>
                                <Plus size={18} />
                                Ekle
                            </button>
                        </div>
                    </div>

                    <div className="positions-list">
                        {portfolioData.map((position, index) => (
                            <motion.div
                                key={position.symbol}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="position-card"
                            >
                                <div className="position-main">
                                    <Link to={`/crypto/${position.symbol}`} className="position-info">
                                        <span className="position-symbol">{position.symbol.replace('USDT', '')}</span>
                                        <span className="position-name">{position.name}</span>
                                    </Link>
                                    <div className="position-value">
                                        <span className="value">${position.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        <span className="shares">{position.quantity} adet</span>
                                    </div>
                                </div>

                                <div className="position-details">
                                    <div className="detail-item">
                                        <span className="label">Ortalama Maliyet</span>
                                        <span className="value">${position.avgCost.toFixed(4)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">Güncel Fiyat</span>
                                        <span className="value">${position.currentPrice.toFixed(4)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">K/Z</span>
                                        <span className={`value ${position.pnl >= 0 ? 'positive' : 'negative'}`}>
                                            {position.pnl >= 0 ? '+' : '-'}${Math.abs(position.pnl).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="label">K/Z %</span>
                                        <span className={`value ${position.pnlPercent >= 0 ? 'positive' : 'negative'}`}>
                                            {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                                        </span>
                                    </div>
                                </div>

                                <div className="allocation-bar">
                                    <div
                                        className="allocation-fill"
                                        style={{ width: `${(position.value / totalValue) * 100}%` }}
                                    ></div>
                                    <span className="allocation-text">{((position.value / totalValue) * 100).toFixed(1)}% portföy</span>
                                </div>

                                <button
                                    className="remove-position-btn"
                                    onClick={() => removePosition(position.symbol)}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Transaction History */}
            {activeTab === 'history' && (
                <div className="history-section">
                    <h3>Son İşlemler</h3>
                    {transactions.length === 0 ? (
                        <div className="empty-history">
                            <Activity size={48} />
                            <p>Henüz işlem yok</p>
                        </div>
                    ) : (
                        <div className="history-list">
                            {transactions.slice(0, 20).map((tx) => (
                                <div key={tx.id} className={`history-item ${tx.type}`}>
                                    <div className="tx-icon">
                                        {tx.type === 'buy' ? <ArrowUpRight /> : <ArrowDownRight />}
                                    </div>
                                    <div className="tx-info">
                                        <span className="tx-action">{tx.type === 'buy' ? 'Alış' : 'Satış'}</span>
                                        <span className="tx-symbol">{tx.symbol.replace('USDT', '')}</span>
                                    </div>
                                    <div className="tx-details">
                                        <span className="tx-amount">${(tx.quantity * tx.price).toFixed(2)}</span>
                                        <span className="tx-qty">{tx.quantity} adet @ ${tx.price.toFixed(4)}</span>
                                        <span className="tx-date">{tx.date.toLocaleDateString('tr-TR')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add Position Modal */}
            {showAddModal && (
                <AddPositionModal
                    onAdd={addPosition}
                    onClose={() => setShowAddModal(false)}
                />
            )}
        </div>
    );
}

// Add Position Modal Component
function AddPositionModal({
    onAdd,
    onClose
}: {
    onAdd: (symbol: string, quantity: number, avgCost: number) => void;
    onClose: () => void;
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSymbol, setSelectedSymbol] = useState('');
    const [quantity, setQuantity] = useState('');
    const [avgCost, setAvgCost] = useState('');
    const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string }>>([]);

    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                const results = await searchBinanceSymbols(searchQuery);
                setSearchResults(results);
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const handleSubmit = () => {
        if (selectedSymbol && quantity && avgCost) {
            onAdd(selectedSymbol, parseFloat(quantity), parseFloat(avgCost));
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <motion.div
                className="modal-content"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h3>Pozisyon Ekle</h3>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>Kripto Ara</label>
                        <input
                            type="text"
                            placeholder="BTC, ETH, SOL..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value.toUpperCase())}
                            className="input"
                        />
                        {searchResults.length > 0 && (
                            <div className="search-dropdown">
                                {searchResults.map(r => (
                                    <button
                                        key={r.symbol}
                                        className="search-option"
                                        onClick={() => {
                                            setSelectedSymbol(r.symbol);
                                            setSearchQuery(r.symbol.replace('USDT', ''));
                                            setSearchResults([]);
                                        }}
                                    >
                                        <span>{r.symbol.replace('USDT', '')}</span>
                                        <span className="name">{r.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {selectedSymbol && (
                            <div className="selected-badge">
                                ✓ {selectedSymbol.replace('USDT', '')}/USDT seçildi
                            </div>
                        )}
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Miktar</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                className="input"
                                step="any"
                            />
                        </div>
                        <div className="form-group">
                            <label>Ortalama Maliyet ($)</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={avgCost}
                                onChange={e => setAvgCost(e.target.value)}
                                className="input"
                                step="any"
                            />
                        </div>
                    </div>

                    {selectedSymbol && quantity && avgCost && (
                        <div className="preview">
                            <span>Toplam Maliyet:</span>
                            <span className="amount">${(parseFloat(quantity) * parseFloat(avgCost)).toFixed(2)}</span>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>İptal</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={!selectedSymbol || !quantity || !avgCost}
                    >
                        <Plus size={16} />
                        Ekle
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
