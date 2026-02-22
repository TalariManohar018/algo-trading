import { useEffect, useState } from 'react';
import { Activity, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react';
import { useTradingContext } from '../context/TradingContext';
import { tradingEngine } from '../services/tradingEngine';

interface EngineStatusPanelProps {
    engineStatus?: any;
    wallet?: any;
    todayTrades?: number;
}

export default function EngineStatusPanel({ engineStatus: backendEngineStatus, wallet: backendWallet, todayTrades }: EngineStatusPanelProps) {
    const tradingContext = useTradingContext();
    const [detailedStatus, setDetailedStatus] = useState<any>(null);

    useEffect(() => {
        const updateStatus = () => {
            const status = tradingEngine.getDetailedStatus();
            setDetailedStatus(status);
        };

        updateStatus();
        const interval = setInterval(updateStatus, 3000);

        return () => clearInterval(interval);
    }, []);

    // Use backend data if available, otherwise fall back to context
    const isRunning = backendEngineStatus ? backendEngineStatus.activeStrategies > 0 : tradingContext.engineStatus === 'RUNNING';
    const isLocked = tradingContext.engineStatus === 'LOCKED';
    const statusText = backendEngineStatus 
        ? (backendEngineStatus.activeStrategies > 0 ? 'RUNNING' : 'STOPPED')
        : tradingContext.engineStatus;

    const wallet = backendWallet || detailedStatus?.walletSummary;
    const totalEquity = wallet ? (wallet.balance + (wallet.unrealizedPnl || 0)) : 0;
    const netPnl = wallet ? ((wallet.realizedPnl || 0) + (wallet.unrealizedPnl || 0)) : 0;

    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-sm p-6 text-white">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${isRunning
                        ? 'bg-green-500/20'
                        : isLocked
                            ? 'bg-red-500/20'
                            : 'bg-gray-500/20'
                        }`}>
                        <Activity className={`h-6 w-6 ${isRunning
                            ? 'text-green-400'
                            : isLocked
                                ? 'text-red-400'
                                : 'text-gray-400'
                            }`} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold tracking-tight">Trading Engine</h3>
                        <div className="flex items-center space-x-2 mt-1">
                            {isRunning && <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>}
                            <span className={`text-sm ${isRunning
                                ? 'text-green-400'
                                : isLocked
                                    ? 'text-red-400'
                                    : 'text-gray-400'
                                }`}>
                                {statusText}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {wallet && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Wallet Summary */}
                    <>
                        <div className="bg-slate-800/50 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                                <DollarSign className="h-4 w-4 text-blue-400" />
                                <span className="text-xs text-slate-400">Total Equity</span>
                            </div>
                            <p className="text-xl font-bold text-white">
                                ₹{totalEquity.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                        </div>

                        <div className="bg-slate-800/50 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                                <TrendingUp className="h-4 w-4 text-green-400" />
                                <span className="text-xs text-slate-400">Net PnL</span>
                            </div>
                            <p className={`text-xl font-bold ${netPnl >= 0
                                ? 'text-green-400'
                                : 'text-red-400'
                                }`}>
                                {netPnl >= 0 ? '+' : ''}
                                ₹{netPnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </>

                    {/* Risk Summary */}
                    <>
                        <div className="bg-slate-800/50 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-green-400" />
                                <span className="text-xs text-slate-400">Risk Level</span>
                            </div>
                            <p className="text-xl font-bold text-green-400">
                                LOW
                            </p>
                        </div>

                        <div className="bg-slate-800/50 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                                <Activity className="h-4 w-4 text-purple-400" />
                                <span className="text-xs text-slate-400">Today's Trades</span>
                            </div>
                            <p className="text-xl font-bold text-white">
                                {todayTrades !== undefined ? todayTrades : tradingContext.riskState.dailyTradeCount}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                Loss: ₹{tradingContext.riskState.dailyLoss.toFixed(0)}
                            </p>
                        </div>
                    </>
                </div>
            )}

            {isLocked && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-300 font-medium">
                        ⚠️ {tradingContext.riskState.lockReason}
                    </p>
                </div>
            )}
        </div>
    );
}
