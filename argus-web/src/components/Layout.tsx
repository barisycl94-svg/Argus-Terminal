import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { TrendingUp, Crosshair, Wallet, Settings, Eye, Flame, FlaskConical, Zap, Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    startAlertMonitoring,
    getNotifications,
    getUnreadCount,
    markAllNotificationsRead,
    subscribeToNotifications,
    type Notification
} from '../services/alertService';
import WalletModal from './WalletModal';
import './Layout.css';

const tabs = [
    { path: '/', icon: TrendingUp, label: 'Piyasa' },
    { path: '/phoenix', icon: Flame, label: 'Phoenix' },
    { path: '/cockpit', icon: Crosshair, label: 'Cockpit' },
    { path: '/backtest', icon: FlaskConical, label: 'Lab' },
    { path: '/autopilot', icon: Zap, label: 'AutoPilot' },
    { path: '/portfolio', icon: Wallet, label: 'Portföy' },
    { path: '/settings', icon: Settings, label: 'Ayarlar' },
];

export default function Layout() {
    const location = useLocation();
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showWalletModal, setShowWalletModal] = useState(false);

    useEffect(() => {
        // Start alert monitoring
        startAlertMonitoring(30000);

        // Load initial state
        setNotifications(getNotifications());
        setUnreadCount(getUnreadCount());

        // Subscribe to updates
        const unsubscribe = subscribeToNotifications((updated) => {
            setNotifications(updated);
            setUnreadCount(updated.filter(n => !n.read).length);
        });

        return unsubscribe;
    }, []);

    const handleNotificationClick = () => {
        setShowNotifications(!showNotifications);
        if (!showNotifications) {
            markAllNotificationsRead();
        }
    };

    return (
        <div className="app-layout">
            {/* Header */}
            <header className="app-header">
                <div className="header-content">
                    <Link to="/" className="logo">
                        <Eye className="logo-icon" />
                        <span className="logo-text">ARGUS</span>
                        <span className="logo-subtitle">CRYPTO</span>
                    </Link>

                    <div className="header-right">
                        <div className="header-status">
                            <span className="status-dot"></span>
                            <span className="status-text">Binance Live</span>
                        </div>

                        {/* Notification Bell */}
                        <div className="notification-wrapper">
                            <button className="notification-btn" onClick={handleNotificationClick}>
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="notification-badge">{unreadCount}</span>
                                )}
                            </button>

                            <AnimatePresence>
                                {showNotifications && (
                                    <motion.div
                                        className="notification-dropdown"
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                    >
                                        <div className="notification-header">
                                            <h4>Bildirimler</h4>
                                            <button onClick={() => setShowNotifications(false)}>
                                                <X size={16} />
                                            </button>
                                        </div>
                                        <div className="notification-list">
                                            {notifications.length === 0 ? (
                                                <p className="no-notifications">Bildirim yok</p>
                                            ) : (
                                                notifications.slice(0, 5).map((n) => (
                                                    <div key={n.id} className={`notification-item ${n.type}`}>
                                                        <span className="notification-title">{n.title}</span>
                                                        <span className="notification-message">{n.message}</span>
                                                        <span className="notification-time">
                                                            {new Date(n.timestamp).toLocaleTimeString('tr-TR')}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <button
                            className="connect-wallet-btn"
                            onClick={() => setShowWalletModal(true)}
                        >
                            <Wallet size={16} />
                            <span>Cüzdan Bağla</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="app-main">
                <Outlet />
            </main>

            {/* Bottom Navigation */}
            <nav className="tab-bar">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = location.pathname === tab.path;
                    return (
                        <NavLink
                            key={tab.path}
                            to={tab.path}
                            className={`tab-item ${isActive ? 'active' : ''}`}
                        >
                            <Icon size={20} />
                            <span>{tab.label}</span>
                            {isActive && (
                                <motion.div
                                    className="tab-indicator"
                                    layoutId="activeTab"
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                />
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Wallet Modal */}
            <WalletModal
                isOpen={showWalletModal}
                onClose={() => setShowWalletModal(false)}
            />
        </div>
    );
}
