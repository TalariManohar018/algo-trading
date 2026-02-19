import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { paperTradingEngine, ActivityEvent, ExecutableStrategy } from '../services/paperTradingEngine';
import { paperWalletService } from '../services/paperWalletService';
import { paperPositionService } from '../services/paperPositionService';
import { useSettings } from './SettingsContext';
import { useError } from './ErrorContext';

export type OrderStatus = 'CREATED' | 'PLACED' | 'PARTIALLY_FILLED' | 'FILLED' | 'REJECTED' | 'CANCELLED' | 'CLOSED';
export type PositionStatus = 'OPEN' | 'CLOSED';
export type EngineStatus = 'STOPPED' | 'RUNNING' | 'PAUSED' | 'LOCKED';

export interface Order {
    id: string;
    strategyId: string;
    strategyName: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT';
    limitPrice?: number;
    status: OrderStatus;
    placedPrice?: number;
    filledPrice?: number;
    filledQuantity?: number;
    createdAt: Date;
    placedAt?: Date;
    filledAt?: Date;
    rejectedReason?: string;
}

export interface Position {
    id: string;
    strategyId: string;
    strategyName: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    marginUsed?: number;
    status: PositionStatus;
    openedAt: Date;
    closedAt?: Date;
}

export interface Trade {
    id: string;
    strategyId: string;
    strategyName: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    executedAt: Date;
}

export interface WalletState {
    balance: number;
    usedMargin: number;
    availableMargin: number;
    realizedPnl: number;
    unrealizedPnl: number;
}

export interface RiskState {
    dailyLoss: number;
    dailyTradeCount: number;
    isLocked: boolean;
    lockReason?: string;
}

interface TradingContextType {
    // State
    orders: Order[];
    positions: Position[];
    trades: Trade[];
    wallet: WalletState;
    riskState: RiskState;
    engineStatus: EngineStatus;
    activityLog: ActivityEvent[];
    strategies: ExecutableStrategy[];
    tradingMode: 'PAPER' | 'LIVE';

