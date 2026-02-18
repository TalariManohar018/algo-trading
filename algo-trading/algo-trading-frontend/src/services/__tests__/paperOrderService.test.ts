import { paperOrderService } from '../paperOrderService';

describe('PaperOrderService', () => {
    beforeEach(() => {
        // Reset any state if needed
    });

    test('should create order with CREATED status', async () => {
        const order = await paperOrderService.createOrder({
            strategyId: 'STR-1',
            strategyName: 'Test Strategy',
            symbol: 'NIFTY50',
            side: 'BUY',
            quantity: 100,
            price: 18000,
            orderType: 'LIMIT',
        });

        expect(order.status).toBe('CREATED');
        expect(order.symbol).toBe('NIFTY50');
        expect(order.side).toBe('BUY');
        expect(order.quantity).toBe(100);
    });

    test('should place order and change status to PLACED', async () => {
        const order = await paperOrderService.createOrder({
            strategyId: 'STR-1',
            strategyName: 'Test Strategy',
            symbol: 'NIFTY50',
            side: 'BUY',
            quantity: 100,
            price: 18000,
            orderType: 'LIMIT',
        });

        const placedOrder = await paperOrderService.placeOrder(order);
        expect(placedOrder.status).toBe('PLACED');
        expect(placedOrder.placedAt).toBeDefined();
    });

    test('should fill order and change status to FILLED', async () => {
        const order = await paperOrderService.createOrder({
            strategyId: 'STR-1',
            strategyName: 'Test Strategy',
            symbol: 'NIFTY50',
            side: 'BUY',
            quantity: 100,
            price: 18000,
            orderType: 'LIMIT',
        });

        const placedOrder = await paperOrderService.placeOrder(order);
        const filledOrder = await paperOrderService.fillOrder(placedOrder, 18005);

        expect(filledOrder.status).toBe('FILLED');
        expect(filledOrder.filledPrice).toBe(18005);
        expect(filledOrder.filledAt).toBeDefined();
    });

    test('should simulate slippage on market orders', async () => {
        const order = await paperOrderService.createOrder({
            strategyId: 'STR-1',
            strategyName: 'Test Strategy',
            symbol: 'NIFTY50',
            side: 'BUY',
            quantity: 100,
            price: 18000,
            orderType: 'MARKET',
        });

        const placedOrder = await paperOrderService.placeOrder(order);
        const filledOrder = await paperOrderService.fillOrder(placedOrder, 18000);

        // Slippage should make the fill price slightly different
        expect(filledOrder.filledPrice).not.toBe(18000);
        expect(Math.abs(filledOrder.filledPrice! - 18000)).toBeLessThan(50);
    });

    test('should randomly reject 5% of orders', async (done) => {
        const orders = await Promise.all(
            Array(100).fill(0).map(() => 
                paperOrderService.createOrder({
                    strategyId: 'STR-1',
                    strategyName: 'Test Strategy',
                    symbol: 'NIFTY50',
                    side: 'BUY',
                    quantity: 100,
                    price: 18000,
                    orderType: 'LIMIT',
                })
            )
        );

        const placedOrders = await Promise.all(
            orders.map(order => paperOrderService.placeOrder(order))
        );

        const rejectedCount = placedOrders.filter(o => o.status === 'REJECTED').length;
        
        // Should reject roughly 5% (allow some variance)
        expect(rejectedCount).toBeGreaterThan(0);
        expect(rejectedCount).toBeLessThan(15);
        
        done();
    });

    test('should get order by id', async () => {
        const order = await paperOrderService.createOrder({
            strategyId: 'STR-1',
            strategyName: 'Test Strategy',
            symbol: 'NIFTY50',
            side: 'BUY',
            quantity: 100,
            price: 18000,
            orderType: 'LIMIT',
        });

        const retrieved = await paperOrderService.getOrder(order.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(order.id);
    });
});
