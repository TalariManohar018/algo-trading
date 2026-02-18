import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, X } from 'lucide-react';
import { getBrokerMode, BrokerModeInfo } from '../api/emergency';

const LiveTradingWarning: React.FC = () => {
    const [brokerMode, setBrokerMode] = useState<BrokerModeInfo | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        fetchBrokerMode();
        // Refresh every 30 seconds
        const interval = setInterval(fetchBrokerMode, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchBrokerMode = async () => {
        try {
            const mode = await getBrokerMode();
            setBrokerMode(mode);
        } catch (error) {
            console.error('Failed to fetch broker mode:', error);
        }
    };

    if (!brokerMode || dismissed) {
        return null;
    }

    if (brokerMode.isLive) {
        return (
            <div className="bg-red-600 text-white px-4 py-3 shadow-lg relative">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <AlertTriangle className="h-6 w-6 animate-pulse" />
                        <div>
                            <p className="font-bold text-lg">
                                ⚠️ LIVE TRADING MODE - REAL MONEY AT RISK ⚠️
                            </p>
                            <p className="text-sm">
                                Broker: {brokerMode.provider} | Status: {brokerMode.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setDismissed(true)}
                        className="text-white hover:text-gray-200 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-blue-600 text-white px-4 py-2 shadow relative">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm font-medium">
                        Paper Trading Mode - No real money at risk
                    </p>
                </div>
                <button
                    onClick={() => setDismissed(true)}
                    className="text-white hover:text-gray-200 transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default LiveTradingWarning;
