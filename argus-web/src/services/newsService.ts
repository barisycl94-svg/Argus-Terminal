import type { NewsItem } from '../types';

// Mock News Data with realistic crypto scenarios
const MOCK_NEWS: NewsItem[] = [
    {
        id: 'news-1',
        title: 'Bitcoin 100k Yolunda: Kurumsal Alımlar Hızlandı',
        summary: 'MicroStrategy ve diğer devlerin alımlarıyla Bitcoin fiyatı yeni zirveleri test ediyor. Piyasa analistleri boğa sezonunun başladığını düşünüyor.',
        url: '#',
        source: 'CoinDesk',
        publishedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
        sentiment: 'positive',
        symbols: ['BTC'],
    },
    {
        id: 'news-2',
        title: 'Ethereum ETF Onayı Konusunda Yeni Sinyaller',
        summary: 'SEC kaynaklarından alınan bilgilere göre, Spot Ethereum ETF başvurularının onaylanma ihtimali artıyor. ETH dominansı yükselişte.',
        url: '#',
        source: 'Bloomberg',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        sentiment: 'positive',
        symbols: ['ETH'],
    },
    {
        id: 'news-3',
        title: 'Ripple Davasında Kritik Gelişme',
        summary: 'Yargıç, SEC\'in ara temyiz başvurusunu reddetti. XRP fiyatında kısa vadeli bir yükseliş bekleniyor.',
        url: '#',
        source: 'CoinTelegraph',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
        sentiment: 'neutral',
        symbols: ['XRP'],
    },
    {
        id: 'news-4',
        title: 'Binance Yeni İşlem Çiftlerini Listeledi',
        summary: 'Borsa, yaptığı açıklamada yeni DeFi tokenlarını listelediğini duyurdu. İlgili tokenlarda hacim artışı gözlemlendi.',
        url: '#',
        source: 'Binance Blog',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
        sentiment: 'neutral',
        symbols: ['BNB', 'CAKE'],
    },
    {
        id: 'news-5',
        title: 'Fed Faiz Kararı Yaklaşıyor: Piyasalar Gergin',
        summary: 'ABD Merkez Bankası\'nın faiz oranlarını sabit tutması bekleniyor ancak enflasyon verileri endişe yaratıyor. Riskli varlıklarda satış baskısı olabilir.',
        url: '#',
        source: 'Reuters',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
        sentiment: 'negative',
        symbols: ['BTC', 'ETH', 'SOL'],
    },
    {
        id: 'news-6',
        title: 'Solana Ağında Kesinti Sorunu Çözüldü',
        summary: 'Solana geliştiricileri, dün gece yaşanan ağ tıkanıklığının giderildiğini ve işlemlerin normale döndüğünü açıkladı.',
        url: '#',
        source: 'Solana Status',
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        sentiment: 'positive',
        symbols: ['SOL'],
    }
];

export async function fetchNews(symbol?: string): Promise<NewsItem[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    if (symbol) {
        const symbolUpper = symbol.toUpperCase();

        // 1. Try to find news specifically for this symbol
        const specific = MOCK_NEWS.filter(n =>
            n.symbols?.some(s => symbolUpper.includes(s) || s === symbolUpper) ||
            n.title.toUpperCase().includes(symbolUpper) ||
            n.summary?.toUpperCase().includes(symbolUpper)
        );

        // 2. If no specific news, return general market news mixed with specific ones
        if (specific.length > 0) {
            return specific;
        }

        // If symbol is BTC or ETH, return relevant items, otherwise return general
        if (symbolUpper === 'BTC' || symbolUpper.includes('BITCOIN')) {
            return MOCK_NEWS.filter(n => n.symbols?.includes('BTC'));
        }
    }

    // Default: Return all news sorted by date
    return [...MOCK_NEWS].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

export function getSentimentColor(sentiment?: 'positive' | 'negative' | 'neutral'): string {
    switch (sentiment) {
        case 'positive': return '#00ff9d'; // Green
        case 'negative': return '#ff0055'; // Red
        case 'neutral': return '#ffd700'; // Gold/Yellow
        default: return '#888888'; // Grey
    }
}
