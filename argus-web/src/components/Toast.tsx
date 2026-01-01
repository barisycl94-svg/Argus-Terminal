import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import './Toast.css';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextType {
    showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (type: ToastType, title: string, message?: string, duration = 4000) => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, type, title, message, duration }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-container">
                {toasts.map(toast => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onClose, toast.duration || 4000);
        return () => clearTimeout(timer);
    }, [toast.duration, onClose]);

    const icons = {
        success: <CheckCircle size={20} />,
        error: <XCircle size={20} />,
        warning: <AlertTriangle size={20} />,
        info: <Info size={20} />
    };

    return (
        <div className={`toast toast-${toast.type}`}>
            <div className="toast-icon">{icons[toast.type]}</div>
            <div className="toast-content">
                <strong className="toast-title">{toast.title}</strong>
                {toast.message && <p className="toast-message">{toast.message}</p>}
            </div>
            <button className="toast-close" onClick={onClose}>
                <X size={16} />
            </button>
        </div>
    );
}
