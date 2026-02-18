import type { Position, Order, Trade } from '../types/trading';

export interface PositionConfig {
    defaultMarginPercent: number;
}

class PaperPositionService {
    private config: PositionConfig = { defaultMarginPercent: 0.2 };

    configure(config: Partial<PositionConfig>): void {
        this.config = { ...this.config, ...config };
    }

    openPosition(order: Order, fillPrice: number): Position {
        const marginUsed = this.calculateRequiredCapital(order, fillPrice);
        return {
            id: `POS-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            strategyId: order.strategyId,
            strategyName: order.strategyName,
            symbol: order.symbol,
            side: order.side === 'BUY' ? 'LONG' : 'SHORT',
            quantity: order.filledQuantity || order.quantity,
            entryPrice: fillPrice,
            currentPrice: fillPrice,
            unrealizedPnl: 0,
            realizedPnl: 0,
            marginUsed,
            status: 'OPEN',
            openedAt: new Date(),
        };
    }

    addToPosition(position: Position, fillPrice: number, addQty: number): Position {
        const totalQty = position.quantity + addQty;
        const avgPrice = ((position.entryPrice * position.quantity) + (fillPrice * addQty)) / totalQty;
        const marginUsed = totalQty * avgPrice * this.config.defaultMarginPercent;
        return {
            ...position,
            quantity: totalQty,
            entryPrice: Math.round(avgPrice * 100) / 100,
            marginUsed,
        };
    }

    updateUnrealizedPnl(position: Position, currentPrice: number): Position {
        const diff = position.side === 'LONG'
            ? currentPrice - position.entryPrice
            : position.entryPrice - currentPrice;
        return {
            ...position,
            currentPrice,
            unrealizedPnl: Math.round(diff * position.quantity * 100) / 100,
        };
    }

    closePosition(position: Position, exitPrice: number): { position: Position; trade: Trade } {
        const diff = position.side === 'LONG'
            ? exitPrice - position.entryPrice
            : position.entryPrice - exitPrice;
        const pnl = Math.round(diff * position.quantity * 100) / 100;

        const closed: Position = {
            ...position,
            currentPrice: exitPrice,
            realizedPnl: pnl,
            unrealizedPnl: 0,
            status: 'CLOSED',
            closedAt: new Date(),
        };

        const trade: Trade = {
            id: `TRD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            strategyId: position.strategyId,
            strategyName: position.strategyName,
            symbol: position.symbol,
            side: position.side === 'LONG' ? 'SELL' : 'BUY',
            quantity: position.quantity,
            entryPrice: position.entryPrice,
            exitPrice,
            pnl,
            executedAt: new Date(),
        };

        return { position: closed, trade };
    }

    partialClose(position: Position, exitPrice: number, closeQty: number): { position: Position; trade: Trade } {
        if (closeQty >= position.quantity) {
            return this.closePosition(position, exitPrice);
        }

        const diff = position.side === 'LONG'
            ? exitPrice - position.entryPrice
            : position.entryPrice - exitPrice;
        const pnl = Math.round(diff * closeQty * 100) / 100;
        const remainingQty = position.quantity - closeQty;
        const remainingMargin = remainingQty * position.entryPrice * this.config.defaultMarginPercent;

        const updated: Position = {
            ...position,
            quantity: remainingQty,
            realizedPnl: position.realizedPnl + pnl,
            marginUsed: remainingMargin,
        };

        const trade: Trade = {
            id: `TRD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            strategyId: position.strategyId,
            strategyName: position.strategyName,
            symbol: position.symbol,
            side: position.side === 'LONG' ? 'SELL' : 'BUY',
            quantity: closeQty,
            entryPrice: position.entryPrice,
            exitPrice,
            pnl,
            executedAt: new Date(),
        };

        return { position: updated, trade };
    }

    calculateRequiredCapital(order: Order, price: number): number {
        const qty = order.filledQuantity || order.quantity;
        return Math.round(qty * price * this.config.defaultMarginPercent * 100) / 100;
    }

    shouldAutoExit(position: Position, riskConfig?: { stopLossPercent: number; takeProfitPercent: number }): { shouldClose: boolean; reason?: string } {
        if (!riskConfig) return { shouldClose: false };
        const pnlPercent = (position.unrealizedPnl / (position.entryPrice * position.quantity)) * 100;
        if (pnlPercent <= -riskConfig.stopLossPercent) {
            return { shouldClose: true, reason: `Stop loss hit: ${pnlPercent.toFixed(2)}%` };
        }
        if (pnlPercent >= riskConfig.takeProfitPercent) {
            return { shouldClose: true, reason: `Take profit hit: ${pnlPercent.toFixed(2)}%` };
        }
        return { shouldClose: false };
    }
}

export const paperPositionService = new PaperPositionService();
