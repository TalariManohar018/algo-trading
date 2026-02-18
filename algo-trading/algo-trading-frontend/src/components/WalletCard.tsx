import { useTradingContext } from '../context/TradingContext';

export const WalletCard = () => {
    const { wallet } = useTradingContext();

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
        }).format(value);
    };

    const totalEquity = wallet.balance + wallet.unrealizedPnl;
    const usagePercent = (wallet.usedMargin / wallet.balance) * 100;

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Wallet</h3>
            <div className="space-y-4">
                {/* Total Equity */}
                <div>
                    <div className="text-sm text-gray-500">Total Equity</div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalEquity)}</div>
                </div>

                {/* Available Balance */}
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Available</span>
                    <span className="text-lg font-semibold text-green-600">
                        {formatCurrency(wallet.availableMargin)}
                    </span>
                </div>

                {/* Used Margin */}
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Used Margin</span>
                    <span className="text-lg font-semibold text-orange-600">
                        {formatCurrency(wallet.usedMargin)}
                    </span>
                </div>

                {/* Usage Bar */}
                <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Margin Usage</span>
                        <span>{usagePercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                    </div>
                </div>

                {/* PnL */}
                <div className="pt-4 border-t border-gray-200 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Realized P&L</span>
                        <span
                            className={`font-semibold ${wallet.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                        >
                            {wallet.realizedPnl >= 0 ? '+' : ''}
                            {formatCurrency(wallet.realizedPnl)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Unrealized P&L</span>
                        <span
                            className={`font-semibold ${wallet.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                        >
                            {wallet.unrealizedPnl >= 0 ? '+' : ''}
                            {formatCurrency(wallet.unrealizedPnl)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