    // Actions
    addOrder: (order: Order) => void;
    updateOrder: (orderId: string, updates: Partial<Order>) => void;
    addPosition: (position: Position) => void;
    updatePosition: (positionId: string, updates: Partial<Position>) => void;
    closePosition: (positionId: string, exitPrice: number) => void;
    addTrade: (trade: Trade) => void;
    updateWallet: (updates: Partial<WalletState>) => void;
    updateRiskState: (updates: Partial<RiskState>) => void;
    setEngineStatus: (status: EngineStatus) => void;
    lockEngine: (reason: string) => void;
    unlockEngine: () => void;
    resetDailyLimits: () => void;
    squareOffAll: () => void;
    addActivity: (event: ActivityEvent) => void;
    addStrategy: (strategy: ExecutableStrategy) => void;
    removeStrategy: (strategyId: string) => void;
    updateStrategy: (strategy: ExecutableStrategy) => void;
    startEngine: () => Promise<void>;
    stopEngine: () => Promise<void>;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export const useTradingContext = () => {
    const context = useContext(TradingContext);
    if (!context) {
        throw new Error('useTradingContext must be used within TradingProvider');
    }
    return context;
};

export const TradingProvider = ({ children }: { children: ReactNode }) => {
    const { settings } = useSettings();
    const { showSuccess, showError } = useError();

    // ── State ─────────────────────────────────────────────────────────────────

    const [orders, setOrders] = useState<Order[]>(() => {
        const saved = localStorage.getItem('trading_orders');
        return saved ? JSON.parse(saved) : [];
    });

    const [positions, setPositions] = useState<Position[]>(() => {
        const saved = localStorage.getItem('trading_positions');
        return saved ? JSON.parse(saved) : [];
    });

    const [trades, setTrades] = useState<Trade[]>(() => {
        const saved = localStorage.getItem('trading_trades');
        return saved ? JSON.parse(saved) : [];
    });

    const [wallet, setWallet] = useState<WalletState>(() => paperWalletService.getWallet());

    const [riskState, setRiskState] = useState<RiskState>(() => {
        const saved = localStorage.getItem('trading_risk_state');
        return saved ? JSON.parse(saved) : {
            dailyLoss: 0,
            dailyTradeCount: 0,
            isLocked: false,
            lockReason: undefined,
        };
    });

    const [engineStatus, setEngineStatus] = useState<EngineStatus>('STOPPED');

    const [activityLog, setActivityLog] = useState<ActivityEvent[]>(() => {
        const saved = localStorage.getItem('trading_activity');
        return saved ? JSON.parse(saved) : [];
    });

    const [strategies, setStrategies] = useState<ExecutableStrategy[]>(() => {
        const saved = localStorage.getItem('trading_strategies');
        return saved ? JSON.parse(saved) : [];
    });

    // ── Stable refs — prevent stale closures in one-time event handlers ────────

    const positionsRef = useRef<Position[]>(positions);
    const engineStatusRef = useRef<EngineStatus>(engineStatus);

    useEffect(() => { positionsRef.current = positions; }, [positions]);
    useEffect(() => { engineStatusRef.current = engineStatus; }, [engineStatus]);

    // ── Sync settings → engine ────────────────────────────────────────────────

    useEffect(() => {
        paperTradingEngine.setTradingMode(settings.tradingMode);
        console.log(`[TradingContext] Trading mode synced to engine: ${settings.tradingMode}`);
    }, [settings.tradingMode]);

    useEffect(() => {
        paperTradingEngine.setRiskLimits({
            maxLossPerDay: settings.maxLossPerDay,
            maxTradesPerDay: settings.maxTradesPerDay,
            maxCapitalPerTrade: settings.maxCapitalPerTrade,
            startingCapital: settings.startingCapital,
        });
    }, [settings.maxLossPerDay, settings.maxTradesPerDay, settings.maxCapitalPerTrade, settings.startingCapital]);

    // ── Internal close (uses position object directly to avoid stale state) ────

    const closePositionInternal = (position: Position, exitPrice: number) => {
        const { position: closedPosition, trade } = paperPositionService.closePosition(position, exitPrice);

        setPositions(prev => prev.map(p => p.id === position.id ? closedPosition : p));
        setTrades(prev => [trade, ...prev]);

        // Release exact locked margin; fall back to 20% if missing
        const marginToRelease = position.marginUsed ?? (position.entryPrice * position.quantity * 0.2);
        paperWalletService.releaseCapital(marginToRelease);
        paperWalletService.recordRealizedPnl(trade.pnl);
        setWallet(paperWalletService.getWallet());

        // Inform engine about realised loss for daily loss tracking
        if (trade.pnl < 0) {
            paperTradingEngine.updateDailyLoss(Math.abs(trade.pnl));
        }

        setRiskState(prev => ({
            ...prev,
            dailyLoss: prev.dailyLoss + (trade.pnl < 0 ? Math.abs(trade.pnl) : 0),
            dailyTradeCount: prev.dailyTradeCount + 1,
        }));

        const pnlStr = trade.pnl >= 0 ? `+₹${trade.pnl.toFixed(2)}` : `-₹${Math.abs(trade.pnl).toFixed(2)}`;
        showSuccess(`Position closed — ${position.symbol} | PnL: ${pnlStr}`);
        console.log(`[TradingContext] Position closed | ${position.symbol} | Entry ₹${position.entryPrice} → Exit ₹${exitPrice} | PnL ${pnlStr}`);
    };

    // ── Engine event handlers (registered once, use refs for live data) ────────

    useEffect(() => {
        const handleOrderCreated = (order: Order) => {
            setOrders(prev => [...prev, order]);
        };

        const handleOrderUpdated = (order: Order) => {
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...order } : o));
        };

        const handlePositionOpened = (position: Position) => {
            setPositions(prev => [...prev, position]);
            setWallet(paperWalletService.getWallet());
        };

        const handleActivity = (event: ActivityEvent) => {
            setActivityLog(prev => [event, ...prev].slice(0, 100));
        };

        const handleStatusChange = (status: EngineStatus) => {
            setEngineStatus(status);
        };

