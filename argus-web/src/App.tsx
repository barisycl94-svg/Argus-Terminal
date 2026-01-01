import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import MarketView from './pages/MarketView';
import CockpitView from './pages/CockpitView';
import PortfolioView from './pages/PortfolioView';
import SettingsView from './pages/SettingsView';
import PhoenixView from './pages/PhoenixView';
import BacktestView from './pages/BacktestView';
import CryptoDetailView from './pages/CryptoDetailView';
import AutoPilotView from './pages/AutoPilotView';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

// Placeholder for StockDetailView since we're crypto-focused
function StockDetailPlaceholder() {
  return (
    <div style={{ padding: '2rem', color: 'white' }}>
      <h2>📊 Stock Detail</h2>
      <p>Bu sayfa henüz aktif değil. Kripto odaklı çalışıyoruz!</p>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<MarketView />} />
              <Route path="cockpit" element={<CockpitView />} />
              <Route path="phoenix" element={<PhoenixView />} />
              <Route path="backtest" element={<BacktestView />} />
              <Route path="autopilot" element={<AutoPilotView />} />
              <Route path="portfolio" element={<PortfolioView />} />
              <Route path="settings" element={<SettingsView />} />
              <Route path="stock/:symbol" element={<StockDetailPlaceholder />} />
              <Route path="crypto/:symbol" element={<CryptoDetailView />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
