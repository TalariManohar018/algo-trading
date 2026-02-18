import { Position, Order } from '../context/TradingContext';

interface CreatePositionParams {
    order: Order;
    currentPrice: number;
}

class PositionServiceClass {
    /**
     * Create position from filled order
     */
    async createPosition(params: CreatePositionParams): Promise<Position> {
        const { order, currentPrice } = params;

        if (order.status !== 'FILLED') {
            throw new Error('Can only create position from FILLED order');
        }

        const position: Position = {
            id: `POS${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            strategyId: order.strategyId,
            strategyName: order.strategyName,
            symbol: order.symbol,
            side: order.side === 'BUY' ? 'LONG' : 'SHORT',
            quantity: order.quantity,
            entryPrice: order.filledPrice || currentPrice,
            currentPrice: currentPrice,
            unrealizedPnl: 0,
            realizedPnl: 0,
            status: 'OPEN',
            openedAt: new Date(),
        };

        return position;
    }

    /**
     * Update position with current market price
     */
    updatePositionPrice(position: Position, currentPrice: number): Position {
        const unrealizedPnl = this.calculateUnrealizedPnl(
            position.entryPrice,
            currentPrice,
            position.quantity,
            position.side
        );

        return {
            ...position,
            currentPrice,
            unrealizedPnl,
        };
    }

    /**
     * Calculate unrealized PnL for a position
     */
    calculateUnrealizedPnl(
        entryPrice: number,
        currentPrice: number,
        quantity: number,
        side: 'LONG' | 'SHORT'
    ): number {
        if (side === 'LONG') {
            return (currentPrice - entryPrice) * quantity;
        } else {
            return (entryPrice - currentPrice) * quantity;
        }
    }

    /**
     * Calculate total PnL for closed position
     */
    calculateRealizedPnl(
        entryPrice: number,
        exitPrice: number,
        quantity: number,
        side: 'LONG' | 'SHORT'
    ): number {
        if (side === 'LONG') {
            return (exitPrice - entryPrice) * quantity;
        } else {
            return (entryPrice - exitPrice) * quantity;
        }
    }

    /**
     * Check if position should be closed based on strategy conditions
     */
    shouldClosePosition(
        position: Position,
        stopLoss?: number,
        takeProfit?: number
    ): { shouldClose: boolean; reason?: string } {
        if (position.status !== 'OPEN') {
            return { shouldClose: false };
        }

        // Check stop loss
        if (stopLoss && position.unrealizedPnl <= -stopLoss) {
            return {
                shouldClose: true,
                reason: 'Stop loss triggered',
            };
        }

        // Check take profit
        if (takeProfit && position.unrealizedPnl >= takeProfit) {
            return {
                shouldClose: true,
                reason: 'Take profit triggered',
            };
        }

        return { shouldClose: false };
    }

    /**
     * Get all open positions for a strategy
     */
    getOpenPositionsByStrategy(positions: Position[], strategyId: string): Position[] {
        return positions.filter(
            p => p.strategyId === strategyId && p.status === 'OPEN'
        );
    }

    /**
     * Get total unrealized PnL across all open positions
     */
    getTotalUnrealizedPnl(positions: Position[]): number {
        return positions
            .filter(p => p.status === 'OPEN')
            .reduce((total, position) => total + position.unrealizedPnl, 0);
    }

    /**
     * Get total used margin across all open positions
     */
    getTotalUsedMargin(positions: Position[]): number {
        return positions
            .filter(p => p.status === 'OPEN')
            .reduce((total, position) => {
                return total + (position.entryPrice * position.quantity * 0.2);
            }, 0);
    }

    /**
     * Update all open positions with latest market prices
     */
    async updateAllPositions(
        positions: Position[],
        marketPrices: Record<string, number>
    ): Promise<Position[]> {
        return positions.map(position => {
            if (position.status === 'OPEN' && marketPrices[position.symbol]) {
                return this.updatePositionPrice(position, marketPrices[position.symbol]);
            }
            return position;
        });
    }

    /**
     * Simulate position closing
     */
    async closePosition(
        position: Position,
        exitPrice: number
    ): Promise<{ position: Position; pnl: number }> {
        if (position.status !== 'OPEN') {
            throw new Error('Can only close OPEN positions');
        }

        const pnl = this.calculateRealizedPnl(
            position.entryPrice,
            exitPrice,
            position.quantity,
            position.side
        );

        const closedPosition: Position = {
            ...position,
            status: 'CLOSED',
            currentPrice: exitPrice,
            realizedPnl: pnl,
            closedAt: new Date(),
        };

        return {
            position: closedPosition,
            pnl,
        };
    }
}

export const positionService = new PositionServiceClass();
