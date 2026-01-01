// ===================================
// Alert / Notification Service
// Fiyat Alarmları ve Bildirimler
// ===================================

export interface PriceAlert {
    id: string;
    symbol: string;
    targetPrice: number;
    condition: 'above' | 'below';
    createdAt: Date;
    triggered: boolean;
    triggeredAt?: Date;
    note?: string;
}

export interface Notification {
    id: string;
    type: 'alert' | 'trade' | 'signal' | 'info';
    title: string;
    message: string;
    symbol?: string;
    createdAt: Date;
    read: boolean;
}

// State
let alerts: PriceAlert[] = [];
let notifications: Notification[] = [];
let alertCheckInterval: NodeJS.Timeout | null = null;
let alertListeners: ((alerts: PriceAlert[]) => void)[] = [];
let notificationListeners: ((notifications: Notification[]) => void)[] = [];

// Load from localStorage
export function loadAlerts(): PriceAlert[] {
    try {
        const saved = localStorage.getItem('price_alerts');
        if (saved) {
            alerts = JSON.parse(saved).map((a: any) => ({
                ...a,
                createdAt: new Date(a.createdAt),
                triggeredAt: a.triggeredAt ? new Date(a.triggeredAt) : undefined,
            }));
        }
    } catch (e) {
        console.error('Failed to load alerts:', e);
    }
    return alerts;
}

export function loadNotifications(): Notification[] {
    try {
        const saved = localStorage.getItem('notifications');
        if (saved) {
            notifications = JSON.parse(saved).map((n: any) => ({
                ...n,
                createdAt: new Date(n.createdAt),
            }));
        }
    } catch (e) {
        console.error('Failed to load notifications:', e);
    }
    return notifications;
}

// Save to localStorage
function saveAlerts() {
    localStorage.setItem('price_alerts', JSON.stringify(alerts));
}

function saveNotifications() {
    localStorage.setItem('notifications', JSON.stringify(notifications));
}

// Get alerts
export function getAlerts(): PriceAlert[] {
    if (alerts.length === 0) {
        loadAlerts();
    }
    return alerts;
}

// Get notifications
export function getNotifications(): Notification[] {
    if (notifications.length === 0) {
        loadNotifications();
    }
    return notifications;
}

// Subscribe to updates
export function subscribeToAlerts(callback: (alerts: PriceAlert[]) => void) {
    alertListeners.push(callback);
    return () => {
        alertListeners = alertListeners.filter(l => l !== callback);
    };
}

export function subscribeToNotifications(callback: (notifications: Notification[]) => void) {
    notificationListeners.push(callback);
    return () => {
        notificationListeners = notificationListeners.filter(l => l !== callback);
    };
}

function notifyAlertListeners() {
    alertListeners.forEach(l => l([...alerts]));
}

function notifyNotificationListeners() {
    notificationListeners.forEach(l => l([...notifications]));
}

// Create alert
export function createAlert(
    symbol: string,
    targetPrice: number,
    condition: 'above' | 'below',
    note?: string
): PriceAlert {
    const alert: PriceAlert = {
        id: Date.now().toString(),
        symbol,
        targetPrice,
        condition,
        createdAt: new Date(),
        triggered: false,
        note,
    };

    alerts.push(alert);
    saveAlerts();
    notifyAlertListeners();

    console.log(`🔔 Alert created: ${symbol} ${condition} $${targetPrice}`);

    return alert;
}

// Delete alert
export function deleteAlert(id: string) {
    alerts = alerts.filter(a => a.id !== id);
    saveAlerts();
    notifyAlertListeners();
}

// Clear triggered alerts
export function clearTriggeredAlerts() {
    alerts = alerts.filter(a => !a.triggered);
    saveAlerts();
    notifyAlertListeners();
}

// Create notification
export function createNotification(
    type: Notification['type'],
    title: string,
    message: string,
    symbol?: string
): Notification {
    const notification: Notification = {
        id: Date.now().toString(),
        type,
        title,
        message,
        symbol,
        createdAt: new Date(),
        read: false,
    };

    notifications.unshift(notification);

    // Keep only last 50 notifications
    if (notifications.length > 50) {
        notifications = notifications.slice(0, 50);
    }

    saveNotifications();
    notifyNotificationListeners();

    // Show browser notification if permitted
    showBrowserNotification(title, message);

    return notification;
}

// Mark notification as read
export function markNotificationRead(id: string) {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
        notification.read = true;
        saveNotifications();
        notifyNotificationListeners();
    }
}

// Mark all as read
export function markAllNotificationsRead() {
    notifications.forEach(n => n.read = true);
    saveNotifications();
    notifyNotificationListeners();
}

// Clear all notifications
export function clearNotifications() {
    notifications = [];
    saveNotifications();
    notifyNotificationListeners();
}

// Get unread count
export function getUnreadCount(): number {
    return notifications.filter(n => !n.read).length;
}

// Browser notification
async function showBrowserNotification(title: string, body: string) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
        new Notification(`Argus: ${title}`, { body, icon: '/favicon.ico' });
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            new Notification(`Argus: ${title}`, { body, icon: '/favicon.ico' });
        }
    }
}

// Check alerts against current prices
export async function checkAlerts() {
    if (alerts.length === 0) return;

    const { fetchBinanceTickers } = await import('./binanceService');

    const activeAlerts = alerts.filter(a => !a.triggered);
    if (activeAlerts.length === 0) return;

    const symbols = [...new Set(activeAlerts.map(a => a.symbol))];
    const quotes = await fetchBinanceTickers(symbols);

    for (const alert of activeAlerts) {
        const quote = quotes.find(q => q.symbol === alert.symbol);
        if (!quote) continue;

        let triggered = false;

        if (alert.condition === 'above' && quote.price >= alert.targetPrice) {
            triggered = true;
        } else if (alert.condition === 'below' && quote.price <= alert.targetPrice) {
            triggered = true;
        }

        if (triggered) {
            alert.triggered = true;
            alert.triggeredAt = new Date();

            createNotification(
                'alert',
                `🔔 Fiyat Alarmı: ${alert.symbol.replace('USDT', '')}`,
                `${alert.symbol} $${quote.price.toFixed(4)} - Hedef: ${alert.condition === 'above' ? '↑' : '↓'} $${alert.targetPrice}`,
                alert.symbol
            );

            console.log(`🔔 Alert triggered: ${alert.symbol} ${alert.condition} $${alert.targetPrice}`);
        }
    }

    saveAlerts();
    notifyAlertListeners();
}

// Start alert monitoring
export function startAlertMonitoring(intervalMs: number = 30000) {
    if (alertCheckInterval) return;

    loadAlerts();
    loadNotifications();

    // Check immediately
    checkAlerts();

    // Then check on interval
    alertCheckInterval = setInterval(checkAlerts, intervalMs);

    console.log('🔔 Alert monitoring started');
}

// Stop alert monitoring
export function stopAlertMonitoring() {
    if (alertCheckInterval) {
        clearInterval(alertCheckInterval);
        alertCheckInterval = null;
    }
    console.log('🔔 Alert monitoring stopped');
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'granted') return true;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
}
