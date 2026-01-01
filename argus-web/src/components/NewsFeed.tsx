import { useState, useEffect } from 'react';
import { fetchNews, getSentimentColor } from '../services/newsService';
import type { NewsItem } from '../types';
import { Globe, Clock, ExternalLink } from 'lucide-react';
import './NewsFeed.css';

interface NewsFeedProps {
    symbol?: string;
}

export default function NewsFeed({ symbol }: NewsFeedProps) {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const loadNews = async () => {
            setLoading(true);
            try {
                const data = await fetchNews(symbol);
                if (mounted) setNews(data);
            } catch (err) {
                console.error("News fetch error", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadNews();
        return () => { mounted = false; };
    }, [symbol]);

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / 1000 / 60; // Minutes

        if (diff < 60) return `${Math.floor(diff)}dk önce`;
        if (diff < 1440) return `${Math.floor(diff / 60)}s önce`;
        return `${Math.floor(diff / 1440)}g önce`;
    };

    if (loading) {
        return (
            <div className="news-feed-container">
                <h3 className="news-header">
                    <Globe size={18} />
                    <span>Haberler Yükleniyor...</span>
                </h3>
                <div className="news-list loading">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="news-skeleton"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (news.length === 0) {
        return (
            <div className="news-feed-container">
                <div className="news-feed empty">Haber bulunamadı.</div>
            </div>
        );
    }

    return (
        <div className="news-feed-container">
            <h3 className="news-header">
                <Globe size={18} />
                <span>Piyasa Haberleri {symbol ? `(${symbol})` : ''}</span>
            </h3>
            <div className="news-list">
                {news.map(item => (
                    <div key={item.id} className="news-item">
                        <div className="news-top-row">
                            <div className="news-meta">
                                <span className="news-source">{item.source}</span>
                                <span className="news-time">
                                    <Clock size={12} />
                                    {formatTime(item.publishedAt)}
                                </span>
                            </div>
                            <span
                                className="news-sentiment-badge"
                                style={{
                                    backgroundColor: `${getSentimentColor(item.sentiment)}20`,
                                    color: getSentimentColor(item.sentiment),
                                    border: `1px solid ${getSentimentColor(item.sentiment)}40`
                                }}
                            >
                                {item.sentiment === 'positive' ? 'BULL' : item.sentiment === 'negative' ? 'BEAR' : 'NEUTR'}
                            </span>
                        </div>

                        <h4 className="news-title">{item.title}</h4>
                        <p className="news-summary">{item.summary}</p>

                        <div className="news-footer">
                            <a href={item.url} className="read-more" onClick={(e) => e.preventDefault()}>
                                Haberi Oku <ExternalLink size={12} />
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
