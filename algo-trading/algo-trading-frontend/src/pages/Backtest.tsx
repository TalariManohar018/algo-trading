import { useState, useEffect } from 'react';
import { Play, TrendingUp, TrendingDown, Save, CheckCircle, BarChart3 } from 'lucide-react';
import Chart from '../components/Chart';
import { Strategy, strategyService } from '../services/strategyService';
import { BacktestResult, backtestService } from '../services/backtestService';
import { useError } from '../context/ErrorContext';
import { useLoading } from '../context/LoadingContext';

export default function Backtest() {
    const { showError } = useError();
    const { setLoading: setGlobalLoading } = useLoading();
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [selectedStrategy, setSelectedStrategy] = useState('');
    const [startDate, setStartDate] = useState('2024-01-01');
    const [endDate, setEndDate] = useState('2024-12-31');
    const [initialCapital, setInitialCapital] = useState(100000);
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<BacktestResult | null>(null);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        const fetchStrategies = async () => {
            try {
                const data = await strategyService.getAllStrategies();
                setStrategies(data);
            } catch (error) {
                showError(error instanceof Error ? error.message : 'Error fetching strategies');
            }
        };
        fetchStrategies();
    }, [showError]);

    const runBacktest = async () => {
        if (!selectedStrategy) {
            showError('Please select a strategy');
            return;
        }

        setIsRunning(true);
        setIsSaved(false);
        setGlobalLoading(true, 'Running backtest simulation...');
        try {
            const result = await backtestService.runBacktest({
                strategyId: parseInt(selectedStrategy),
                startDate,
                endDate,
                initialCapital
            });
            setResults(result);
            setGlobalLoading(false);
        } catch (error) {
            setGlobalLoading(false);
            showError(error instanceof Error ? error.message : 'Failed to run backtest');
        } finally {
            setIsRunning(false);
        }
    };

    const handleSaveStrategy = async () => {
        setGlobalLoading(true, 'Saving strategy...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
        setGlobalLoading(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    };

    const monthlyReturns = results?.trades.reduce((acc, trade) => {
        const month = new Date(trade.exitTime).toLocaleDateString('en-US', { month: 'short' });
        const existing = acc.find(item => item.month === month);
        if (existing) {
            existing.returns += trade.pnl / (trade.entryPrice * trade.quantity) * 100;
        } else {
            acc.push({ month, returns: trade.pnl / (trade.entryPrice * trade.quantity) * 100 });
        }
        return acc;
    }, [] as Array<{ month: string; returns: number }>) || [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Backtest</h1>
                <p className="text-gray-600 mt-1">Test your strategies against historical market data</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Backtest Configuration</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                            {strategies.map((strategy) => (
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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Initial Capital (₹)
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={initialCapital}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\d+$/.test(val)) {
                                    setInitialCapital(val === '' ? 100000 : parseInt(val));
                                }
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                <button
                    onClick={runBacktest}
                    disabled={!selectedStrategy || isRunning}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                    <Play className="h-5 w-5" />
                    <span>{isRunning ? 'Running Backtest...' : 'Run Backtest'}</span>
                </button>
            </div>

            {results && (
                <>
                    {/* Results Summary Card */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Backtest Results</h2>
                                <p className="text-gray-600 mt-1">Performance summary for {results.strategyName}</p>
                            </div>
                            <button
                                onClick={handleSaveStrategy}
                                disabled={isSaved}
                                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all ${isSaved
                                        ? 'bg-green-600 text-white cursor-default'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                            >
                                {isSaved ? (
                                    <>
                                        <CheckCircle className="h-5 w-5" />
                                        <span>Saved!</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-5 w-5" />
                                        <span>Save Strategy</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                                <p className="text-sm text-gray-600 mb-1">Total PnL</p>
                                <p className={`text-2xl font-bold ${results.totalReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {results.totalReturn > 0 ? '+' : ''}₹{results.totalReturn.toLocaleString('en-IN')}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {results.totalReturnPercentage > 0 ? '+' : ''}{results.totalReturnPercentage.toFixed(2)}%
                                </p>
                            </div>
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                                <p className="text-sm text-gray-600 mb-1">Win Rate</p>
                                <p className="text-2xl font-bold text-gray-900">{results.winRate.toFixed(1)}%</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {results.winningTrades} / {results.totalTrades} wins
                                </p>
                            </div>
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                                <p className="text-sm text-gray-600 mb-1">Max Drawdown</p>
                                <p className="text-2xl font-bold text-red-600">{results.maxDrawdown.toFixed(2)}%</p>
                                <p className="text-xs text-gray-500 mt-1">Risk metric</p>
                            </div>
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                                {/* Equity Curve Placeholder */}
                                <div className="bg-white rounded-lg border border-gray-200 p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Equity Curve</h3>
                                    <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg">
                                        <BarChart3 className="h-16 w-16 text-gray-300 mb-4" />
                                        <p className="text-gray-500 text-sm">
                                            Equity curve visualization will be displayed here
                                        </p>
                                    </div>
                                </div>

                                <p className="text-sm text-gray-600 mb-1">Total Trades</p>
                                <p className="text-2xl font-bold text-gray-900">{results.totalTrades}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Profit Factor: {results.profitFactor.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Return</h3>
                            <div className="flex items-end justify-between">
                                <p className={`text-2xl font-bold ${results.totalReturnPercentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {results.totalReturnPercentage > 0 ? '+' : ''}{results.totalReturnPercentage.toFixed(2)}%
                                </p>
                                {results.totalReturnPercentage > 0 ? (
                                    <TrendingUp className="h-5 w-5 text-green-600" />
                                ) : (
                                    <TrendingDown className="h-5 w-5 text-red-600" />
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-sm font-medium text-gray-600 mb-2">Sharpe Ratio</h3>
                            <div className="flex items-end justify-between">
                                <p className="text-2xl font-bold text-gray-900">{results.sharpeRatio.toFixed(2)}</p>
                                <TrendingUp className="h-5 w-5 text-green-600" />
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-sm font-medium text-gray-600 mb-2">Max Drawdown</h3>
                            <div className="flex items-end justify-between">
                                <p className="text-2xl font-bold text-red-600">{results.maxDrawdown.toFixed(2)}%</p>
                                <TrendingDown className="h-5 w-5 text-red-600" />
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-sm font-medium text-gray-600 mb-2">Win Rate</h3>
                            <div className="flex items-end justify-between">
                                <p className="text-2xl font-bold text-gray-900">{results.winRate.toFixed(1)}%</p>
                                <TrendingUp className="h-5 w-5 text-green-600" />
                            </div>
                        </div>
                    </div>

                    {monthlyReturns.length > 0 && (
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
                    )}

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Trade History</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Entry Time</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Exit Time</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Side</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Entry Price</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Exit Price</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Qty</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">PnL</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">PnL %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.trades.map((trade, index) => (
                                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 text-sm text-gray-900">
                                                {new Date(trade.entryTime).toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-900">
                                                {new Date(trade.exitTime).toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${trade.orderSide === 'BUY'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {trade.orderSide}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-900 text-right">
                                                ₹{trade.entryPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-900 text-right">
                                                ₹{trade.exitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-900 text-right">{trade.quantity}</td>
                                            <td className={`py-3 px-4 text-sm font-semibold text-right ${trade.pnl > 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                ₹{trade.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className={`py-3 px-4 text-sm font-semibold text-right ${trade.pnlPercentage > 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                {trade.pnlPercentage > 0 ? '+' : ''}{trade.pnlPercentage.toFixed(2)}%
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
                                    <span className="font-semibold text-gray-900">{results.totalTrades}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Winning Trades</span>
                                    <span className="font-semibold text-green-600">{results.winningTrades}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Losing Trades</span>
                                    <span className="font-semibold text-red-600">{results.losingTrades}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Average Win</span>
                                    <span className="font-semibold text-green-600">
                                        ₹{results.averageWin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Average Loss</span>
                                    <span className="font-semibold text-red-600">
                                        ₹{Math.abs(results.averageLoss).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Initial Capital</span>
                                    <span className="font-semibold text-gray-900">
                                        ₹{results.initialCapital.toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Final Capital</span>
                                    <span className="font-semibold text-gray-900">
                                        ₹{results.finalCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Total Return</span>
                                    <span className={`font-semibold ${results.totalReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        ₹{results.totalReturn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Profit Factor</span>
                                    <span className="font-semibold text-gray-900">{results.profitFactor.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
