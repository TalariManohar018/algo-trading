import { Shield, AlertTriangle } from 'lucide-react';
import { RiskGuard } from '../services/riskService';

interface RiskPanelProps {
    riskGuard: RiskGuard;
}

export default function RiskPanel({ riskGuard }: RiskPanelProps) {
    const lossPercentUsed = riskGuard.currentDayLoss < 0
        ? (Math.abs(riskGuard.currentDayLoss) / riskGuard.maxLossPerDay) * 100
        : 0;

    const tradesPercentUsed = (riskGuard.tradeCountToday / riskGuard.maxTradesPerDay) * 100;

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center space-x-2 mb-4">
                <Shield className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900">Risk Guard</h3>
            </div>

            {riskGuard.isRiskBreached && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-red-900">Risk Limit Breached</p>
                            <p className="text-xs text-red-700 mt-1">{riskGuard.breachReason}</p>
                            <p className="text-xs text-red-600 mt-2">New strategy execution is disabled</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {/* Daily Loss Limit */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Daily Loss Limit</span>
                        <div className="text-right">
                            <span className={`text-sm font-semibold ${riskGuard.currentDayLoss < 0 ? 'text-red-600' : 'text-green-600'
                                }`}>
                                {riskGuard.currentDayLoss < 0 ? '-' : '+'}
                                ₹{Math.abs(riskGuard.currentDayLoss).toLocaleString('en-IN')}
                            </span>
                            <span className="text-xs text-gray-500 ml-1">
                                / ₹{riskGuard.maxLossPerDay.toLocaleString('en-IN')}
                            </span>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all ${lossPercentUsed >= 80
                                    ? 'bg-red-600'
                                    : lossPercentUsed >= 50
                                        ? 'bg-orange-500'
                                        : 'bg-green-500'
                                }`}
                            style={{ width: `${Math.min(lossPercentUsed, 100)}%` }}
                        ></div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">
                            {lossPercentUsed.toFixed(1)}% used
                        </span>
                        <span className="text-xs font-medium text-green-600">
                            ₹{riskGuard.remainingRisk.toLocaleString('en-IN')} remaining
                        </span>
                    </div>
                </div>

                {/* Trade Count Limit */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Daily Trade Limit</span>
                        <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">
                                {riskGuard.tradeCountToday}
                            </span>
                            <span className="text-xs text-gray-500 ml-1">
                                / {riskGuard.maxTradesPerDay}
                            </span>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all ${tradesPercentUsed >= 80
                                    ? 'bg-red-600'
                                    : tradesPercentUsed >= 50
                                        ? 'bg-orange-500'
                                        : 'bg-blue-500'
                                }`}
                            style={{ width: `${Math.min(tradesPercentUsed, 100)}%` }}
                        ></div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">
                            {tradesPercentUsed.toFixed(1)}% used
                        </span>
                        <span className="text-xs font-medium text-blue-600">
                            {riskGuard.maxTradesPerDay - riskGuard.tradeCountToday} remaining
                        </span>
                    </div>
                </div>

                {/* Status Summary */}
                <div className={`p-3 rounded-lg ${riskGuard.isRiskBreached
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-green-50 border border-green-200'
                    }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">Risk Status</span>
                        <span className={`text-xs font-bold ${riskGuard.isRiskBreached ? 'text-red-600' : 'text-green-600'
                            }`}>
                            {riskGuard.isRiskBreached ? '⛔ BREACHED' : '✓ SAFE'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
