import { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useTradingContext, Order } from '../context/TradingContext';

export default function OrderBook() {
    const { orders } = useTradingContext();
    const [activeOrders, setActiveOrders] = useState<Order[]>([]);

    useEffect(() => {
        // Filter orders that are in progress (not final states)
        const inProgress = orders.filter(o =>
            o.status === 'CREATED' || o.status === 'PLACED'
        );
        setActiveOrders(inProgress);
    }, [orders]);

    const getStatusColor = (status: Order['status']) => {
        switch (status) {
            case 'CREATED':
                return 'bg-blue-100 text-blue-700';
            case 'PLACED':
                return 'bg-yellow-100 text-yellow-700';
            case 'FILLED':
                return 'bg-green-100 text-green-700';
            case 'REJECTED':
                return 'bg-red-100 text-red-700';
            case 'CLOSED':
                return 'bg-gray-100 text-gray-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusIcon = (status: Order['status']) => {
        const iconClass = "h-4 w-4";
        switch (status) {
            case 'CREATED':
            case 'PLACED':
                return <Loader className={`${iconClass} animate-spin`} />;
            case 'FILLED':
                return <CheckCircle className={iconClass} />;
            case 'REJECTED':
                return <XCircle className={iconClass} />;
            default:
                return <Clock className={iconClass} />;
        }
    };

    if (activeOrders.length === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-gray-500" />
                    <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Order Book</h3>
                    <div className="flex items-center space-x-1">
                        <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-gray-500">Processing</span>
                    </div>
                </div>
                <span className="text-sm font-medium text-gray-500">
                    {activeOrders.length} active order{activeOrders.length !== 1 ? 's' : ''}
                </span>
            </div>

            <div className="space-y-2">
                {activeOrders.map((order) => (
                    <div
                        key={order.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                        <div className="flex items-center space-x-3 flex-1">
                            <div className={`p-2 rounded-lg ${getStatusColor(order.status)}`}>
                                {getStatusIcon(order.status)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-900">{order.symbol}</span>
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${order.side === 'BUY'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                        }`}>
                                        {order.side}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {order.quantity} @ {order.orderType} • {order.strategyName}
                                </div>
                            </div>
                        </div>
                        <div className="text-right ml-4">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(order.status)}`}>
                                {order.status}
                            </span>
                            {order.placedPrice && (
                                <div className="text-xs text-gray-500 mt-1">
                                    ₹{order.placedPrice.toFixed(2)}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
