import { useTradingContext } from '../context/TradingContext';

export const OrdersBadge = () => {
    const { orders } = useTradingContext();

    const inProgressOrders = orders.filter(
        order => order.status === 'CREATED' || order.status === 'PLACED'
    );

    if (inProgressOrders.length === 0) {
        return null;
    }

    return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full">
            <div className="relative">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-2 h-2 bg-blue-600 rounded-full animate-ping" />
            </div>
            <span className="text-sm font-medium">
                {inProgressOrders.length} {inProgressOrders.length === 1 ? 'order' : 'orders'} in progress
            </span>
        </div>
    );
};
