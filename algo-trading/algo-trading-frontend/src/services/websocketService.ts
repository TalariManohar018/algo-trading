// Mock WebSocket Service
// This simulates real-time data updates that would come from a WebSocket connection

import { marketService } from './marketService';
import { tradeService } from './tradeService';

export type WebSocketEventType =
    | 'market_update'
    | 'position_update'
    | 'strategy_status'
    | 'trade_execution';

export interface WebSocketMessage {
    type: WebSocketEventType;
    data: any;
    timestamp: string;
}

type MessageCallback = (message: WebSocketMessage) => void;

class WebSocketMockService {
    private subscribers: Map<WebSocketEventType, Set<MessageCallback>> = new Map();
    private intervals: NodeJS.Timeout[] = [];
    private isConnected = false;

    connect(): void {
        if (this.isConnected) return;

        this.isConnected = true;
        console.log('WebSocket Mock: Connected');

        // Start simulating real-time updates
        this.startMarketUpdates();
        this.startPositionUpdates();
    }

    disconnect(): void {
        if (!this.isConnected) return;

        this.isConnected = false;
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
        console.log('WebSocket Mock: Disconnected');
    }

    subscribe(eventType: WebSocketEventType, callback: MessageCallback): () => void {
        if (!this.subscribers.has(eventType)) {
            this.subscribers.set(eventType, new Set());
        }

        this.subscribers.get(eventType)!.add(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(eventType);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }

    private emit(eventType: WebSocketEventType, data: any): void {
        const message: WebSocketMessage = {
            type: eventType,
            data,
            timestamp: new Date().toISOString()
        };

        const callbacks = this.subscribers.get(eventType);
        if (callbacks) {
            callbacks.forEach(callback => callback(message));
        }
    }

    private startMarketUpdates(): void {
        // Update market indices every 3 seconds
        const marketInterval = setInterval(() => {
            const indices = ['NIFTY', 'BANKNIFTY', 'SENSEX'];
            const randomIndex = indices[Math.floor(Math.random() * indices.length)];

            // Simulate small price changes
            const priceChange = (Math.random() - 0.5) * 50;

            this.emit('market_update', {
                symbol: randomIndex,
                priceChange,
                timestamp: new Date().toISOString()
            });
        }, 3000);

        this.intervals.push(marketInterval);
    }

    private startPositionUpdates(): void {
        // Update positions every 5 seconds
        const positionInterval = setInterval(() => {
            // Simulate position price updates
            const positions = [1, 2]; // Mock position IDs
            const randomPositionId = positions[Math.floor(Math.random() * positions.length)];

            // Simulate price movement
            const basePrices: Record<number, number> = {
                1: 165.25,
                2: 215.00
            };

            const basePrice = basePrices[randomPositionId] || 150;
            const priceChange = (Math.random() - 0.5) * 0.03; // ±3%
            const newPrice = basePrice * (1 + priceChange);

            // Update the position in trade service
            tradeService.updatePositionPrice(randomPositionId, newPrice);

            this.emit('position_update', {
                positionId: randomPositionId,
                newPrice,
                timestamp: new Date().toISOString()
            });
        }, 5000);

        this.intervals.push(positionInterval);
    }

    // Simulate strategy status changes
    simulateStrategyStatusChange(strategyId: number, status: string): void {
        this.emit('strategy_status', {
            strategyId,
            status,
            timestamp: new Date().toISOString()
        });
    }

    // Simulate trade execution
    simulateTradeExecution(tradeData: any): void {
        this.emit('trade_execution', {
            ...tradeData,
            timestamp: new Date().toISOString()
        });
    }
}

export const websocketService = new WebSocketMockService();
