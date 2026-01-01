import { useEffect, useState } from 'react';
import { fetchOrderBook } from '../services/binanceService';
import './OrderBook.css';

interface OrderBookProps {
    symbol: string;
}

interface DepthData {
    bids: [string, string][];
    asks: [string, string][];
}

export default function OrderBook({ symbol }: OrderBookProps) {
    const [depth, setDepth] = useState<DepthData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const fetchData = async () => {
            if (!symbol) return;
            // İlk yüklemede loading gösterelim, sonrakilerde sessiz güncelleme
            if (!depth) setLoading(true);

            const data = await fetchOrderBook(symbol, 10);
            if (data) {
                setDepth(data);
            }
            setLoading(false);
        };

        fetchData();
        intervalId = setInterval(fetchData, 3000); // 3 saniyede bir güncelle

        return () => clearInterval(intervalId);
    }, [symbol]);

    if (loading && !depth) {
        return <div className="order-book-loading">Derinlik Yükleniyor...</div>;
    }

    if (!depth) return null;

    // Fiyat ve miktarları formatlayalım
    const formatPrice = (p: string) => parseFloat(p).toFixed(4);
    const formatQty = (q: string) => parseFloat(q).toFixed(4);
    const calculateTotal = (p: string, q: string) => (parseFloat(p) * parseFloat(q)).toFixed(2);

    // Spread hesabı
    const bestBid = parseFloat(depth.bids[0][0]);
    const bestAsk = parseFloat(depth.asks[0][0]);
    const spread = bestAsk - bestBid;
    const spreadPercent = (spread / bestAsk) * 100;

    return (
        <div className="order-book-container">
            <div className="ob-header">
                <h3>Order Book</h3>
                <span className="ob-spread">Spread: {spreadPercent.toFixed(3)}%</span>
            </div>

            <div className="ob-content">
                <div className="ob-side asks">
                    <div className="ob-row header">
                        <span>Fiyat</span>
                        <span>Miktar</span>
                        <span>Toplam</span>
                    </div>
                    {/* Asks (Satışlar) - Tersten gösterelim ki en düşük fiyat en altta olsun */}
                    {depth.asks.slice().reverse().map(([price, qty], i) => (
                        <div key={i} className="ob-row">
                            <span className="price">{formatPrice(price)}</span>
                            <span className="qty">{formatQty(qty)}</span>
                            <span className="total">{calculateTotal(price, qty)}</span>
                            <div className="bg-bar" style={{ width: `${Math.min(100, parseFloat(qty) * 10)}%` }}></div>
                        </div>
                    ))}
                </div>

                <div className="ob-divider">
                    <span className="current-price">{((bestBid + bestAsk) / 2).toFixed(4)}</span>
                </div>

                <div className="ob-side bids">
                    {/* Bids (Alışlar) */}
                    {depth.bids.map(([price, qty], i) => (
                        <div key={i} className="ob-row">
                            <span className="price">{formatPrice(price)}</span>
                            <span className="qty">{formatQty(qty)}</span>
                            <span className="total">{calculateTotal(price, qty)}</span>
                            <div className="bg-bar" style={{ width: `${Math.min(100, parseFloat(qty) * 10)}%` }}></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
