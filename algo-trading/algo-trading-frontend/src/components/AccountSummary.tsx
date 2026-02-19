import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { AccountData } from '../services/accountService';

interface AccountSummaryProps {
    accountData: AccountData;
}

export default function AccountSummary({ accountData }: AccountSummaryProps) {
    const metrics = [
        {
            label: 'Wallet Balance',
            value: accountData.walletBalance,
            icon: Wallet,
            color: 'blue',
        },
        {
            label: 'Available Margin',
            value: accountData.availableMargin,
            icon: DollarSign,
            color: 'green',
        },
        {
            label: 'Used Margin',
            value: accountData.usedMargin,
            icon: DollarSign,
            color: 'orange',
        },
        {
            label: 'Realized PnL',
            value: accountData.realizedPnl,
            icon: accountData.realizedPnl >= 0 ? TrendingUp : TrendingDown,
            color: accountData.realizedPnl >= 0 ? 'green' : 'red',
            isChange: true,
        },
        {
            label: 'Unrealized PnL',
            value: accountData.unrealizedPnl,
            icon: accountData.unrealizedPnl >= 0 ? TrendingUp : TrendingDown,
            color: accountData.unrealizedPnl >= 0 ? 'green' : 'red',
            isChange: true,
        },
    ];

    const getColorClass = (color: string) => {
        switch (color) {
            case 'blue': return 'bg-blue-100 text-blue-600';
            case 'green': return 'bg-green-100 text-green-600';
            case 'red': return 'bg-red-100 text-red-600';
            case 'orange': return 'bg-orange-100 text-orange-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-5 tracking-tight">Account Overview</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {metrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                        <div key={metric.label} className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-2 mb-2">
                                <div className={`p-2 rounded-lg ${getColorClass(metric.color)}`}>
                                    <Icon className="h-4 w-4" />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mb-1">{metric.label}</p>
                            <p className={`text-lg font-bold ${metric.isChange
                                ? metric.value >= 0 ? 'text-green-600' : 'text-red-600'
                                : 'text-gray-900'
                                }`}>
                                {metric.isChange && metric.value >= 0 ? '+' : ''}
                                ₹{Math.abs(metric.value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Total PnL Summary */}
            <div className={`mt-5 p-4 rounded-xl border-2 ${accountData.totalPnl >= 0
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
                }`}>
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Total PnL (Realized + Unrealized)</span>
                    <span className={`text-xl font-bold ${accountData.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {accountData.totalPnl >= 0 ? '+' : ''}
                        ₹{Math.abs(accountData.totalPnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">Return on Capital</span>
                    <span className={`text-sm font-semibold ${accountData.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {((accountData.totalPnl / accountData.startingCapital) * 100).toFixed(2)}%
                    </span>
                </div>
            </div>
        </div>
    );
}
