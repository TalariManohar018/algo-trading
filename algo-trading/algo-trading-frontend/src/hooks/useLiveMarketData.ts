import { useState, useEffect } from 'react';
import { IndexData, marketService } from '../services/marketService';
import { useMarketUpdates } from './useWebSocket';

export function useLiveMarketData() {
    const [indices, setIndices] = useState<IndexData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const marketUpdate = useMarketUpdates();

    const fetchIndices = async () => {
        try {
            setLoading(true);
            const data = await marketService.getIndices();
            setIndices(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch market data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIndices();
    }, []);

    // Update indices when WebSocket message arrives
    useEffect(() => {
        if (marketUpdate?.data) {
            fetchIndices(); // Refetch to get updated data
        }
    }, [marketUpdate]);

    return { indices, loading, error, refetch: fetchIndices };
}