        // Real-time unrealised PnL — uses functional setState to avoid stale snapshots
        const handleUpdateUnrealizedPnl = (data: { symbol: string; price: number }) => {
            setPositions(prev => {
                const updated = prev.map(pos =>
                    (pos.symbol === data.symbol && pos.status === 'OPEN')
                        ? paperPositionService.updateUnrealizedPnl(pos, data.price)
                        : pos
                );
                const totalUnrealized = updated
                    .filter(p => p.status === 'OPEN')
                    .reduce((sum, p) => sum + p.unrealizedPnl, 0);
                paperWalletService.updateUnrealizedPnl(totalUnrealized);
                setWallet(paperWalletService.getWallet());
                return updated;
            });
        };

        // Provide live positions to engine without re-subscribing on every change
        const handleCheckPositions = (strategyId: string, callback: (positions: Position[]) => void) => {
            callback(positionsRef.current.filter(p => p.strategyId === strategyId));
        };

        const handleExitSignal = (strategyId: string, exitPrice: number) => {
            const openPositions = positionsRef.current.filter(
                p => p.strategyId === strategyId && p.status === 'OPEN'
            );
            openPositions.forEach(pos => closePositionInternal(pos, exitPrice));
        };

        const handleTradeFilled = (data: { strategyName: string; symbol: string; side: string; quantity: number; price: number }) => {
            showSuccess(`${data.side} filled — ${data.symbol} × ${data.quantity} @ ₹${data.price?.toFixed(2)} (${data.strategyName})`);
        };

        const handleOrderRejected = (data: { reason: string; strategy: string; symbol: string }) => {
            showError(`Order rejected for ${data.strategy} (${data.symbol}): ${data.reason}`);
        };

        const handleRiskBreached = (reason: string) => {
            setRiskState(prev => ({ ...prev, isLocked: true, lockReason: reason }));
            setEngineStatus('LOCKED');
            showError(`Engine locked: ${reason}`);
            console.warn(`[TradingContext] Engine LOCKED — ${reason}`);
        };

        paperTradingEngine.on('orderCreated', handleOrderCreated);
        paperTradingEngine.on('orderUpdated', handleOrderUpdated);
        paperTradingEngine.on('positionOpened', handlePositionOpened);
        paperTradingEngine.on('activity', handleActivity);
        paperTradingEngine.on('statusChange', handleStatusChange);
        paperTradingEngine.on('updateUnrealizedPnl', handleUpdateUnrealizedPnl);
        paperTradingEngine.on('checkPositions', handleCheckPositions);
        paperTradingEngine.on('exitSignal', handleExitSignal);
        paperTradingEngine.on('tradeFilled', handleTradeFilled);
        paperTradingEngine.on('orderRejected', handleOrderRejected);
        paperTradingEngine.on('riskBreached', handleRiskBreached);

