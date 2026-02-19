import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Play, Square, AlertCircle, Info } from 'lucide-react';
import { Strategy } from '../services/strategyService';
import { tradingEngine } from '../services/tradingEngine';
import { useTradingContext } from '../context/TradingContext';
import { useError } from '../context/ErrorContext';
import { useSettings } from '../context/SettingsContext';
import { useLoading } from '../context/LoadingContext';
import AccountSummary from '../components/AccountSummary';
import RiskPanel from '../components/RiskPanel';
import ActivityFeed from '../components/ActivityFeed';
import RunningStrategies from '../components/RunningStrategies';
import RecentTradesTable from '../components/RecentTradesTable';
import EquityCurve from '../components/EquityCurve';
import FirstTimeGuidance from '../components/FirstTimeGuidance';
import OrderBook from '../components/OrderBook';
import EngineStatusPanel from '../components/EngineStatusPanel';
import StrategyPerformance from '../components/StrategyPerformance';
import EmergencyKillSwitch from '../components/EmergencyKillSwitch';
import AuditLogViewer from '../components/AuditLogViewer';

export default function Dashboard() {
    const { showError, showSuccess } = useError();
    const { settings } = useSettings();
    const { setLoading: setGlobalLoading } = useLoading();
    const tradingContext = useTradingContext();

    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
        initializeTradingEngine();
    }, []);

    // Sync strategies from TradingContext
    useEffect(() => {
        fetchDashboardData();
    }, [tradingContext.strategies]);

    // Update engine when trading context changes
    useEffect(() => {
        if (tradingContext.riskState.isLocked && tradingContext.engineStatus === 'RUNNING') {
            tradingEngine.emergencyStop();
            tradingContext.setEngineStatus('LOCKED');
            tradingContext.squareOffAll();
            showError(`RISK LOCK: ${tradingContext.riskState.lockReason}`);
        }
    }, [tradingContext.riskState.isLocked]);

    const logActivity = (message: string, type: string) => {
        const typeMap: Record<string, { icon: string; color: string }> = {
            'engine_started': { icon: 'play', color: 'green' },
            'engine_stopped': { icon: 'stop', color: 'orange' },
            'emergency_stop': { icon: 'stop', color: 'red' },
            'signal_generated': { icon: 'activity', color: 'blue' },
            'order_created': { icon: 'activity', color: 'blue' },
            'order_placed': { icon: 'activity', color: 'blue' },
            'order_filled': { icon: 'check', color: 'green' },
            'order_rejected': { icon: 'activity', color: 'red' },
            'position_opened': { icon: 'up', color: 'green' },
            'position_closed': { icon: 'down', color: 'orange' },
            'risk_breach': { icon: 'stop', color: 'red' },
        };

        const eventType = typeMap[type] || { icon: 'activity', color: 'gray' };

        const event = {
            id: `${Date.now()}-${Math.random()}`,
            type,
            message,
            timestamp: new Date(),
            icon: eventType.icon,
            color: eventType.color,
        };

        // Save to localStorage
        const stored = localStorage.getItem('algotrader_activity') || '[]';
        const events = JSON.parse(stored);
        const updated = [event, ...events].slice(0, 100); // Keep last 100 events
        localStorage.setItem('algotrader_activity', JSON.stringify(updated));

        // Trigger storage event for other components
        window.dispatchEvent(new Event('storage'));
    };

    const initializeTradingEngine = () => {
        tradingEngine.init({
            onOrderCreated: (order) => {
                tradingContext.addOrder(order);
            },
            onOrderUpdated: (order) => {
                tradingContext.updateOrder(order.id, order);
            },
            onPositionCreated: (position) => {
                tradingContext.addPosition(position);
            },
            onPositionUpdated: (position) => {
                tradingContext.updatePosition(position.id, position);
            },
            onPositionClosed: (position) => {
                tradingContext.closePosition(position.id, position.currentPrice);
            },
            onEngineError: (error) => {
                showError(error);
            },
            onActivityLog: logActivity,
            getRiskState: () => tradingContext.riskState,
            getWalletState: () => tradingContext.wallet,
            getStrategies: () => strategies,
            getPositions: () => tradingContext.positions,
            lockEngine: (reason) => tradingContext.lockEngine(reason),
        });
    };

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            // Use strategies from TradingContext (paper trading) and map to UI format
            const mappedStrategies = tradingContext.strategies.map((s, index) => {
                // Extract numeric ID from string ID like "STR-DEMO-1" or "STR-1"
                const idParts = s.id.split('-');
                const numericId = parseInt(idParts[idParts.length - 1]) || (index + 1);

                // Combine entry and exit conditions for UI
                const entryConditions = (s.entryConditions || []).map((c, i) => ({
                    id: i,
                    type: c.indicatorType,
                    indicator: c.indicatorType,
                    operator: c.conditionType,
                    value: c.value,
                }));

                const exitConditions = (s.exitConditions || []).map((c, i) => ({
                    id: entryConditions.length + i,
                    type: c.indicatorType,
                    indicator: c.indicatorType,
                    operator: c.conditionType,
                    value: c.value,
                }));

                return {
                    ...s,
                    id: numericId,
                    conditions: [...entryConditions, ...exitConditions],
                    originalId: s.id, // Keep original ID for lookups
                } as any;
            });
            setStrategies(mappedStrategies);
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Error fetching dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const handleStartEngine = async () => {
        if (tradingContext.riskState.isLocked) {
            showError(`Engine locked: ${tradingContext.riskState.lockReason}`);
            return;
        }

        if (tradingContext.tradingMode === 'LIVE') {
            showError('Live Trading mode is active but broker is not connected. Go to Broker Connect page to link your Angel One account.');
            console.warn('[Dashboard] Engine start blocked — LIVE mode, broker not connected');
            return;
        }

        if (tradingContext.strategies.length === 0) {
            showError('Please add at least one strategy before starting the engine');
            return;
        }

        try {
            await tradingContext.startEngine();
            showSuccess(`Paper trading engine started — using virtual wallet`);
            console.log(`[Dashboard] Engine started | Mode: ${tradingContext.tradingMode}`);
        } catch (error: any) {
            showError(error.message || 'Failed to start engine');
        }
    };

    const handleStopEngine = async () => {
        try {
            await tradingContext.stopEngine();
            showSuccess('Paper trading engine stopped');
        } catch (error: any) {
            showError(error.message || 'Failed to stop engine');
        }
    };

    const handleEmergencyStop = async () => {
        try {
            await tradingEngine.emergencyStop();
            tradingContext.setEngineStatus('STOPPED');
            tradingContext.squareOffAll();
            showSuccess('Emergency stop executed - All positions squared off');
        } catch (error: any) {
            showError(error.message || 'Emergency stop failed');
        }
    };

    const handleStartStrategy = async (id: number) => {
        try {
            // Check if multiple strategies are allowed
            const runningCount = strategies.filter(s =>
                s.status === 'RUNNING' || (s.status as any) === 'ACTIVE'
            ).length;
            if (!settings.allowMultipleStrategies && runningCount > 0) {
                showError('Only one strategy can run at a time. Stop other strategies first or enable "Allow Multiple Strategies" in Settings.');
                return;
            }

            setGlobalLoading(true, 'Starting strategy...');

            // Find the strategy by numeric ID
            const strategyData = strategies.find(s => s.id === id);
            if (!strategyData) {
                showError('Strategy not found');
                setGlobalLoading(false);
                return;
            }

            // Find in trading context using originalId or name
            const originalId = (strategyData as any).originalId;
            const strategy = tradingContext.strategies.find(s =>
                s.id === originalId || s.name === strategyData.name
            );

            if (strategy) {
                const updatedStrategy = { ...strategy, status: 'ACTIVE' as const };
                tradingContext.updateStrategy(updatedStrategy);
                if (settings.notifications.strategyStarted) {
                    showSuccess('Strategy started in paper trading mode');
                }
            } else {
                showError('Strategy not found in trading context');
            }

            await fetchDashboardData();
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Failed to start strategy');
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleStopStrategy = async (id: number) => {
        try {
            setGlobalLoading(true, 'Stopping strategy...');

            // Find the strategy by numeric ID
            const strategyData = strategies.find(s => s.id === id);
            if (!strategyData) {
                showError('Strategy not found');
                setGlobalLoading(false);
                return;
            }

            // Find in trading context using originalId or name
            const originalId = (strategyData as any).originalId;
            const strategy = tradingContext.strategies.find(s =>
                s.id === originalId || s.name === strategyData.name
            );

            if (strategy) {
                const updatedStrategy = { ...strategy, status: 'STOPPED' as const };
                tradingContext.updateStrategy(updatedStrategy);
                if (settings.notifications.strategyStopped) {
                    showSuccess('Strategy stopped');
                }
            } else {
                showError('Strategy not found in trading context');
            }

            await fetchDashboardData();
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Failed to stop strategy');
        } finally {
            setGlobalLoading(false);
        }
    };

    const isFirstTimeUser = strategies.length === 0 && tradingContext.trades.length === 0;
    const runningStrategies = strategies.filter(s => s.status === 'RUNNING' || (s.status as any) === 'ACTIVE');
    const openPositions = tradingContext.positions.filter(p => p.status === 'OPEN');
    const isEngineRunning = tradingContext.engineStatus === 'RUNNING';
    const isEngineLocked = tradingContext.engineStatus === 'LOCKED';

    // Generate equity data from trades
    const equityData = tradingContext.trades
        .sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime())
        .reduce((acc, trade, index) => {
            const prevEquity = index === 0 ? settings.startingCapital : acc[index - 1].equity;
            const newEquity = prevEquity + (trade.pnl || 0);
            acc.push({
                date: new Date(trade.executedAt).toLocaleDateString(),
                equity: newEquity
            });
            return acc;
        }, [] as Array<{ date: string; equity: number }>);

    // Account data from trading context
    const accountData = {
        walletBalance: tradingContext.wallet.balance,
        availableMargin: tradingContext.wallet.availableMargin,
        usedMargin: tradingContext.wallet.usedMargin,
        realizedPnl: tradingContext.wallet.realizedPnl,
        unrealizedPnl: tradingContext.wallet.unrealizedPnl,
        totalPnl: tradingContext.wallet.realizedPnl + tradingContext.wallet.unrealizedPnl,
        startingCapital: settings.startingCapital,
    };

    // Risk guard from trading context
    const settingsData = JSON.parse(localStorage.getItem('algo_trading_settings') || '{}');
    const riskManagement = settingsData.riskManagement || { maxLossPerDay: 5000, maxTradesPerDay: 10 };
    const riskGuard = {
        maxLossPerDay: riskManagement.maxLossPerDay,
        currentDayLoss: tradingContext.riskState.dailyLoss,
        remainingRisk: riskManagement.maxLossPerDay - tradingContext.riskState.dailyLoss,
        tradeCountToday: tradingContext.riskState.dailyTradeCount,
        maxTradesPerDay: riskManagement.maxTradesPerDay,
        isRiskBreached: tradingContext.riskState.isLocked,
        breachReason: tradingContext.riskState.lockReason,
        riskStatus: tradingContext.riskState.isLocked
            ? 'RISK_LOCKED' as const
            : (riskManagement.maxLossPerDay - tradingContext.riskState.dailyLoss) < riskManagement.maxLossPerDay * 0.2
                ? 'WARNING' as const
                : 'OK' as const,
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="page-header">
                    <div>
                        <div className="skeleton h-7 w-56 mb-2" />
                        <div className="skeleton h-4 w-40" />
                    </div>
                    <div className="flex gap-2">
                        <div className="skeleton h-9 w-28" />
                        <div className="skeleton h-9 w-28" />
                    </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="stat-card"><div className="skeleton h-4 w-24 mb-3" /><div className="skeleton h-7 w-32" /></div>)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-[1600px]">
            {/* Header with Trading Mode and Engine Controls */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Trading Control Center</h1>
                    <p className="page-sub">Real-time overview of your trading operations</p>
                </div>

                {/* Engine Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Trading Mode Badge */}
                    <span className={`badge text-xs font-bold px-3 py-1.5 ${tradingContext.tradingMode === 'PAPER' ? 'badge-green' : 'badge-red'
                        }`}>
                        {tradingContext.tradingMode} MODE
                    </span>

                    {/* Engine Status */}
                    <div className={`badge text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 ${isEngineRunning
                        ? 'badge-green'
                        : isEngineLocked
                            ? 'badge-red'
                            : 'badge-gray'
                        }`}>
                        {isEngineRunning && <span className="live-dot" />}
                        {isEngineLocked && <AlertCircle className="h-3 w-3" />}
                        {isEngineRunning ? 'RUNNING' : isEngineLocked ? 'LOCKED' : 'STOPPED'}
                    </div>

                    {/* Engine Control Buttons */}
                    {!isEngineLocked && (
                        <>
                            {!isEngineRunning ? (
                                <button
                                    onClick={handleStartEngine}
                                    disabled={runningStrategies.length === 0}
                                    className="btn-success btn-sm"
                                    title={runningStrategies.length === 0 ? 'Start at least one strategy first' : 'Start engine'}
                                >
                                    <Play className="h-3.5 w-3.5" />
                                    Start Engine
                                </button>
                            ) : (
                                <button onClick={handleStopEngine} className="btn btn-sm bg-orange-500 text-white hover:bg-orange-600">
                                    <Square className="h-3.5 w-3.5" />
                                    Stop Engine
                                </button>
                            )}
                        </>
                    )}

                    {/* Emergency Stop Button */}
                    <button
                        onClick={handleEmergencyStop}
                        className="btn-danger btn-sm font-bold"
                        title="Emergency stop - Square off all positions"
                    >
                        <AlertCircle className="h-3.5 w-3.5" />
                        EMERGENCY STOP
                    </button>
                </div>
            </div>

            {/* Mode Banner */}
            {tradingContext.tradingMode === 'PAPER' ? (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <Info className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-sm font-medium text-amber-800">
                        Paper Trading Mode — No real trades are being executed. Virtual wallet: ₹{settings.startingCapital.toLocaleString('en-IN')}
                    </span>
                </div>
            ) : (
                <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-xl px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <span className="text-sm font-semibold text-red-800">
                        Live Trading Mode active — Broker not connected. <a href="/broker" className="underline">Connect Angel One</a>
                    </span>
                </div>
            )}

            {/* Risk Locked Banner */}
            {isEngineLocked && (
                <div className="flex items-start gap-3 bg-red-50 border-l-4 border-red-500 rounded-xl px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-red-900">Engine Locked — Risk limit breached</p>
                        <p className="text-xs text-red-700 mt-0.5">{tradingContext.riskState.lockReason}. Update risk limits in Settings to unlock.</p>
                    </div>
                </div>
            )}

            {/* Live Trading Separately Disabled Banner */}
            {tradingContext.tradingMode === 'LIVE' && (
                <div className="flex items-start gap-3 bg-red-50 border-l-4 border-red-500 rounded-xl px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-red-900">Live Trading Disabled</p>
                        <p className="text-xs text-red-700 mt-0.5">Broker not connected. <a href="/broker" className="underline font-semibold">Connect Angel One</a> to enable live trading.</p>
                    </div>
                </div>
            )}

            {/* Orders In Queue */}
            {tradingContext.orders.filter(o => o.status === 'PLACED').length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">Orders In Queue</h3>
                    <div className="space-y-2">
                        {tradingContext.orders
                            .filter(o => o.status === 'PLACED')
                            .map(order => (
                                <div key={order.id} className="flex items-center justify-between text-sm">
                                    <span className="text-blue-700">
                                        {order.side} {order.quantity} {order.symbol} @ ₹{order.placedPrice?.toFixed(2)}
                                    </span>
                                    <span className="text-blue-600 font-medium">{order.status}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* First-Time User Guidance */}
            {isFirstTimeUser && <FirstTimeGuidance />}

            {/* Engine Status Panel */}
            <EngineStatusPanel />

            {/* Account Overview */}
            <AccountSummary accountData={accountData} />

            {/* Order Book */}
            <OrderBook />

            {/* Risk Guard and Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                <div className="h-full"><RiskPanel riskGuard={riskGuard} /></div>
                <div className="h-full"><ActivityFeed /></div>
            </div>

            {/* Emergency Controls and Audit Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                <div className="h-full"><EmergencyKillSwitch /></div>
                <div className="h-full"><AuditLogViewer /></div>
            </div>

            {/* Running Strategies */}
            <RunningStrategies
                strategies={strategies}
                onStart={handleStartStrategy}
                onStop={handleStopStrategy}
                isRiskBreached={riskGuard?.isRiskBreached}
            />

            {/* Open Positions */}
            {openPositions.length > 0 && (
                <div className="card p-5">
                    <h2 className="section-title mb-4">Open Positions ({openPositions.length})</h2>
                    <div className="space-y-2">
                        {openPositions.map(position => (
                            <div key={position.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-gray-900 text-sm">{position.symbol}</span>
                                    <span className="text-xs text-gray-500">{position.strategyName}</span>
                                    <span className={`badge ${position.side === 'LONG' ? 'badge-green' : 'badge-red'}`}>
                                        {position.side}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">{position.quantity} @ ₹{position.entryPrice.toFixed(2)}</p>
                                    <p className={`text-sm font-semibold ${position.unrealizedPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {position.unrealizedPnl >= 0 ? '+' : ''}₹{position.unrealizedPnl.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Equity Curve */}
            <EquityCurve
                equityData={equityData}
                startingCapital={settings.startingCapital}
            />

            {/* Strategy Performance */}
            <StrategyPerformance />

            {/* Recent Trades */}
            <RecentTradesTable trades={tradingContext.trades} maxItems={10} />

            {/* Quick Stats Summary */}
            {!isFirstTimeUser && runningStrategies.length > 0 && (
                <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { label: 'Active Strategies', value: runningStrategies.length, tip: 'Strategies currently running' },
                            { label: 'Total Trades', value: tradingContext.trades.length, tip: 'Cumulative executed trades' },
                            { label: 'Open Positions', value: openPositions.length, tip: 'Positions not yet closed' },
                            {
                                label: "Today's Loss",
                                value: `₹${tradingContext.riskState.dailyLoss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                                tip: 'Total realized loss today',
                                accent: true
                            },
                        ].map(item => (
                            <div key={item.label}>
                                <p className="text-blue-100 text-xs mb-1">{item.label}</p>
                                <p className={`text-2xl font-bold ${item.accent ? 'text-red-200' : ''}`}>{item.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
