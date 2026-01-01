import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Settings, Shield, Bell, Moon, Globe, Zap,
    ChevronRight, AlertTriangle, CheckCircle,
    Eye, Info, Bitcoin, Wallet
} from 'lucide-react';
import { ARGUS_ENTITIES } from '../types';
import './SettingsView.css';

export default function SettingsView() {
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('argus_settings');
        return saved ? JSON.parse(saved) : {
            autoPilotEnabled: false,
            notificationsEnabled: true,
            darkMode: true,
            language: 'tr',
            defaultTimeframe: '4h',
            riskLevel: 'medium',
        };
    });
    const [showAbout, setShowAbout] = useState(false);

    const handleSettingToggle = (key: keyof typeof settings) => {
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        localStorage.setItem('argus_settings', JSON.stringify(newSettings));
    };

    const handleSettingChange = (key: string, value: string) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        localStorage.setItem('argus_settings', JSON.stringify(newSettings));
    };

    const clearAllData = () => {
        if (confirm('Tüm kayıtlı veriler silinecek. Emin misiniz?')) {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <div className="settings-view">
            <h1>
                <Settings className="page-icon" />
                Ayarlar
            </h1>

            {/* Data Source Info */}
            <section className="settings-section">
                <div className="section-header">
                    <div className="header-left">
                        <Bitcoin className="section-icon gold" />
                        <div>
                            <h2>Veri Kaynağı</h2>
                            <p>Binance API Entegrasyonu</p>
                        </div>
                    </div>
                </div>

                <div className="section-content">
                    <div className="info-box success">
                        <CheckCircle size={20} />
                        <div>
                            <strong>Binance API Bağlı</strong>
                            <p>Tüm kripto verileri Binance Spot API'den canlı olarak çekiliyor. API anahtarı gerektirmez.</p>
                        </div>
                    </div>

                    <div className="features-list">
                        <div className="feature-item">
                            <span className="feature-icon">📊</span>
                            <span>Canlı fiyat verileri</span>
                        </div>
                        <div className="feature-item">
                            <span className="feature-icon">📈</span>
                            <span>Teknik analiz indikatörleri</span>
                        </div>
                        <div className="feature-item">
                            <span className="feature-icon">🔍</span>
                            <span>Tüm USDT pariteli coinler</span>
                        </div>
                        <div className="feature-item">
                            <span className="feature-icon">⚡</span>
                            <span>Gerçek zamanlı güncellemeler</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trading Settings */}
            <section className="settings-section">
                <div className="section-header">
                    <div className="header-left">
                        <Zap className="section-icon gold" />
                        <div>
                            <h2>Trading Ayarları</h2>
                            <p>Simülasyon ve analiz tercihleri</p>
                        </div>
                    </div>
                </div>

                <div className="section-content">
                    <div className="setting-row">
                        <div className="setting-info">
                            <span className="setting-name">AutoPilot Modu</span>
                            <span className="setting-desc">Otomatik sinyal simülasyonu (gerçek işlem yapmaz)</span>
                        </div>
                        <button
                            className={`toggle ${settings.autoPilotEnabled ? 'active' : ''}`}
                            onClick={() => handleSettingToggle('autoPilotEnabled')}
                        >
                            <span className="toggle-slider"></span>
                        </button>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <span className="setting-name">Varsayılan Timeframe</span>
                            <span className="setting-desc">Grafik ve analiz için varsayılan zaman dilimi</span>
                        </div>
                        <select
                            className="select"
                            value={settings.defaultTimeframe}
                            onChange={(e) => handleSettingChange('defaultTimeframe', e.target.value)}
                        >
                            <option value="1h">1 Saat</option>
                            <option value="4h">4 Saat</option>
                            <option value="1d">1 Gün</option>
                            <option value="1w">1 Hafta</option>
                        </select>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <span className="setting-name">Risk Seviyesi</span>
                            <span className="setting-desc">Pozisyon boyutu önerileri için</span>
                        </div>
                        <select
                            className="select"
                            value={settings.riskLevel}
                            onChange={(e) => handleSettingChange('riskLevel', e.target.value)}
                        >
                            <option value="conservative">Muhafazakâr</option>
                            <option value="medium">Orta</option>
                            <option value="aggressive">Agresif</option>
                        </select>
                    </div>

                    <div className="warning-box">
                        <AlertTriangle size={18} />
                        <p><strong>Uyarı:</strong> Bu uygulama yatırım tavsiyesi değildir. Tüm işlemler simülasyondur ve gerçek para ile işlem yapılmaz.</p>
                    </div>
                </div>
            </section>

            {/* General Settings */}
            <section className="settings-section">
                <div className="section-header">
                    <div className="header-left">
                        <Settings className="section-icon" />
                        <div>
                            <h2>Genel</h2>
                            <p>Uygulama tercihleri</p>
                        </div>
                    </div>
                </div>

                <div className="section-content">
                    <div className="setting-row">
                        <div className="setting-info">
                            <Bell size={18} />
                            <span className="setting-name">Bildirimler</span>
                        </div>
                        <button
                            className={`toggle ${settings.notificationsEnabled ? 'active' : ''}`}
                            onClick={() => handleSettingToggle('notificationsEnabled')}
                        >
                            <span className="toggle-slider"></span>
                        </button>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <Bell size={18} />
                            <div>
                                <span className="setting-name">Tarayıcı Bildirimleri</span>
                                <span className="setting-desc">
                                    {typeof Notification !== 'undefined' ?
                                        Notification.permission === 'granted' ? '✅ İzin verildi' :
                                            Notification.permission === 'denied' ? '❌ Reddedildi' :
                                                '⚠️ İzin bekleniyor'
                                        : 'Desteklenmiyor'}
                                </span>
                            </div>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                                    Notification.requestPermission().then(permission => {
                                        if (permission === 'granted') {
                                            new Notification('Argus Terminal', { body: 'Bildirimler aktif!' });
                                        }
                                    });
                                }
                            }}
                            disabled={typeof Notification !== 'undefined' && Notification.permission === 'granted'}
                        >
                            {Notification?.permission === 'granted' ? 'Aktif' : 'İzin Ver'}
                        </button>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <Moon size={18} />
                            <span className="setting-name">Karanlık Tema</span>
                        </div>
                        <button
                            className={`toggle ${settings.darkMode ? 'active' : ''}`}
                            onClick={() => handleSettingToggle('darkMode')}
                        >
                            <span className="toggle-slider"></span>
                        </button>
                    </div>

                    <div className="setting-row">
                        <div className="setting-info">
                            <Globe size={18} />
                            <span className="setting-name">Dil</span>
                        </div>
                        <select
                            className="select"
                            value={settings.language}
                            onChange={(e) => handleSettingChange('language', e.target.value)}
                        >
                            <option value="tr">Türkçe</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                </div>
            </section>

            {/* Data Management */}
            <section className="settings-section">
                <div className="section-header">
                    <div className="header-left">
                        <Wallet className="section-icon" />
                        <div>
                            <h2>Veri Yönetimi</h2>
                            <p>Portföy ve izleme listesi verileri</p>
                        </div>
                    </div>
                </div>

                <div className="section-content">
                    <div className="data-info">
                        <p>Tüm verileriniz tarayıcınızın yerel deposunda (localStorage) saklanır. Veriler sunucuya gönderilmez.</p>
                    </div>

                    <button className="btn btn-danger" onClick={clearAllData}>
                        <AlertTriangle size={16} />
                        Tüm Verileri Sil
                    </button>
                </div>
            </section>

            {/* About Argus */}
            <section className="settings-section">
                <button
                    className="section-header expandable"
                    onClick={() => setShowAbout(!showAbout)}
                >
                    <div className="header-left">
                        <Eye className="section-icon gold" />
                        <div>
                            <h2>Argus Terminal Hakkında</h2>
                            <p>Sistem modülleri ve açıklamalar</p>
                        </div>
                    </div>
                    <ChevronRight className={`chevron ${showAbout ? 'open' : ''}`} />
                </button>

                {showAbout && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="section-content"
                    >
                        <div className="modules-grid">
                            {ARGUS_ENTITIES.map((entity) => (
                                <div
                                    key={entity.id}
                                    className="module-card"
                                    style={{ borderColor: entity.color }}
                                >
                                    <div className="module-header" style={{ color: entity.color }}>
                                        {entity.name}
                                    </div>
                                    <p>{entity.description}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </section>

            {/* Legal */}
            <section className="settings-section">
                <div className="section-header">
                    <div className="header-left">
                        <Shield className="section-icon" />
                        <div>
                            <h2>Yasal Uyarı</h2>
                            <p>Önemli bilgiler</p>
                        </div>
                    </div>
                </div>

                <div className="section-content">
                    <div className="legal-box">
                        <h4>⚠️ Bu uygulama YATIRIM TAVSİYESİ DEĞİLDİR.</h4>
                        <ul>
                            <li>Eğitim ve araştırma amaçlıdır</li>
                            <li>Alım-satım kararlarınızdan siz sorumlusunuz</li>
                            <li>Kayıplarınızdan siz sorumlusunuz</li>
                            <li>Profesyonel danışmanlık almanız önerilir</li>
                            <li>Kaybetmeyi göze alamayacağınız parayla işlem yapmayın</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Version */}
            <div className="version-info">
                <span>Argus Terminal v3.0.0</span>
                <span>•</span>
                <span>Crypto Edition</span>
            </div>
        </div>
    );
}
