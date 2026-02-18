import { Order } from '../context/TradingContext';

interface CreateOrderParams {
    strategyId: string;
    strategyName: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT';
    limitPrice?: number;
}

interface OrderExecutionResult {
    success: boolean;
    order?: Order;
    error?: string;
}

const ORDER_PLACEMENT_DELAY = 500; // 500ms to simulate network delay
const ORDER_FILL_DELAY = 1000; // 1s to simulate exchange processing
const SLIPPAGE_PERCENT = 0.001; // 0.1% slippage

class OrderServiceClass {
    /**
     * Create a new order
     */
    async createOrder(params: CreateOrderParams): Promise<OrderExecutionResult> {
        try {
            const order: Order = {
                id: `ORD${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                strategyId: params.strategyId,
                strategyName: params.strategyName,
                symbol: params.symbol,
                side: params.side,
                quantity: params.quantity,
                orderType: params.orderType,
                limitPrice: params.limitPrice,
                status: 'CREATED',
                createdAt: new Date(),
            };

            return {
                success: true,
                order,
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to create order',
            };
        }
    }

    /**
     * Place order on exchange (simulate)
     */
    async placeOrder(order: Order, currentPrice: number): Promise<OrderExecutionResult> {
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simulate random rejection (5% chance)
                if (Math.random() < 0.05) {
                    resolve({
                        success: false,
                        order: {
                            ...order,
                            status: 'REJECTED',
                            rejectedReason: 'Insufficient margin or invalid price',
                        },
                        error: 'Order rejected by exchange',
                    });
                    return;
                }

                resolve({
                    success: true,
                    order: {
                        ...order,
                        status: 'PLACED',
                        placedPrice: currentPrice,
                        placedAt: new Date(),
                    },
                });
            }, ORDER_PLACEMENT_DELAY);
        });
    }

    /**
     * Fill order (simulate)
     */
    async fillOrder(order: Order): Promise<OrderExecutionResult> {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (order.status !== 'PLACED') {
                    resolve({
                        success: false,
                        error: 'Order must be PLACED before filling',
                    });
                    return;
                }

                // Calculate filled price with slippage
                const basePrice = order.placedPrice || 0;
                const slippage = basePrice * SLIPPAGE_PERCENT;
                const filledPrice = order.side === 'BUY'
                    ? basePrice + slippage
                    : basePrice - slippage;

                resolve({
                    success: true,
                    order: {
                        ...order,
                        status: 'FILLED',
                        filledPrice: filledPrice,
                        filledAt: new Date(),
                    },
                });
            }, ORDER_FILL_DELAY);
        });
    }

    /**
     * Execute complete order lifecycle (CREATE → PLACE → FILL)
     */
    async executeOrder(
        params: CreateOrderParams,
        currentPrice: number,
        onStatusChange?: (order: Order) => void
    ): Promise<OrderExecutionResult> {
        // Step 1: Create
        const createResult = await this.createOrder(params);
        if (!createResult.success || !createResult.order) {
            return createResult;
        }

        let order = createResult.order;
        onStatusChange?.(order);

        // Step 2: Place
        const placeResult = await this.placeOrder(order, currentPrice);
        if (!placeResult.success || !placeResult.order) {
            onStatusChange?.(placeResult.order!);
            return placeResult;
        }

        order = placeResult.order;
        onStatusChange?.(order);

        // Step 3: Fill
        const fillResult = await this.fillOrder(order);
        if (!fillResult.success || !fillResult.order) {
            return fillResult;
        }

        order = fillResult.order;
        onStatusChange?.(order);

        return {
            success: true,
            order,
        };
    }

    /**
     * Calculate required margin for order
     */
    calculateRequiredMargin(price: number, quantity: number): number {
        return price * quantity * 0.2; // 20% margin requirement
    }

    /**
     * Validate order against wallet and risk limits
     */
    validateOrder(
        price: number,
        quantity: number,
        availableMargin: number,
        maxCapitalPerTrade: number,
        walletBalance: number
    ): { valid: boolean; reason?: string } {
        const requiredMargin = this.calculateRequiredMargin(price, quantity);
        const orderValue = price * quantity;

        if (requiredMargin > availableMargin) {
            return {
                valid: false,
                reason: `Insufficient margin. Required: ₹${requiredMargin.toFixed(2)}, Available: ₹${availableMargin.toFixed(2)}`,
            };
        }

        const maxAllowedValue = walletBalance * (maxCapitalPerTrade / 100);
        if (orderValue > maxAllowedValue) {
            return {
                valid: false,
                reason: `Order value exceeds max capital per trade (${maxCapitalPerTrade}%)`,
            };
        }

        return { valid: true };
    }
}

export const orderService = new OrderServiceClass();
