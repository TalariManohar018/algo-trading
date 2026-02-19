import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';
import { useTradingContext } from '../context/TradingContext';

interface StrategyMetrics {
    strategyId: string;
    strategyName: string;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    openPositions: number;
}

export default function StrategyPerformance() {
    const { trades, positions } = useTradingContext();
    const [metrics, setMetrics] = useState<StrategyMetrics[]>([]);

    useEffect(() => {
        // Calculate metrics per strategy
        const strategyMap = new Map<string, StrategyMetrics>();

        // Process trades
        trades.forEach(trade => {
            if (!strategyMap.has(trade.strategyId)) {
                strategyMap.set(trade.strategyId, {
                    strategyId: trade.strategyId,
                    strategyName: trade.strategyName,
                    totalTrades: 0,
                    winningTrades: 0,
                    losingTrades: 0,
                    totalPnL: 0,
                    winRate: 0,
                    avgWin: 0,
                    avgLoss: 0,
                    profitFactor: 0,
                    openPositions: 0,
                });
            }

            const metric = strategyMap.get(trade.strategyId)!;
            metric.totalTrades++;
            metric.totalPnL += trade.pnl;

            if (trade.pnl > 0) {
                metric.winningTrades++;
            } else if (trade.pnl < 0) {
                metric.losingTrades++;
            }
        });

        // Process open positions
        positions.filter(p => p.status === 'OPEN').forEach(position => {
            if (strategyMap.has(position.strategyId)) {
                strategyMap.get(position.strategyId)!.openPositions++;
            }
        });

        // Calculate derived metrics
        strategyMap.forEach(metric => {
            metric.winRate = metric.totalTrades > 0
                ? (metric.winningTrades / metric.totalTrades) * 100
                : 0;

            const wins = trades
                .filter(t => t.strategyId === metric.strategyId && t.pnl > 0)
                .map(t => t.pnl);
            const losses = trades
                .filter(t => t.strategyId === metric.strategyId && t.pnl < 0)
                .map(t => Math.abs(t.pnl));

            metric.avgWin = wins.length > 0
                ? wins.reduce((a, b) => a + b, 0) / wins.length
                : 0;
            metric.avgLoss = losses.length > 0
                ? losses.reduce((a, b) => a + b, 0) / losses.length
                : 0;

            metric.profitFactor = metric.avgLoss > 0
                ? metric.avgWin / metric.avgLoss
                : 0;
        });

        setMetrics(Array.from(strategyMap.values()).sort((a, b) => b.totalPnL - a.totalPnL));
    }, [trades, positions]);

    if (metrics.length === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-6">
                <Target className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Strategy Performance</h3>
            </div>

            <div className="space-y-4">
                {metrics.map(metric => (
                    <div
                        key={metric.strategyId}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{metric.strategyName}</h4>
                                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                                    <span>{metric.totalTrades} trades</span>
                                    <span>•</span>
                                    <span>{metric.openPositions} open</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`text-lg font-bold ${metric.totalPnL >= 0
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                    }`}>
                                    {metric.totalPnL >= 0 ? '+' : ''}₹{metric.totalPnL.toFixed(2)}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 pt-3 border-t border-gray-200">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Win Rate</p>
                                <div className="flex items-center space-x-1">
                                    <Activity className="h-3 w-3 text-blue-600" />
                                    <p className="text-sm font-semibold text-gray-900">
                                        {metric.winRate.toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Avg Win</p>
                                <div className="flex items-center space-x-1">
                                    <TrendingUp className="h-3 w-3 text-green-600" />
                                    <p className="text-sm font-semibold text-green-600">
                                        ₹{metric.avgWin.toFixed(0)}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Avg Loss</p>
                                <div className="flex items-center space-x-1">
                                    <TrendingDown className="h-3 w-3 text-red-600" />
                                    <p className="text-sm font-semibold text-red-600">
                                        ₹{metric.avgLoss.toFixed(0)}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Profit Factor</p>
                                <p className={`text-sm font-semibold ${metric.profitFactor >= 1.5
                                    ? 'text-green-600'
                                    : metric.profitFactor >= 1
                                        ? 'text-yellow-600'
                                        : 'text-red-600'
                                    }`}>
                                    {metric.profitFactor.toFixed(2)}x
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
