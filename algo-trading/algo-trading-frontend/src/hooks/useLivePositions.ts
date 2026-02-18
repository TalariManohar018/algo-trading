import { useState, useEffect } from 'react';
import { Position, tradeService } from '../services/tradeService';
import { usePositionUpdates } from './useWebSocket';

export function useLivePositions() {
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const positionUpdate = usePositionUpdates();

    const fetchPositions = async () => {
        try {
            setLoading(true);
            const data = await tradeService.getAllPositions();
            setPositions(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch positions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPositions();
    }, []);

    // Update positions when WebSocket message arrives
    useEffect(() => {
        if (positionUpdate?.data) {
            fetchPositions(); // Refetch to get updated data
        }
    }, [positionUpdate]);

    return { positions, loading, error, refetch: fetchPositions };
}
