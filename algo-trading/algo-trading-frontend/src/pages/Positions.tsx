import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { useTradingContext } from '../context/TradingContext';
import { useError } from '../context/ErrorContext';
import { useLoading } from '../context/LoadingContext';
import { useState, useEffect } from 'react';

export default function Positions() {
    const tradingContext = useTradingContext();
    const { showError, showSuccess } = useError();
    const { setLoading } = useLoading();
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Filter open positions
    const openPositions = tradingContext.positions.filter(p => p.status === 'OPEN');

    // Auto-refresh positions every 2 seconds
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            // Positions are automatically updated by trading engine
            // This is just to trigger re-render
        }, 2000);

        return () => clearInterval(interval);
    }, [autoRefresh]);

    const handleClosePosition = (positionId: string) => {
        if (!confirm('Are you sure you want to close this position?')) return;

        try {
            const position = openPositions.find(p => p.id === positionId);
            if (!position) {
                showError('Position not found');
                return;
            }

            setLoading(true, 'Closing position...');
            tradingContext.closePosition(positionId, position.currentPrice);
            showSuccess(`Position closed. PnL: ₹${position.unrealizedPnl.toFixed(2)}`);
            setLoading(false);
        } catch (error) {
            setLoading(false);
            showError(error instanceof Error ? error.message : 'Failed to close position');
        }
    };

    const totalUnrealizedPnL = openPositions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
    const profitablePositions = openPositions.filter(p => p.unrealizedPnl > 0).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Positions</h1>
                    <p className="text-gray-600 mt-1">Monitor your open positions in real-time</p>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        {autoRefresh ? (
                            <>
                                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-sm text-gray-500">Live Updates</span>
                            </>
                        ) : (
                            <span className="text-sm text-gray-400">Updates Paused</span>
                        )}
                    </div>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`px-4 py-2 rounded-lg transition-colors ${autoRefresh
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {autoRefresh ? 'Pause' : 'Resume'}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Unrealized PnL</p>
                            <p className={`text-3xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {totalUnrealizedPnL >= 0 ? '+' : ''}₹{totalUnrealizedPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-gray-500">Live</span>
                            </div>
                        </div>
                        {totalUnrealizedPnL >= 0 ? (
                            <TrendingUp className="h-10 w-10 text-green-600" />
                        ) : (
                            <TrendingDown className="h-10 w-10 text-red-600" />
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-sm text-gray-500 mb-1">Open Positions</p>
                    <p className="text-3xl font-bold text-gray-900">{openPositions.length}</p>
                    <p className="text-sm text-gray-500 mt-2">
                        Across {new Set(openPositions.map(p => p.strategyName)).size} strategies
                    </p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-sm text-gray-500 mb-1">Profitable</p>
                    <p className="text-3xl font-bold text-gray-900">
                        {profitablePositions}/{openPositions.length}
                    </p>
                    <p className="text-sm text-green-600 mt-2">
                        {openPositions.length > 0 ? ((profitablePositions / openPositions.length) * 100).toFixed(0) : 0}% success rate
                    </p>
                </div>
            </div>

            {/* Positions Table */}
            {openPositions.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12">
                    <div className="text-center">
                        <div className="text-gray-400 text-5xl mb-4">📊</div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Open Positions</h3>
                        <p className="text-gray-500">
                            No trades yet. Start paper trading to see activity.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">Open Positions ({openPositions.length})</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Strategy
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Symbol
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Side
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Entry Price
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Current Price
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Quantity
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Unrealized PnL
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {openPositions.map((position) => {
                                    const pnlPercentage = ((position.unrealizedPnl / (position.entryPrice * position.quantity)) * 100);
                                    return (
                                        <tr key={position.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{position.strategyName}</div>
                                                <div className="text-xs text-gray-500">{new Date(position.openedAt).toLocaleString()}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{position.symbol}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${position.side === 'LONG'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {position.side}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                ₹{position.entryPrice.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                ₹{position.currentPrice.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {position.quantity}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className={`text-sm font-semibold ${position.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {position.unrealizedPnl >= 0 ? '+' : ''}₹{position.unrealizedPnl.toFixed(2)}
                                                </div>
                                                <div className={`text-xs ${position.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
                                                    }`}>
                                                    {position.unrealizedPnl >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <button
                                                    onClick={() => handleClosePosition(position.id)}
                                                    className="flex items-center space-x-1 text-red-600 hover:text-red-800 font-medium transition-colors"
                                                >
                                                    <X className="h-4 w-4" />
                                                    <span>Close</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
