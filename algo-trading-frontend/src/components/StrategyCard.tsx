import { useState } from 'react';
import { Strategy } from '../data/mockStrategies';
import { TrendingUp, TrendingDown, Play, Square } from 'lucide-react';

interface StrategyCardProps {
    strategy: Strategy;
}

export default function StrategyCard({ strategy }: StrategyCardProps) {
    const [isRunning, setIsRunning] = useState(strategy.status === 'Running');

    const isProfitable = strategy.pnl > 0;

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">{strategy.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{strategy.instrument}</p>
                </div>

                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${isRunning
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                    {isRunning ? 'Running' : 'Stopped'}
                </div>
            </div>

            <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">PnL</span>
                    <div className="flex items-center space-x-1">
                        {isProfitable ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`font-semibold ${isProfitable ? 'text-green-600' : 'text-red-600'
                            }`}>
                            ₹{Math.abs(strategy.pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Win Rate</span>
                    <span className="font-semibold text-gray-900">{strategy.winRate}%</span>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Trades</span>
                    <span className="font-semibold text-gray-900">{strategy.totalTrades}</span>
                </div>
            </div>

            <button
                onClick={() => setIsRunning(!isRunning)}
                className={`w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${isRunning
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
            >
                {isRunning ? (
                    <>
                        <Square className="h-4 w-4" />
                        <span>Stop Strategy</span>
                    </>
                ) : (
                    <>
                        <Play className="h-4 w-4" />
                        <span>Start Strategy</span>
                    </>
                )}
            </button>
        </div>
    );
}
