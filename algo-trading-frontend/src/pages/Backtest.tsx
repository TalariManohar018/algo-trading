import { useState } from 'react';
import { Play, TrendingUp, TrendingDown } from 'lucide-react';
import { mockStrategies, mockTrades } from '../data/mockStrategies';
import Chart from '../components/Chart';

export default function Backtest() {
    const [selectedStrategy, setSelectedStrategy] = useState('');
    const [startDate, setStartDate] = useState('2024-01-01');
    const [endDate, setEndDate] = useState('2024-12-31');
    const [showResults, setShowResults] = useState(false);

    const runBacktest = () => {
        setShowResults(true);
    };

    const monthlyReturns = [
        { month: 'Jan', returns: 5.2 },
        { month: 'Feb', returns: 7.8 },
        { month: 'Mar', returns: -2.5 },
        { month: 'Apr', returns: 9.3 },
        { month: 'May', returns: 6.1 },
        { month: 'Jun', returns: 4.7 },
        { month: 'Jul', returns: -1.2 },
        { month: 'Aug', returns: 8.9 },
        { month: 'Sep', returns: 5.4 },
        { month: 'Oct', returns: 7.2 },
        { month: 'Nov', returns: 6.8 },
        { month: 'Dec', returns: 10.5 },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Backtest</h1>
                <p className="text-gray-600 mt-1">Test your strategies against historical market data</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Backtest Configuration</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Strategy
                        </label>
                        <select
                            value={selectedStrategy}
                            onChange={(e) => setSelectedStrategy(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Choose a strategy...</option>
                            {mockStrategies.map((strategy) => (
                                <option key={strategy.id} value={strategy.id}>
                                    {strategy.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                <button
                    onClick={runBacktest}
                    disabled={!selectedStrategy}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                    <Play className="h-5 w-5" />
                    <span>Run Backtest</span>
                </button>
            </div>

            {showResults && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Return</h3>
                            <div className="flex items-end justify-between">
                                <p className="text-2xl font-bold text-green-600">+63.98%</p>
                                <TrendingUp className="h-5 w-5 text-green-600" />
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-sm font-medium text-gray-600 mb-2">Sharpe Ratio</h3>
                            <div className="flex items-end justify-between">
                                <p className="text-2xl font-bold text-gray-900">1.85</p>
                                <TrendingUp className="h-5 w-5 text-green-600" />
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-sm font-medium text-gray-600 mb-2">Max Drawdown</h3>
                            <div className="flex items-end justify-between">
                                <p className="text-2xl font-bold text-red-600">-8.5%</p>
                                <TrendingDown className="h-5 w-5 text-red-600" />
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-sm font-medium text-gray-600 mb-2">Win Rate</h3>
                            <div className="flex items-end justify-between">
                                <p className="text-2xl font-bold text-gray-900">68.5%</p>
                                <TrendingUp className="h-5 w-5 text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <Chart
                            data={monthlyReturns}
                            type="bar"
                            dataKey="returns"
                            xAxisKey="month"
                            title="Monthly Returns (%)"
                            color="#0ea5e9"
                        />
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Trade History</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Entry Time</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Exit Time</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Instrument</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Side</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Entry Price</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Exit Price</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Qty</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">PnL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mockTrades.map((trade) => (
                                        <tr key={trade.id} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 text-sm text-gray-900">{trade.entryTime}</td>
                                            <td className="py-3 px-4 text-sm text-gray-900">{trade.exitTime}</td>
                                            <td className="py-3 px-4 text-sm text-gray-900">{trade.instrument}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${trade.side === 'BUY'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {trade.side}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-900 text-right">
                                                {trade.entryPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-900 text-right">
                                                {trade.exitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-900 text-right">{trade.quantity}</td>
                                            <td className={`py-3 px-4 text-sm font-semibold text-right ${trade.pnl > 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                ₹{trade.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Total Trades</span>
                                    <span className="font-semibold text-gray-900">127</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Winning Trades</span>
                                    <span className="font-semibold text-green-600">87</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Losing Trades</span>
                                    <span className="font-semibold text-red-600">40</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Average Win</span>
                                    <span className="font-semibold text-green-600">₹8,234</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Average Loss</span>
                                    <span className="font-semibold text-red-600">₹3,567</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Profit Factor</span>
                                    <span className="font-semibold text-gray-900">2.31</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Metrics</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Volatility (Annual)</span>
                                    <span className="font-semibold text-gray-900">18.5%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Sortino Ratio</span>
                                    <span className="font-semibold text-gray-900">2.15</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Calmar Ratio</span>
                                    <span className="font-semibold text-gray-900">7.53</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Max Consecutive Wins</span>
                                    <span className="font-semibold text-green-600">12</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Max Consecutive Losses</span>
                                    <span className="font-semibold text-red-600">5</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Recovery Factor</span>
                                    <span className="font-semibold text-gray-900">7.52</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
