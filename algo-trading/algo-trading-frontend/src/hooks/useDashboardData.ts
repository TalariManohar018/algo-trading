import { useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';
import { orderDataService } from '../services/orderDataService';
import { positionDataService } from '../services/positionDataService';
import { tradeDataService } from '../services/tradeDataService';
import { walletDataService } from '../services/walletDataService';
import { riskDataService } from '../services/riskDataService';

export const useDashboardData = (refreshInterval: number = 5000) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [trades, setTrades] = useState<any[]>([]);
    const [wallet, setWallet] = useState<any>(null);
    const [riskState, setRiskState] = useState<any>(null);
    const [engineStatus, setEngineStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [
                ordersData,
                positionsData,
                tradesData,
                walletData,
                riskData,
                engineData
            ] = await Promise.all([
                orderDataService.getOpenOrders(),
                positionDataService.getOpenPositions(),
                tradeDataService.getAllTrades(),
                walletDataService.getWallet(),
                riskDataService.getRiskState(),
                apiClient.getEngineStatus().catch(() => ({ status: 'STOPPED' }))
            ]);

            setOrders(ordersData);
            setPositions(positionsData);
            setTrades(tradesData.slice(0, 10)); // Last 10 trades
            setWallet(walletData);
            setRiskState(riskData);
            setEngineStatus(engineData);
        } catch (err: any) {
            console.error('Failed to fetch dashboard data:', err);
            setError(err.message || 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        const interval = setInterval(() => {
            fetchData();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [refreshInterval]);

    return {
        orders,
        positions,
        trades,
        wallet,
        riskState,
        engineStatus,
        loading,
        error,
        refresh: fetchData
    };
};
