// ============================================================
// WEBSOCKET SERVER — Real-time updates to frontend
// ============================================================
// Broadcasts: ticks, signals, order fills, engine status
// Uses ws library (already in package.json for marketDataService)
// ============================================================

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { executionEngine } from '../engine/executionEngine';
import { marketDataService, TickData } from '../services/marketDataService';
import logger from '../utils/logger';

interface WSClient {
    ws: WebSocket;
    subscriptions: Set<string>; // e.g., 'ticks', 'signals', 'orders', 'engine'
    userId?: string;
}

export class TradingWebSocketServer {
    private wss: WebSocketServer | null = null;
    private clients = new Set<WSClient>();
    private tickThrottle = new Map<string, number>(); // symbol → last broadcast time

    /**
     * Attach WebSocket server to the HTTP server.
     */
    attach(server: HTTPServer): void {
        this.wss = new WebSocketServer({ server, path: '/ws' });

        this.wss.on('connection', (ws: WebSocket) => {
            const client: WSClient = { ws, subscriptions: new Set(['ticks', 'signals', 'orders', 'engine']) };
            this.clients.add(client);

            logger.info(`WebSocket client connected (total: ${this.clients.size})`);

            // Send initial engine status
            this.sendToClient(client, {
                type: 'engine_status',
                data: executionEngine.getStatus(),
            });

            ws.on('message', (data: Buffer) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this.handleClientMessage(client, msg);
                } catch {
                    // Ignore malformed messages
                }
            });

            ws.on('close', () => {
                this.clients.delete(client);
                logger.info(`WebSocket client disconnected (total: ${this.clients.size})`);
            });

            ws.on('error', (err) => {
                logger.error(`WebSocket client error: ${err.message}`);
                this.clients.delete(client);
            });
        });

        // Subscribe to engine events
        this.subscribeToEngineEvents();

        logger.info('WebSocket server attached on /ws');
    }

    /**
     * Handle incoming messages from clients.
     */
    private handleClientMessage(client: WSClient, msg: any) {
        switch (msg.type) {
            case 'subscribe':
                if (Array.isArray(msg.channels)) {
                    msg.channels.forEach((ch: string) => client.subscriptions.add(ch));
                }
                break;
            case 'unsubscribe':
                if (Array.isArray(msg.channels)) {
                    msg.channels.forEach((ch: string) => client.subscriptions.delete(ch));
                }
                break;
            case 'auth':
                client.userId = msg.userId;
                break;
            case 'ping':
                this.sendToClient(client, { type: 'pong', timestamp: Date.now() });
                break;
        }
    }

    /**
     * Subscribe to execution engine + market data events and broadcast.
     */
    private subscribeToEngineEvents() {
        // Tick data (throttled to every 500ms per symbol)
        marketDataService.on('tick', (tick: TickData) => {
            const now = Date.now();
            const lastBroadcast = this.tickThrottle.get(tick.symbol) || 0;
            if (now - lastBroadcast < 500) return; // throttle
            this.tickThrottle.set(tick.symbol, now);

            this.broadcast('ticks', {
                type: 'tick',
                data: {
                    symbol: tick.symbol,
                    price: tick.lastPrice,
                    volume: tick.volume,
                    timestamp: tick.timestamp,
                },
            });
        });

        // Strategy signals
        executionEngine.on('signal', (data) => {
            this.broadcast('signals', { type: 'signal', data });
        });

        // Order placed
        executionEngine.on('order_placed', (data) => {
            this.broadcast('orders', { type: 'order_placed', data });
        });

        // Order error
        executionEngine.on('order_error', (data) => {
            this.broadcast('orders', { type: 'order_error', data });
        });

        // Engine started/stopped
        executionEngine.on('engine_started', (data) => {
            this.broadcast('engine', { type: 'engine_started', data });
        });

        executionEngine.on('engine_stopped', () => {
            this.broadcast('engine', { type: 'engine_stopped', data: executionEngine.getStatus() });
        });

        executionEngine.on('emergency_stop', (data) => {
            this.broadcast('engine', { type: 'emergency_stop', data });
        });

        // Strategy added/removed
        executionEngine.on('strategy_added', (data) => {
            this.broadcast('engine', { type: 'strategy_added', data });
        });

        executionEngine.on('strategy_removed', (data) => {
            this.broadcast('engine', { type: 'strategy_removed', data });
        });

        // Strategy error
        executionEngine.on('strategy_error', (data) => {
            this.broadcast('signals', { type: 'strategy_error', data });
        });
    }

    /**
     * Broadcast a message to all connected clients subscribed to the channel.
     */
    private broadcast(channel: string, message: any) {
        const payload = JSON.stringify(message);
        for (const client of this.clients) {
            if (client.ws.readyState === WebSocket.OPEN && client.subscriptions.has(channel)) {
                client.ws.send(payload);
            }
        }
    }

    /**
     * Send a message to a specific client.
     */
    private sendToClient(client: WSClient, message: any) {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Get connection stats.
     */
    getStats() {
        return {
            totalClients: this.clients.size,
            channels: {
                ticks: [...this.clients].filter(c => c.subscriptions.has('ticks')).length,
                signals: [...this.clients].filter(c => c.subscriptions.has('signals')).length,
                orders: [...this.clients].filter(c => c.subscriptions.has('orders')).length,
                engine: [...this.clients].filter(c => c.subscriptions.has('engine')).length,
            },
        };
    }
}

export const tradingWS = new TradingWebSocketServer();
