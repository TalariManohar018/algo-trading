import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type TradingMode = 'PAPER' | 'LIVE';

export interface Settings {
    // Trading Mode
    tradingMode: TradingMode;

    // Virtual Wallet (Paper Trading)
    startingCapital: number;
    currentBalance: number;

    // Risk Management
    maxLossPerDay: number;
    maxTradesPerDay: number;
    maxCapitalPerTrade: number; // percentage

    // Strategy Execution Rules
    allowMultipleStrategies: boolean;
    autoSquareOffTime: string; // HH:MM format
    marketDaysOnly: boolean;

    // Notifications
    notifications: {
        strategyStarted: boolean;
        strategyStopped: boolean;
        tradeExecuted: boolean;
        dailyPnlSummary: boolean;
    };
}

interface SettingsContextType {
    settings: Settings;
    updateSettings: (updates: Partial<Settings>) => void;
    resetWallet: () => void;
    updateBalance: (amount: number) => void;
    canTrade: () => { allowed: boolean; reason?: string };
    getDailyTradeCount: () => number;
    getDailyPnL: () => number;
}

const defaultSettings: Settings = {
    tradingMode: 'PAPER',
    startingCapital: 100000,
    currentBalance: 100000,
    maxLossPerDay: 5000,
    maxTradesPerDay: 50,
    maxCapitalPerTrade: 10,
    allowMultipleStrategies: true,
    autoSquareOffTime: '15:15',
    marketDaysOnly: true,
    notifications: {
        strategyStarted: true,
        strategyStopped: true,
        tradeExecuted: true,
        dailyPnlSummary: true,
    },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<Settings>(() => {
        const stored = localStorage.getItem('algotrader_settings');
        if (stored) {
            try {
                return { ...defaultSettings, ...JSON.parse(stored) };
            } catch {
                return defaultSettings;
            }
        }
        return defaultSettings;
    });

    useEffect(() => {
        localStorage.setItem('algotrader_settings', JSON.stringify(settings));
    }, [settings]);

    const updateSettings = (updates: Partial<Settings>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    };

    const resetWallet = () => {
        setSettings(prev => ({
            ...prev,
            currentBalance: prev.startingCapital,
        }));
        // Clear trades and positions from localStorage
        localStorage.removeItem('algotrader_trades');
        localStorage.removeItem('algotrader_positions');
        localStorage.removeItem('algotrader_strategies');
    };

    const updateBalance = (amount: number) => {
        setSettings(prev => ({
            ...prev,
            currentBalance: prev.currentBalance + amount,
        }));
    };

    const getDailyTradeCount = (): number => {
        const trades = JSON.parse(localStorage.getItem('algotrader_trades') || '[]');
        const today = new Date().toDateString();
        return trades.filter((t: any) => {
            const tradeDate = new Date(t.entryTime).toDateString();
            return tradeDate === today;
        }).length;
    };

    const getDailyPnL = (): number => {
        const trades = JSON.parse(localStorage.getItem('algotrader_trades') || '[]');
        const today = new Date().toDateString();
        return trades
            .filter((t: any) => {
                const tradeDate = new Date(t.exitTime || t.entryTime).toDateString();
                return tradeDate === today && t.status === 'CLOSED';
            })
            .reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
    };

    const canTrade = (): { allowed: boolean; reason?: string } => {
        // Check trading mode
        if (settings.tradingMode === 'LIVE') {
            return { allowed: false, reason: 'Live trading not available - Broker not connected' };
        }

        // Check daily trade limit
        const dailyTrades = getDailyTradeCount();
        if (dailyTrades >= settings.maxTradesPerDay) {
            return { allowed: false, reason: `Daily trade limit reached (${settings.maxTradesPerDay})` };
        }

        // Check daily loss limit
        const dailyPnL = getDailyPnL();
        if (dailyPnL < 0 && Math.abs(dailyPnL) >= settings.maxLossPerDay) {
            return { allowed: false, reason: `Daily loss limit reached (₹${settings.maxLossPerDay})` };
        }

        // Check market days (simplified - in real app would check actual market calendar)
        if (settings.marketDaysOnly) {
            const day = new Date().getDay();
            if (day === 0 || day === 6) {
                return { allowed: false, reason: 'Market is closed (Weekend)' };
            }
        }

        return { allowed: true };
    };

    return (
        <SettingsContext.Provider
            value={{
                settings,
                updateSettings,
                resetWallet,
                updateBalance,
                canTrade,
                getDailyTradeCount,
                getDailyPnL,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
