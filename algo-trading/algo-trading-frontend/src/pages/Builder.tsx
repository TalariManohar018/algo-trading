import StrategyBuilder from '../components/StrategyBuilder';
import { Lightbulb } from 'lucide-react';

export default function Builder() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Strategy Builder</h1>
                <p className="text-gray-600 mt-1">Create your custom trading strategy with visual rule builder</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
                <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                    <h3 className="font-semibold text-blue-900">Pro Tip</h3>
                    <p className="text-sm text-blue-700 mt-1">
                        Combine multiple indicators for better accuracy. Use AND logic for stricter entries and OR logic for more opportunities.
                    </p>
                </div>
            </div>

            <StrategyBuilder />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Popular Indicators</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">EMA (Exponential Moving Average)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">RSI (Relative Strength Index)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">VWAP (Volume Weighted Avg Price)</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">ADX (Average Directional Index)</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Strategy Templates</h3>
                    <div className="space-y-2">
                        <button className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors">
                            Trend Following
                        </button>
                        <button className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors">
                            Mean Reversion
                        </button>
                        <button className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors">
                            Breakout Trading
                        </button>
                        <button className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors">
                            Momentum Strategy
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Risk Management</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm text-gray-600">Stop Loss (%)</label>
                            <input
                                type="number"
                                placeholder="2.0"
                                step="any"
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">Take Profit (%)</label>
                            <input
                                type="number"
                                placeholder="5.0"
                                step="any"
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-600">Max Position Size</label>
                            <input
                                type="number"
                                placeholder="100"
                                min="1"
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
