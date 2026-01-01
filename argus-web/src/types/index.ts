// ===================================
// ARGUS TERMINAL - Type Definitions
// ===================================

// Signal Actions
export type SignalAction = 'buy' | 'sell' | 'hold' | 'wait' | 'skip';

// Market Regime
export type MarketRegime = 'trending' | 'ranging' | 'unknown';

// Trade Source
export type TradeSource = 'user' | 'autopilot';

// AutoPilot Engine Types
export type AutoPilotEngine = 'corse' | 'pulse' | 'shield' | 'hermes' | 'manual';

// Argus System Entities (Gods/Modules)
export interface ArgusEntity {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
}

export const ARGUS_ENTITIES: ArgusEntity[] = [
  { id: 'argus', name: 'Argus', color: '#00A8FF', icon: 'eye', description: 'Sistemin beyni; Tüm verileri gören dev. Temel analiz, haber akışı ve makro verileri birleştirerek karar verir.' },
  { id: 'aether', name: 'Aether', color: '#00FFFF', icon: 'cloud', description: 'Piyasa Atmosferi; Makroekonomik iklimi (VIX, Faizler, DXY) koklar.' },
  { id: 'orion', name: 'Orion', color: '#8E2DE2', icon: 'target', description: 'Avcı; Teknik analizin ustasıdır. Trendleri, formasyonları ve momentumu hesaplar.' },
  { id: 'chronos', name: 'Chronos', color: '#FF9500', icon: 'clock', description: 'Zaman Yolcusu; Geçmiş veriler üzerinde stratejileri test eder (Backtest).' },
  { id: 'atlas', name: 'Atlas', color: '#4A00E0', icon: 'globe', description: 'Değerleme Uzmanı; Şirketlerin bilançolarını, nakit akışlarını ve adil değerini hesaplar.' },
  { id: 'hermes', name: 'Hermes', color: '#FF69B4', icon: 'newspaper', description: 'Haberci; Sosyal medya, kap bildirimleri ve flaş haberleri ışık hızında tarar.' },
  { id: 'poseidon', name: 'Poseidon', color: '#00CED1', icon: 'waves', description: 'Balina Dedektifi; Derin sulardaki büyük oyuncuların hareketlerini izler.' },
  { id: 'council', name: 'Konsey', color: '#FFD700', icon: 'building', description: 'Karar Merkezi. Tüm modüllerin oylarını toplar, çelişkileri çözer ve nihai karar verir.' },
];

// Candle/OHLCV Data
export interface Candle {
  id: string;
  date: Date | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Quote / Price Data
export interface Quote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  peRatio?: number;
  eps?: number;
  sector?: string;
  previousClose?: number;
  timestamp?: Date;
}

// Macro Data (VIX, Bonds, DXY)
export interface MacroData {
  vix: number;
  bond10y: number;
  bond2y: number;
  dxy: number;
  date: Date;
}

// Trading Signal
export interface Signal {
  id: string;
  strategyName: string;
  action: SignalAction;
  confidence: number; // 0-100
  reason: string;
  indicatorValues: Record<string, string>;
  logic: string;
  successContext: string;
  simplifiedExplanation: string;
  date: Date;
}

// Composite Score (from all indicators)
export interface CompositeScore {
  id: string;
  totalScore: number; // -100 to +100
  breakdown: Record<string, number>;
  sentiment: SignalAction;
}

// Trade Record
export interface Trade {
  id: string;
  symbol: string;
  entryPrice: number;
  quantity: number;
  entryDate: Date;
  isOpen: boolean;
  exitPrice?: number;
  exitDate?: Date;
  source: TradeSource;
  engine?: AutoPilotEngine;
  stopLoss?: number;
  takeProfit?: number;
  highWaterMark?: number;
  rationale?: string;
  profit?: number;
  profitPercentage?: number;
}

// Transaction History
export type TransactionType = 'buy' | 'sell' | 'attempt';

export interface Transaction {
  id: string;
  type: TransactionType;
  symbol: string;
  amount: number;
  price: number;
  date: Date;
  fee?: number;
  pnl?: number;
  pnlPercent?: number;
}

// Watchlist Item
export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  score?: number;
  signal?: SignalAction;
  addedAt: Date;
}

// Module Vote (Council Decision)
export interface ModuleVote {
  module: string;
  score: number;
  direction: SignalAction;
  confidence: number;
  reason?: string;
}

// Council Decision
export interface CouncilDecision {
  id: string;
  symbol: string;
  timestamp: Date;
  finalAction: SignalAction;
  overallScore: number;
  confidence: number;
  votes: ModuleVote[];
  conflicts: Array<{
    moduleA: string;
    moduleB: string;
    topic: string;
    severity: number;
  }>;
  dominantSignals: string[];
  reason: string;
}

// Portfolio Item
export interface PortfolioItem {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  allocation: number; // Portfolio percentage
}

// Portfolio Summary
export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  cash: number;
  positions: PortfolioItem[];
  dayChange: number;
  dayChangePercent: number;
}

// Backtest Result
export interface BacktestResult {
  id: string;
  symbol: string;
  strategy: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnPercent: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  maxDrawdown: number;
  sharpeRatio?: number;
  trades: Trade[];
}

// Technical Indicator Result
export interface IndicatorResult {
  name: string;
  value: number | null;
  signal?: SignalAction;
  interpretation?: string;
}

// Market Status
export interface MarketStatus {
  isOpen: boolean;
  nextOpen?: Date;
  nextClose?: Date;
  session: 'pre-market' | 'regular' | 'after-hours' | 'closed';
}

// News Item
export interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  url: string;
  source: string;
  publishedAt: Date;
  sentiment?: 'positive' | 'negative' | 'neutral';
  symbols?: string[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

// Settings
export interface TradingGuardsConfig {
  maxDailyTrades: number;
  maxRiskScoreForBuy: number;
  portfolioConcentrationLimit: number;
  minTimeBetweenTradesSameSymbol: number; // seconds
  minHoldTime: number; // seconds
  cooldownAfterSell: number; // seconds
}

// App State
export interface AppState {
  selectedSymbol: string | null;
  activeTab: number;
  autoPilotEnabled: boolean;
  autoPilotEngine: AutoPilotEngine;
  theme: 'dark' | 'light';
  language: 'tr' | 'en';
}
