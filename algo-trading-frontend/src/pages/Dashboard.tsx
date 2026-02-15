import { TrendingUp, Activity, Target, DollarSign } from 'lucide-react';
import { getTotalPnL, getActiveStrategies, getAverageWinRate, mockEquityData } from '../data/mockStrategies';
import Chart from '../components/Chart';

export default function Dashboard() {
    const totalPnL = getTotalPnL();
    const activeStrategies = getActiveStrategies();
    const avgWinRate = getAverageWinRate();

    const isProfitable = totalPnL > 0;

    const stats = [
        {
            title: 'Total PnL',
            value: `₹${Math.abs(totalPnL).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            change: isProfitable ? '+12.5%' : '-3.2%',
            icon: DollarSign,
            positive: isProfitable,
        },
        {
            title: 'Active Strategies',
            value: activeStrategies.length.toString(),
            change: '+2 this week',
            icon: Activity,
            positive: true,
        },
        {
            title: 'Average Win Rate',
            value: `${avgWinRate.toFixed(1)}%`,
            change: '+5.2% this month',
            icon: Target,
            positive: true,
        },
        {
            title: 'Total Trades',
            value: '690',
            change: '+48 today',
            icon: TrendingUp,
            positive: true,
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">Welcome back! Here's your trading overview</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.title} className="bg-white rounded-lg border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-lg ${stat.positive ? 'bg-green-100' : 'bg-red-100'
                                    }`}>
                                    <Icon className={`h-6 w-6 ${stat.positive ? 'text-green-600' : 'text-red-600'
                                        }`} />
                                </div>
                            </div>

                            <h3 className="text-sm font-medium text-gray-600 mb-1">{stat.title}</h3>
                            <div className="flex items-end justify-between">
                                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                                <span className={`text-sm font-medium ${stat.positive ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    {stat.change}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
                    <Chart
                        data={mockEquityData}
                        type="area"
                        dataKey="equity"
                        xAxisKey="date"
                        title="Equity Curve"
                        color="#10b981"
                    />
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Strategies</h3>
                    <div className="space-y-3">
                        {activeStrategies.map((strategy) => (
                            <div key={strategy.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">{strategy.name}</p>
                                    <p className="text-xs text-gray-500 mt-1">{strategy.instrument}</p>
                                </div>
                                <div className={`text-sm font-semibold ${strategy.pnl > 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    ₹{Math.abs(strategy.pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">Sharpe Ratio</span>
                            <span className="font-semibold text-gray-900">1.85</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-green-600 h-2 rounded-full" style={{ width: '85%' }}></div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">Max Drawdown</span>
                            <span className="font-semibold text-red-600">-8.5%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-red-600 h-2 rounded-full" style={{ width: '15%' }}></div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">Profit Factor</span>
                            <span className="font-semibold text-gray-900">2.34</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                    <div className="space-y-3">
                        <div className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-900">EMA Crossover Strategy closed position</p>
                                <p className="text-xs text-gray-500 mt-1">PnL: ₹6,512.50 • 5 min ago</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-900">Trend Following entered new position</p>
                                <p className="text-xs text-gray-500 mt-1">BANKNIFTY FUT • 12 min ago</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-900">Breakout Scanner closed position</p>
                                <p className="text-xs text-gray-500 mt-1">PnL: ₹10,643.75 • 25 min ago</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-900">VWAP Reversion stopped by user</p>
                                <p className="text-xs text-gray-500 mt-1">1 hour ago</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
