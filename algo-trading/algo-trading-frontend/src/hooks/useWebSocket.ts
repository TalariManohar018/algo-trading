import { useEffect, useState } from 'react';
import { websocketService, WebSocketEventType, WebSocketMessage } from '../services/websocketService';

export function useWebSocket(eventType: WebSocketEventType) {
    const [message, setMessage] = useState<WebSocketMessage | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        websocketService.connect();
        setIsConnected(true);

        const unsubscribe = websocketService.subscribe(eventType, (msg) => {
            setMessage(msg);
        });

        return () => {
            unsubscribe();
        };
    }, [eventType]);

    return { message, isConnected };
}

export function useMarketUpdates() {
    const { message } = useWebSocket('market_update');
    return message;
}

export function usePositionUpdates() {
    const { message } = useWebSocket('position_update');
    return message;
}

export function useStrategyStatus() {
    const { message } = useWebSocket('strategy_status');
    return message;
}

export function useTradeExecutions() {
    const { message } = useWebSocket('trade_execution');
    return message;
}