        return () => {
            paperTradingEngine.off('orderCreated', handleOrderCreated);
            paperTradingEngine.off('orderUpdated', handleOrderUpdated);
            paperTradingEngine.off('positionOpened', handlePositionOpened);
            paperTradingEngine.off('activity', handleActivity);
            paperTradingEngine.off('statusChange', handleStatusChange);
            paperTradingEngine.off('updateUnrealizedPnl', handleUpdateUnrealizedPnl);
            paperTradingEngine.off('checkPositions', handleCheckPositions);
            paperTradingEngine.off('exitSignal', handleExitSignal);
            paperTradingEngine.off('tradeFilled', handleTradeFilled);
            paperTradingEngine.off('orderRejected', handleOrderRejected);
            paperTradingEngine.off('riskBreached', handleRiskBreached);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Intentionally empty — refs carry live data

    // ── Persist to localStorage ───────────────────────────────────────────────

    useEffect(() => { localStorage.setItem('trading_orders', JSON.stringify(orders)); }, [orders]);
    useEffect(() => { localStorage.setItem('trading_positions', JSON.stringify(positions)); }, [positions]);
    useEffect(() => { localStorage.setItem('trading_trades', JSON.stringify(trades)); }, [trades]);
    useEffect(() => { localStorage.setItem('trading_risk_state', JSON.stringify(riskState)); }, [riskState]);
    useEffect(() => { localStorage.setItem('trading_activity', JSON.stringify(activityLog)); }, [activityLog]);
    useEffect(() => { localStorage.setItem('trading_strategies', JSON.stringify(strategies)); }, [strategies]);

    // ── Public actions ────────────────────────────────────────────────────────

    const addOrder = (order: Order) => setOrders(prev => [...prev, order]);

    const updateOrder = (orderId: string, updates: Partial<Order>) =>
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));

    const addPosition = (position: Position) => setPositions(prev => [...prev, position]);

    const updatePosition = (positionId: string, updates: Partial<Position>) =>
        setPositions(prev => prev.map(p => p.id === positionId ? { ...p, ...updates } : p));

    const closePosition = (positionId: string, exitPrice: number) => {
        const position = positionsRef.current.find(p => p.id === positionId);
        if (!position) return;
        closePositionInternal(position, exitPrice);
    };

    const addTrade = (trade: Trade) => setTrades(prev => [trade, ...prev]);

    const updateWallet = (updates: Partial<WalletState>) => setWallet(prev => ({ ...prev, ...updates }));

    const updateRiskState = (updates: Partial<RiskState>) => setRiskState(prev => ({ ...prev, ...updates }));

    const lockEngine = (reason: string) => {
        setRiskState(prev => ({ ...prev, isLocked: true, lockReason: reason }));
        setEngineStatus('LOCKED');
    };

    const unlockEngine = () => {
        setRiskState(prev => ({ ...prev, isLocked: false, lockReason: undefined }));
        if (engineStatusRef.current === 'LOCKED') setEngineStatus('STOPPED');
    };

    const resetDailyLimits = () => {
        setRiskState(prev => ({ ...prev, dailyLoss: 0, dailyTradeCount: 0, isLocked: false, lockReason: undefined }));
        paperTradingEngine.resetDailyCounters();
        showSuccess('Daily limits reset — engine unlocked');
    };

    const squareOffAll = () => {
        const openPositions = positionsRef.current.filter(p => p.status === 'OPEN');
        openPositions.forEach(pos => closePositionInternal(pos, pos.currentPrice));
        if (openPositions.length > 0) {
            showSuccess(`Emergency square-off: closed ${openPositions.length} position(s)`);
        }
    };

    const addActivity = (event: ActivityEvent) =>
        setActivityLog(prev => [event, ...prev].slice(0, 100));

    const addStrategy = (strategy: ExecutableStrategy) => {
        setStrategies(prev => [...prev, strategy]);
        paperTradingEngine.addStrategy(strategy);
    };

    const removeStrategy = (strategyId: string) => {
        setStrategies(prev => prev.filter(s => s.id !== strategyId));
        paperTradingEngine.removeStrategy(strategyId);
    };

    const updateStrategy = (strategy: ExecutableStrategy) => {
        setStrategies(prev => prev.map(s => s.id === strategy.id ? strategy : s));
        paperTradingEngine.updateStrategy(strategy);
    };

    const startEngine = async () => {
        console.log(`[TradingContext] Starting engine | Mode: ${settings.tradingMode} | Strategies: ${strategies.length}`);
        await paperTradingEngine.startEngine();
        setEngineStatus('RUNNING');
        const w = paperWalletService.getWallet();
        console.log(`[TradingContext] Engine RUNNING | Wallet ₹${w.balance.toFixed(2)} | Available ₹${w.availableMargin.toFixed(2)}`);
        showSuccess(`Engine started in ${settings.tradingMode} mode`);
    };

    const stopEngine = async () => {
        console.log('[TradingContext] Stopping engine');
        await paperTradingEngine.stopEngine();
        setEngineStatus('STOPPED');
        showSuccess('Engine stopped');
    };

    return (
        <TradingContext.Provider
            value={{
                orders,
                positions,
                trades,
                wallet,
                riskState,
                engineStatus,
                activityLog,
                strategies,
                tradingMode: settings.tradingMode,
                addOrder,
                updateOrder,
                addPosition,
                updatePosition,
                closePosition,
                addTrade,
                updateWallet,
                updateRiskState,
                setEngineStatus,
                lockEngine,
                unlockEngine,
                resetDailyLimits,
                squareOffAll,
                addActivity,
                addStrategy,
                removeStrategy,
                updateStrategy,
                startEngine,
                stopEngine,
            }}
        >
            {children}
        </TradingContext.Provider>
    );
};
