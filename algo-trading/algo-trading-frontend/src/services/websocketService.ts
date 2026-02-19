// ============================================================
// REAL WEBSOCKET SERVICE — Connects to Node.js backend WS
// ============================================================
// Connects to ws://localhost:3001/ws with reconnection and
// fallback to simulated data when backend is unreachable.
// ============================================================

export type WebSocketEventType =
    | 'market_update'
    | 'position_update'
    | 'strategy_status'
    | 'trade_execution'
    | 'tick'
    | 'signal'
    | 'order_placed'
    | 'order_error'
    | 'engine_started'
    | 'engine_stopped'
    | 'emergency_stop'
    | 'engine_status';

export interface WebSocketMessage {
    type: string;
    data: any;
    timestamp: string;
}

type MessageCallback = (message: WebSocketMessage) => void;

const WS_URL = 'ws://localhost:3001/ws';

class WebSocketService {
    private ws: WebSocket | null = null;
    private subscribers: Map<string, Set<MessageCallback>> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 20;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private simulationIntervals: ReturnType<typeof setInterval>[] = [];
    private isConnectedFlag = false;
    private useSimulation = false;

    connect(): void {
        if (this.isConnectedFlag || this.ws) return;

        try {
            this.ws = new WebSocket(WS_URL);

            this.ws.onopen = () => {
                console.log('WebSocket: Connected to backend');
                this.isConnectedFlag = true;
                this.reconnectAttempts = 0;
                this.useSimulation = false;
                this.stopSimulation();

                this.ws?.send(JSON.stringify({
                    type: 'subscribe',
                    channels: ['ticks', 'signals', 'orders', 'engine'],
                }));
            };

            this.ws.onmessage = (event: MessageEvent) => {
                try {
                    const msg = JSON.parse(event.data);
                    this.handleBackendMessage(msg);
                } catch { /* ignore */ }
            };

            this.ws.onclose = () => {
                console.log('WebSocket: Disconnected');
                this.isConnectedFlag = false;
                this.ws = null;
                this.scheduleReconnect();
            };

            this.ws.onerror = () => {
                this.isConnectedFlag = false;
            };
        } catch {
            console.log('WebSocket: Connection failed, starting simulation');
            this.startSimulation();
        }
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnectedFlag = false;
        this.stopSimulation();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    subscribe(eventType: string, callback: MessageCallback): () => void {
        if (!this.subscribers.has(eventType)) {
            this.subscribers.set(eventType, new Set());
        }
        this.subscribers.get(eventType)!.add(callback);

        return () => {
            const callbacks = this.subscribers.get(eventType);
            if (callbacks) callbacks.delete(callback);
        };
    }

    get connected(): boolean {
        return this.isConnectedFlag;
    }

    private handleBackendMessage(msg: any) {
        const timestamp = new Date().toISOString();

        switch (msg.type) {
            case 'tick':
                this.emit('tick', { ...msg, timestamp });
                this.emit('market_update', { type: 'market_update', data: msg.data, timestamp });
                break;
            case 'signal':
                this.emit('signal', { ...msg, timestamp });
                this.emit('strategy_status', { type: 'strategy_status', data: msg.data, timestamp });
                break;
            case 'order_placed':
            case 'order_error':
                this.emit(msg.type, { ...msg, timestamp });
                this.emit('trade_execution', { type: 'trade_execution', data: msg.data, timestamp });
                break;
            case 'engine_status':
            case 'engine_started':
            case 'engine_stopped':
            case 'emergency_stop':
                this.emit(msg.type, { ...msg, timestamp });
                break;
            case 'pong':
                break;
            default:
                this.emit(msg.type, { ...msg, timestamp });
        }
    }

    private emit(eventType: string, message: any) {
        const callbacks = this.subscribers.get(eventType);
        if (callbacks) callbacks.forEach((cb) => cb(message));
    }

    private scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('WebSocket: Max reconnect attempts, using simulation');
            this.startSimulation();
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }

    private startSimulation() {
        if (this.useSimulation) return;
        this.useSimulation = true;

        const marketInterval = setInterval(() => {
            const symbols = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK'];
            const symbol = symbols[Math.floor(Math.random() * symbols.length)];
            const priceChange = (Math.random() - 0.5) * 50;

            this.emit('market_update', {
                type: 'market_update',
                data: { symbol, priceChange, timestamp: new Date().toISOString() },
                timestamp: new Date().toISOString(),
            });
        }, 3000);

        this.simulationIntervals.push(marketInterval);
    }

    private stopSimulation() {
        this.simulationIntervals.forEach((i) => clearInterval(i));
        this.simulationIntervals = [];
        this.useSimulation = false;
    }

    simulateStrategyStatusChange(strategyId: number, status: string): void {
        this.emit('strategy_status', {
            type: 'strategy_status',
            data: { strategyId, status },
            timestamp: new Date().toISOString(),
        });
    }

    simulateTradeExecution(tradeData: any): void {
        this.emit('trade_execution', {
            type: 'trade_execution',
            data: tradeData,
            timestamp: new Date().toISOString(),
        });
    }
}

export const websocketService = new WebSocketService();
