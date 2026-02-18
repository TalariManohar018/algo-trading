// ============================================================
// BROKER SERVICE — Abstract interface + Paper/Live impls
// ============================================================

export interface BrokerOrder {
    symbol: string;
    exchange: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
    product: 'MIS' | 'NRML' | 'CNC';
    limitPrice?: number;
    triggerPrice?: number;
}

export interface BrokerOrderResponse {
    orderId: string;
    status: 'PLACED' | 'REJECTED';
    message?: string;
}

export interface BrokerOrderStatus {
    orderId: string;
    status: 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED';
    filledQuantity: number;
    averagePrice: number;
    message?: string;
}

export interface BrokerPosition {
    symbol: string;
    quantity: number;
    averagePrice: number;
    lastPrice: number;
    pnl: number;
    product: string;
}

export interface IBrokerService {
    readonly mode: 'paper' | 'live';
    placeOrder(order: BrokerOrder): Promise<BrokerOrderResponse>;
    cancelOrder(orderId: string): Promise<{ success: boolean; message?: string }>;
    getOrderStatus(orderId: string): Promise<BrokerOrderStatus>;
    getCurrentPrice(symbol: string, exchange?: string): Promise<number>;
    getPositions(): Promise<BrokerPosition[]>;
    squareOffAll(): Promise<{ success: boolean; closedCount: number }>;
    isConnected(): boolean;
}
