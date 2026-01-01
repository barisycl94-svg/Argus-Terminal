import { useState } from 'react';
import { X, Wallet, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './WalletModal.css';

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const WALLETS = [
    { id: 'metamask', name: 'MetaMask', icon: '🦊', description: 'En popüler Web3 cüzdan' },
    { id: 'trustwallet', name: 'Trust Wallet', icon: '🛡️', description: 'Mobil öncelikli cüzdan' },
    { id: 'coinbase', name: 'Coinbase Wallet', icon: '🔵', description: 'Coinbase ekosistemi' },
    { id: 'walletconnect', name: 'WalletConnect', icon: '🔗', description: 'QR ile bağlan' },
];

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
    const [connecting, setConnecting] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleConnect = async (walletId: string) => {
        setConnecting(walletId);

        // Simulate connection delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock address generation
        const mockAddress = '0x' + Array.from({ length: 40 }, () =>
            Math.floor(Math.random() * 16).toString(16)
        ).join('');

        setAddress(mockAddress);
        setConnected(true);
        setConnecting(null);
    };

    const handleDisconnect = () => {
        setConnected(false);
        setAddress(null);
    };

    const copyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="wallet-modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="wallet-modal"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="wallet-modal-header">
                            <h2>
                                <Wallet size={22} />
                                <span>{connected ? 'Bağlı Cüzdan' : 'Cüzdan Bağla'}</span>
                            </h2>
                            <button className="close-btn" onClick={onClose}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="wallet-modal-body">
                            {connected && address ? (
                                <div className="connected-wallet">
                                    <div className="wallet-address-card">
                                        <div className="address-label">Adresiniz</div>
                                        <div className="address-value">
                                            <span>{formatAddress(address)}</span>
                                            <button
                                                className="copy-btn"
                                                onClick={copyAddress}
                                            >
                                                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="wallet-balance">
                                        <div className="balance-row">
                                            <span>ETH Bakiye</span>
                                            <span className="balance-value">2.4521 ETH</span>
                                        </div>
                                        <div className="balance-row">
                                            <span>USDT Bakiye</span>
                                            <span className="balance-value">$12,450.00</span>
                                        </div>
                                    </div>

                                    <button
                                        className="disconnect-btn"
                                        onClick={handleDisconnect}
                                    >
                                        Bağlantıyı Kes
                                    </button>
                                </div>
                            ) : (
                                <div className="wallet-list">
                                    {WALLETS.map(wallet => (
                                        <button
                                            key={wallet.id}
                                            className={`wallet-option ${connecting === wallet.id ? 'connecting' : ''}`}
                                            onClick={() => handleConnect(wallet.id)}
                                            disabled={connecting !== null}
                                        >
                                            <span className="wallet-icon">{wallet.icon}</span>
                                            <div className="wallet-info">
                                                <span className="wallet-name">{wallet.name}</span>
                                                <span className="wallet-desc">{wallet.description}</span>
                                            </div>
                                            {connecting === wallet.id && (
                                                <div className="connecting-spinner"></div>
                                            )}
                                            <ExternalLink size={16} className="external-icon" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="wallet-modal-footer">
                            <p>
                                🔒 Cüzdan bilgileriniz güvende. Argus asla özel anahtarlarınıza erişmez.
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
