import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { Trade } from '../context/TradingContext';
import { useNavigate } from 'react-router-dom';

interface RecentTradesTableProps {
    trades: Trade[];
    maxItems?: number;
}

export default function RecentTradesTable({ trades, maxItems = 10 }: RecentTradesTableProps) {
    const navigate = useNavigate();
    const recentTrades = trades.slice(0, maxItems);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Recent Trades</h3>
                <button
                    onClick={() => navigate('/trades')}
                    className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                >
                    <span>View All</span>
                    <ArrowRight className="h-4 w-4" />
                </button>
            </div>

            {recentTrades.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Strategy</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Side</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Entry</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Exit</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">PnL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {recentTrades.map((trade) => (
                                <tr key={trade.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-3 text-xs text-gray-600">
                                        {new Date(trade.executedAt).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                    <td className="px-3 py-3 text-xs font-medium text-gray-900 truncate max-w-[100px]">
                                        {trade.strategyName}
                                    </td>
                                    <td className="px-3 py-3 text-xs font-medium text-gray-900">
                                        {trade.symbol}
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold ${trade.side === 'BUY'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                            }`}>
                                            {trade.side === 'BUY' ? (
                                                <TrendingUp className="h-3 w-3" />
                                            ) : (
                                                <TrendingDown className="h-3 w-3" />
                                            )}
                                            <span>{trade.side}</span>
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-right text-xs text-gray-900 font-medium">
                                        {trade.quantity}
                                    </td>
                                    <td className="px-3 py-3 text-right text-xs text-gray-900">
                                        ₹{trade.entryPrice.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-3 text-right text-xs text-gray-900">
                                        {trade.exitPrice && trade.exitPrice > 0
                                            ? `₹${trade.exitPrice.toFixed(2)}`
                                            : '-'
                                        }
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        <span className={`text-xs font-bold ${(trade.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {(trade.pnl || 0) >= 0 ? '+' : ''}
                                            ₹{(trade.pnl || 0).toFixed(2)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-12">
                    <div className="mb-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100">
                            <TrendingUp className="h-8 w-8 text-gray-400" />
                        </div>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">No Trades Yet</h4>
                    <p className="text-xs text-gray-500 mb-4">Run a strategy to generate trades</p>
                    <button
                        onClick={() => navigate('/strategies')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                        View Strategies
                    </button>
                </div>
            )}
        </div>
    );
}
