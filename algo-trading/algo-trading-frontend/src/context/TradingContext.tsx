import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { paperTradingEngine, ActivityEvent, ExecutableStrategy } from '../services/paperTradingEngine';
import { paperWalletService } from '../services/paperWalletService';
import { paperPositionService } from '../services/paperPositionService';
import { useSettings } from './SettingsContext';

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

    // Sync trading mode to engine whenever settings change
    useEffect(() => {
        paperTradingEngine.setTradingMode(settings.tradingMode);
        console.log(`[TradingContext] Trading mode synced to engine: ${settings.tradingMode}`);
    }, [settings.tradingMode]);
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

    const [wallet, setWallet] = useState<WalletState>(() => {
        return paperWalletService.getWallet();
    });

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

    // Connect to paper trading engine events
    useEffect(() => {
        const handleOrderCreated = (order: Order) => addOrder(order);
        const handleOrderUpdated = (order: Order) => updateOrder(order.id, order);
        const handlePositionOpened = (position: Position) => addPosition(position);
        const handleActivity = (event: ActivityEvent) => addActivity(event);
        const handleStatusChange = (status: EngineStatus) => setEngineStatus(status);

        const handleUpdateUnrealizedPnl = (data: { symbol: string; price: number }) => {
            setPositions(prev => prev.map(pos => {
                if (pos.symbol === data.symbol && pos.status === 'OPEN') {
                    const updated = paperPositionService.updateUnrealizedPnl(pos, data.price);
                    return updated;
                }
                return pos;
            }));

            // Update total unrealized PnL
            const totalUnrealized = positions
                .filter(p => p.status === 'OPEN')
                .reduce((sum, p) => sum + p.unrealizedPnl, 0);
            paperWalletService.updateUnrealizedPnl(totalUnrealized);
            setWallet(paperWalletService.getWallet());
        };

        const handleCheckPositions = (_strategyId: string, callback: (positions: Position[]) => void) => {
            callback(positions);
        };

        const handleExitSignal = (strategyId: string, exitPrice: number) => {
            const openPositions = positions.filter(p => p.strategyId === strategyId && p.status === 'OPEN');
            openPositions.forEach(pos => closePosition(pos.id, exitPrice));
        };

        paperTradingEngine.on('orderCreated', handleOrderCreated);
        paperTradingEngine.on('orderUpdated', handleOrderUpdated);
        paperTradingEngine.on('positionOpened', handlePositionOpened);
        paperTradingEngine.on('activity', handleActivity);
        paperTradingEngine.on('statusChange', handleStatusChange);
        paperTradingEngine.on('updateUnrealizedPnl', handleUpdateUnrealizedPnl);
        paperTradingEngine.on('checkPositions', handleCheckPositions);
        paperTradingEngine.on('exitSignal', handleExitSignal);

        return () => {
            paperTradingEngine.off('orderCreated', handleOrderCreated);
            paperTradingEngine.off('orderUpdated', handleOrderUpdated);
            paperTradingEngine.off('positionOpened', handlePositionOpened);
            paperTradingEngine.off('activity', handleActivity);
            paperTradingEngine.off('statusChange', handleStatusChange);
            paperTradingEngine.off('updateUnrealizedPnl', handleUpdateUnrealizedPnl);
            paperTradingEngine.off('checkPositions', handleCheckPositions);
            paperTradingEngine.off('exitSignal', handleExitSignal);
        };
    }, [positions]);

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem('trading_orders', JSON.stringify(orders));
    }, [orders]);

    useEffect(() => {
        localStorage.setItem('trading_positions', JSON.stringify(positions));
    }, [positions]);

    useEffect(() => {
        localStorage.setItem('trading_trades', JSON.stringify(trades));
    }, [trades]);

    useEffect(() => {
        localStorage.setItem('trading_risk_state', JSON.stringify(riskState));
    }, [riskState]);

    useEffect(() => {
        localStorage.setItem('trading_activity', JSON.stringify(activityLog));
    }, [activityLog]);

    useEffect(() => {
        localStorage.setItem('trading_strategies', JSON.stringify(strategies));
    }, [strategies]);

    const addOrder = (order: Order) => {
        setOrders(prev => [...prev, order]);
    };

    const updateOrder = (orderId: string, updates: Partial<Order>) => {
        setOrders(prev => prev.map(order =>
            order.id === orderId ? { ...order, ...updates } : order
        ));
    };

    const addPosition = (position: Position) => {
        setPositions(prev => [...prev, position]);
    };

    const updatePosition = (positionId: string, updates: Partial<Position>) => {
        setPositions(prev => prev.map(position =>
            position.id === positionId ? { ...position, ...updates } : position
        ));
    };

    const closePosition = (positionId: string, exitPrice: number) => {
        const position = positions.find(p => p.id === positionId);
        if (!position) return;

        const { position: closedPosition, trade } = paperPositionService.closePosition(position, exitPrice);

        // Update position
        updatePosition(positionId, closedPosition);

        // Create trade record
        addTrade(trade);

        // Release capital and update wallet
        const marginReleased = position.entryPrice * position.quantity * 0.2;
        paperWalletService.releaseCapital(marginReleased);
        paperWalletService.recordRealizedPnl(trade.pnl);
        setWallet(paperWalletService.getWallet());

        // Update risk state
        updateRiskState({
            dailyLoss: riskState.dailyLoss + (trade.pnl < 0 ? Math.abs(trade.pnl) : 0),
            dailyTradeCount: riskState.dailyTradeCount + 1,
        });
    };

    const addTrade = (trade: Trade) => {
        setTrades(prev => [trade, ...prev]);
    };

    const updateWallet = (updates: Partial<WalletState>) => {
        setWallet(prev => ({ ...prev, ...updates }));
    };

    const updateRiskState = (updates: Partial<RiskState>) => {
        setRiskState(prev => ({ ...prev, ...updates }));
    };

    const lockEngine = (reason: string) => {
        setRiskState(prev => ({ ...prev, isLocked: true, lockReason: reason }));
        setEngineStatus('LOCKED');
    };

    const unlockEngine = () => {
        setRiskState(prev => ({ ...prev, isLocked: false, lockReason: undefined }));
        if (engineStatus === 'LOCKED') {
            setEngineStatus('STOPPED');
        }
    };

    const resetDailyLimits = () => {
        setRiskState(prev => ({ ...prev, dailyLoss: 0, dailyTradeCount: 0 }));
        paperTradingEngine.resetDailyCounters();
    };

    const squareOffAll = () => {
        const openPositions = positions.filter(p => p.status === 'OPEN');
        openPositions.forEach(position => {
            closePosition(position.id, position.currentPrice);
        });
    };

    const addActivity = (event: ActivityEvent) => {
        setActivityLog(prev => [event, ...prev].slice(0, 100));
    };

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
        console.log(`[TradingContext] Engine running | Virtual wallet: ₹${paperWalletService.getBalance().toFixed(2)}`);
    };

    const stopEngine = async () => {
        console.log('[TradingContext] Stopping engine');
        await paperTradingEngine.stopEngine();
        setEngineStatus('STOPPED');
    };;

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