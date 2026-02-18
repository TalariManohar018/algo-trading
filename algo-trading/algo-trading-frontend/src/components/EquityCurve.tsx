import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import Chart from './Chart';

interface EquityCurveProps {
    equityData: Array<{ date: string; equity: number }>;
    startingCapital: number;
}

export default function EquityCurve({ equityData, startingCapital }: EquityCurveProps) {
    const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days'>('7days');

    const filterDataByTimeRange = () => {
        if (equityData.length === 0) return [];

        const now = new Date();
        let daysBack = 7;

        switch (timeRange) {
            case 'today':
                daysBack = 1;
                break;
            case '7days':
                daysBack = 7;
                break;
            case '30days':
                daysBack = 30;
                break;
        }

        const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

        return equityData.filter(d => {
            const dataDate = new Date(d.date);
            return dataDate >= cutoffDate;
        });
    };

    const filteredData = filterDataByTimeRange();

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Equity Curve</h3>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setTimeRange('today')}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${timeRange === 'today'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setTimeRange('7days')}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${timeRange === '7days'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        7 Days
                    </button>
                    <button
                        onClick={() => setTimeRange('30days')}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${timeRange === '30days'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        30 Days
                    </button>
                </div>
            </div>

            {filteredData.length > 0 ? (
                <Chart
                    data={filteredData}
                    type="area"
                    dataKey="equity"
                    xAxisKey="date"
                    title={`Equity (${timeRange === 'today' ? 'Today' : timeRange === '7days' ? 'Last 7 Days' : 'Last 30 Days'})`}
                    color="#10b981"
                />
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <BarChart3 className="h-16 w-16 text-gray-300 mb-4" />
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">No Equity Data Available</h4>
                    <p className="text-xs text-gray-500 max-w-md mb-2">
                        Data will reflect live or paper trades when trading is active.
                    </p>
                    <p className="text-xs text-gray-400">
                        Starting Capital: ₹{startingCapital.toLocaleString('en-IN')}
                    </p>
                </div>
            )}
        </div>
    );
}
