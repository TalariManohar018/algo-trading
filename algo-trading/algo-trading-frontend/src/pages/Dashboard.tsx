import { useState, useEffect } from 'react';
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

        if (tradingContext.strategies.length === 0) {
            showError('Please add at least one strategy before starting the engine');
            return;
        }

        try {
            await tradingContext.startEngine();
            showSuccess('Paper trading engine started');
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
            <div className="flex items-center justify-center h-96">
                <div className="text-gray-500">Loading dashboard...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Trading Mode and Engine Controls */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Trading Control Center</h1>
                    <p className="text-gray-600 mt-1">Real-time overview of your trading operations</p>
                </div>

                {/* Engine Controls */}
                <div className="flex items-center space-x-3">
                    {/* Trading Mode Badge */}
                    <span className={`px-4 py-2 text-sm font-bold rounded-lg border-2 ${settings.tradingMode === 'PAPER'
                        ? 'bg-green-50 text-green-700 border-green-300'
                        : 'bg-red-50 text-red-700 border-red-300'
                        }`}>
                        {settings.tradingMode} MODE
                    </span>

                    {/* Engine Status */}
                    <div className={`px-4 py-2 rounded-lg border-2 flex items-center space-x-2 ${isEngineRunning
                        ? 'bg-green-50 text-green-700 border-green-300'
                        : isEngineLocked
                            ? 'bg-red-50 text-red-700 border-red-300'
                            : 'bg-gray-50 text-gray-700 border-gray-300'
                        }`}>
                        {isEngineRunning && <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />}
                        {isEngineLocked && <AlertCircle className="h-4 w-4 text-red-600" />}
                        <span className="text-sm font-bold">
                            {isEngineRunning ? 'ENGINE RUNNING' : isEngineLocked ? 'ENGINE LOCKED' : 'ENGINE STOPPED'}
                        </span>
                    </div>

                    {/* Engine Control Buttons */}
                    {!isEngineLocked && (
                        <>
                            {!isEngineRunning ? (
                                <button
                                    onClick={handleStartEngine}
                                    disabled={runningStrategies.length === 0}
                                    className={`px-4 py-2 rounded-lg flex items-center space-x-2 font-medium transition-colors ${runningStrategies.length === 0
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                        }`}
                                    title={runningStrategies.length === 0 ? 'Start at least one strategy first' : 'Start engine'}
                                >
                                    <Play className="h-4 w-4" />
                                    <span>Start Engine</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleStopEngine}
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center space-x-2 font-medium transition-colors"
                                >
                                    <Square className="h-4 w-4" />
                                    <span>Stop Engine</span>
                                </button>
                            )}
                        </>
                    )}

                    {/* Emergency Stop Button */}
                    <button
                        onClick={handleEmergencyStop}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center space-x-2 font-bold transition-colors"
                        title="Emergency stop - Square off all positions"
                    >
                        <AlertCircle className="h-4 w-4" />
                        <span>EMERGENCY STOP</span>
                    </button>
                </div>
            </div>

            {/* Paper Trading Banner */}
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-5 py-3 flex items-center space-x-3">
                <Info className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-yellow-800">
                    Paper Trading Mode — No Real Trades Are Being Executed
                </span>
            </div>

            {/* Risk Locked Banner */}
            {isEngineLocked && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                    <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="ml-3">
                            <h3 className="text-sm font-semibold text-red-900">ENGINE LOCKED - Risk Limit Breached</h3>
                            <p className="text-sm text-red-700 mt-1">
                                {tradingContext.riskState.lockReason}. All positions have been squared off.
                                Update your risk limits in Settings to unlock.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Live Trading Warning Banner */}
            {settings.tradingMode === 'LIVE' && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                    <div className="flex items-start">
                        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="ml-3">
                            <h3 className="text-sm font-semibold text-red-900">Live Trading Disabled</h3>
                            <p className="text-sm text-red-700 mt-1">
                                Broker not connected. Configure your broker credentials in Settings to enable live trading.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Orders In Queue */}
            {tradingContext.orders.filter(o => o.status === 'PLACED').length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RiskPanel riskGuard={riskGuard} />
                <ActivityFeed />
            </div>

            {/* Emergency Controls and Audit Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <EmergencyKillSwitch />
                <AuditLogViewer />
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
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Open Positions ({openPositions.length})</h2>
                    <div className="space-y-2">
                        {openPositions.map(position => (
                            <div key={position.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-4">
                                    <div>
                                        <p className="font-medium text-gray-900">{position.symbol}</p>
                                        <p className="text-sm text-gray-600">{position.strategyName}</p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded ${position.side === 'LONG'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                        }`}>
                                        {position.side}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-600">
                                        {position.quantity} @ ₹{position.entryPrice.toFixed(2)}
                                    </p>
                                    <p className={`text-sm font-semibold ${position.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
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
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg border border-blue-700 p-6 text-white">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <div className="flex items-center space-x-1 mb-1">
                                <p className="text-blue-100 text-sm">Active Strategies</p>
                                <span title="Number of strategies currently running" className="cursor-help"><Info className="h-3 w-3 text-blue-200" /></span>
                            </div>
                            <p className="text-3xl font-bold">{runningStrategies.length}</p>
                        </div>
                        <div>
                            <div className="flex items-center space-x-1 mb-1">
                                <p className="text-blue-100 text-sm">Total Trades</p>
                                <span title="Cumulative count of all executed paper trades" className="cursor-help"><Info className="h-3 w-3 text-blue-200" /></span>
                            </div>
                            <p className="text-3xl font-bold">{tradingContext.trades.length}</p>
                        </div>
                        <div>
                            <div className="flex items-center space-x-1 mb-1">
                                <p className="text-blue-100 text-sm">Open Positions</p>
                                <span title="Positions that have not yet been closed" className="cursor-help"><Info className="h-3 w-3 text-blue-200" /></span>
                            </div>
                            <p className="text-3xl font-bold">{openPositions.length}</p>
                        </div>
                        <div>
                            <div className="flex items-center space-x-1 mb-1">
                                <p className="text-blue-100 text-sm">Today's Loss</p>
                                <span title="Total realised loss accumulated today" className="cursor-help"><Info className="h-3 w-3 text-blue-200" /></span>
                            </div>
                            <p className="text-3xl font-bold text-red-200">
                                ₹{tradingContext.riskState.dailyLoss.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
