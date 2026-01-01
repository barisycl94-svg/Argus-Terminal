import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Eye, Target, Cloud, Clock, Globe, Newspaper, Waves, Building2,
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle,
    Activity, Zap, Shield
} from 'lucide-react';
import { fetchBinanceKlines } from '../services/binanceService';
import { generateCouncilDecision } from '../services/analysisService';
import type { CouncilDecision } from '../types';
import { ARGUS_ENTITIES } from '../types';
import './CockpitView.css';

// All 7 Module Icons
const MODULE_ICONS: Record<string, any> = {
    'Orion': Target,
    'Atlas': Globe,
    'Aether': Cloud,
    'Hermes': Newspaper,
    'Chronos': Clock,
    'Poseidon': Waves,
    'Argus': Eye,
};

export default function CockpitView() {
    const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
    const [decision, setDecision] = useState<CouncilDecision | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [autoPilotEnabled, setAutoPilotEnabled] = useState(false);

    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'];

    useEffect(() => {
        analyzeSymbol(selectedSymbol);
    }, [selectedSymbol]);

    const analyzeSymbol = async (symbol: string) => {
        setIsLoading(true);
        try {
            const candles = await fetchBinanceKlines(symbol, '4h', 200);
            const result = generateCouncilDecision(candles, symbol);
            setDecision(result);
        } catch (error) {
            console.error('Analysis error:', error);
        }
        setIsLoading(false);
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'buy': return <TrendingUp className="action-icon buy" />;
            case 'sell': return <TrendingDown className="action-icon sell" />;
            default: return <Activity className="action-icon hold" />;
        }
    };

    const getActionClass = (action: string) => {
        switch (action) {
            case 'buy': return 'action-buy';
            case 'sell': return 'action-sell';
            default: return 'action-hold';
        }
    };

    return (
        <div className="cockpit-view">
            {/* Header */}
            <div className="cockpit-header">
                <div className="header-left">
                    <Eye className="argus-icon" />
                    <div>
                        <h1>Argus Konsey</h1>
                        <p>Çoklu modül analiz ve karar sistemi</p>
                    </div>
                </div>

                <div className="autopilot-toggle">
                    <span>AutoPilot</span>
                    <button
                        className={`toggle-btn ${autoPilotEnabled ? 'active' : ''}`}
                        onClick={() => setAutoPilotEnabled(!autoPilotEnabled)}
                    >
                        <Zap />
                    </button>
                </div>
            </div>

            {/* Symbol Selector */}
            <div className="symbol-selector">
                {symbols.map((symbol) => (
                    <button
                        key={symbol}
                        className={`symbol-btn ${selectedSymbol === symbol ? 'active' : ''}`}
                        onClick={() => setSelectedSymbol(symbol)}
                    >
                        {symbol.replace('USDT', '')}
                    </button>
                ))}
            </div>

            {/* Main Decision Card */}
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="loading-state"
                    >
                        <div className="spinner"></div>
                        <p>Analiz yapılıyor...</p>
                    </motion.div>
                ) : decision ? (
                    <motion.div
                        key="decision"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="decision-container"
                    >
                        {/* Main Decision */}
                        <div className={`decision-card ${getActionClass(decision.finalAction)}`}>
                            <div className="decision-header">
                                <div className="decision-symbol">{decision.symbol.replace('USDT', '')}/USDT</div>
                                <div className="decision-timestamp">
                                    {new Date(decision.timestamp).toLocaleTimeString('tr-TR')}
                                </div>
                            </div>

                            <div className="decision-main">
                                {getActionIcon(decision.finalAction)}
                                <div className="decision-action">
                                    {decision.finalAction === 'buy' ? 'AL' :
                                        decision.finalAction === 'sell' ? 'SAT' : 'BEKLE'}
                                </div>
                                <div className="confidence-ring">
                                    <svg viewBox="0 0 100 100">
                                        <circle
                                            className="ring-bg"
                                            cx="50"
                                            cy="50"
                                            r="40"
                                            fill="none"
                                            strokeWidth="8"
                                        />
                                        <circle
                                            className="ring-progress"
                                            cx="50"
                                            cy="50"
                                            r="40"
                                            fill="none"
                                            strokeWidth="8"
                                            strokeDasharray={`${decision.confidence * 2.51} 251`}
                                            transform="rotate(-90 50 50)"
                                        />
                                    </svg>
                                    <span className="confidence-value">{decision.confidence.toFixed(0)}%</span>
                                </div>
                            </div>

                            <div className="decision-score">
                                <span className="score-label">Kompozit Skor</span>
                                <span className={`score-value ${decision.overallScore >= 0 ? 'positive' : 'negative'}`}>
                                    {decision.overallScore >= 0 ? '+' : ''}{decision.overallScore.toFixed(1)}
                                </span>
                            </div>

                            {/* Oylama Dağılımı Barı */}
                            <div className="voting-distribution">
                                <div className="voting-stats">
                                    <span className="stat buy">{decision.votes.filter(v => v.direction === 'buy').length} Al</span>
                                    <span className="stat hold">{decision.votes.filter(v => v.direction === 'hold').length} Bekle</span>
                                    <span className="stat sell">{decision.votes.filter(v => v.direction === 'sell').length} Sat</span>
                                </div>
                                <div className="voting-bar">
                                    <div
                                        className="bar-segment buy"
                                        style={{ width: `${(decision.votes.filter(v => v.direction === 'buy').length / 7) * 100}%` }}
                                    ></div>
                                    <div
                                        className="bar-segment hold"
                                        style={{ width: `${(decision.votes.filter(v => v.direction === 'hold').length / 7) * 100}%` }}
                                    ></div>
                                    <div
                                        className="bar-segment sell"
                                        style={{ width: `${(decision.votes.filter(v => v.direction === 'sell').length / 7) * 100}%` }}
                                    ></div>
                                </div>
                            </div>

                            <p className="decision-reason">{decision.reason}</p>
                        </div>

                        {/* Module Votes */}
                        <div className="votes-section">
                            <h3>
                                <Building2 size={18} />
                                Modül Oyları
                            </h3>
                            <div className="votes-grid">
                                {decision.votes.map((vote, index) => {
                                    const Icon = MODULE_ICONS[vote.module] || Eye;
                                    return (
                                        <motion.div
                                            key={vote.module}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className={`vote-card ${getActionClass(vote.direction)}`}
                                        >
                                            <div className="vote-header">
                                                <Icon className="module-icon" />
                                                <span className="module-name">{vote.module}</span>
                                            </div>
                                            <div className="vote-action">
                                                {vote.direction === 'buy' ? 'AL' :
                                                    vote.direction === 'sell' ? 'SAT' : 'BEKLE'}
                                            </div>
                                            <div className="vote-score">
                                                Skor: {vote.score.toFixed(0)}
                                            </div>
                                            <div className="vote-confidence">
                                                <div
                                                    className="confidence-bar"
                                                    style={{ width: `${vote.confidence}%` }}
                                                ></div>
                                            </div>
                                            <p className="vote-reason-text">{vote.reason}</p>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Conflicts */}
                        {decision.conflicts.length > 0 && (
                            <div className="conflicts-section">
                                <h3>
                                    <AlertTriangle size={18} />
                                    Çatışmalar
                                </h3>
                                <div className="conflicts-list">
                                    {decision.conflicts.map((conflict, index) => (
                                        <div key={index} className="conflict-item">
                                            <span>{conflict.moduleA}</span>
                                            <span className="vs">vs</span>
                                            <span>{conflict.moduleB}</span>
                                            <span className="topic">{conflict.topic}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Dominant Signals */}
                        {decision.dominantSignals.length > 0 && (
                            <div className="signals-section">
                                <h3>
                                    <CheckCircle size={18} />
                                    Dominant Sinyaller
                                </h3>
                                <div className="signals-list">
                                    {decision.dominantSignals.map((signal, index) => (
                                        <span key={index} className="signal-tag">{signal}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                ) : null}
            </AnimatePresence>

            {/* Argus Entities Info - All 7 Gods */}
            <section className="entities-section">
                <h3>Argus Tanrıları ({ARGUS_ENTITIES.length - 1})</h3>
                <div className="entities-grid">
                    {ARGUS_ENTITIES.filter(e => e.id !== 'council').map((entity) => (
                        <div key={entity.id} className="entity-card" style={{ borderColor: entity.color }}>
                            <div className="entity-header" style={{ color: entity.color }}>
                                {entity.name}
                            </div>
                            <p className="entity-desc">{entity.description}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
