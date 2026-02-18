import { useState } from 'react';
import { TrendingUp, TrendingDown, Filter, BarChart3 } from 'lucide-react';
import { useTradingContext } from '../context/TradingContext';

export default function Trades() {
    const tradingContext = useTradingContext();
    const [filterSide, setFilterSide] = useState<'All' | 'BUY' | 'SELL'>('All');

    const filteredTrades = tradingContext.trades.filter(trade => {
        const matchesSide = filterSide === 'All' || trade.side === filterSide;
        return matchesSide;
    });

    const totalPnL = filteredTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const winningTrades = filteredTrades.filter(t => t.pnl > 0).length;
    const winRate = filteredTrades.length > 0 ? (winningTrades / filteredTrades.length) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Trades</h1>
                    <p className="text-gray-600 mt-1">View and analyze all your trading activity</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Total PnL</p>
                            <p className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        {totalPnL >= 0 ? (
                            <TrendingUp className="h-10 w-10 text-green-600" />
                        ) : (
                            <TrendingDown className="h-10 w-10 text-red-600" />
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-sm text-gray-500 mb-1">Total Trades</p>
                    <p className="text-3xl font-bold text-gray-900">{filteredTrades.length}</p>
                    <p className="text-sm text-gray-500 mt-2">
                        All completed trades
                    </p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-sm text-gray-500 mb-1">Win Rate</p>
                    <p className="text-3xl font-bold text-gray-900">{winRate.toFixed(1)}%</p>
                    <p className="text-sm text-green-600 mt-2">
                        {winningTrades} winning trades
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center space-x-4">
                    <Filter className="h-5 w-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Filters:</span>

                    <select
                        value={filterSide}
                        onChange={(e) => setFilterSide(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                        <option value="All">All Sides</option>
                        <option value="BUY">Buy</option>
                        <option value="SELL">Sell</option>
                    </select>

                    <span className="text-sm text-gray-500">Showing {filteredTrades.length} trades</span>
                </div>
            </div>

            {/* Trades Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {filteredTrades.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-700 text-lg font-medium mb-2">No trades yet</p>
                            <p className="text-gray-400 text-sm">Start paper trading to see activity here.</p>
                        </div>
                    </div>
                ) : (
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
                                        Entry
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Exit
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Qty
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        PnL
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Executed At
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredTrades.map((trade) => (
                                    <tr key={trade.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{trade.strategyName}</div>
                                            <div className="text-xs text-gray-500">ID: {trade.strategyId}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{trade.symbol}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${trade.side === 'BUY'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                                }`}>
                                                {trade.side}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ₹{trade.entryPrice.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            ₹{trade.exitPrice.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {trade.quantity}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className={`text-sm font-semibold ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                {trade.pnl >= 0 ? '+' : ''}₹{trade.pnl.toFixed(2)}
                                            </div>
                                            <div className={`text-xs ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                                                }`}>
                                                {trade.pnl >= 0 ? '+' : ''}{((trade.pnl / (trade.entryPrice * trade.quantity)) * 100).toFixed(2)}%
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {new Date(trade.executedAt).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(trade.executedAt).toLocaleTimeString()}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
