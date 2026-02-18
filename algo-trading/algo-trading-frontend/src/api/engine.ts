import { API_BASE_URL } from './config';

export interface EngineStatus {
    status: string;
    userId: number | null;
    marketDataRunning: boolean;
    runningStrategiesCount: number;
    openPositionsCount: number;
    lastTickAt?: string;
    lockReason?: string;
}

export const engineApi = {
    // Start engine
    startEngine: async (userId: number = 1): Promise<any> => {
        const response = await fetch(`${API_BASE_URL}/api/engine/start?userId=${userId}`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to start engine');
        return response.json();
    },

    // Stop engine
    stopEngine: async (userId: number = 1): Promise<any> => {
        const response = await fetch(`${API_BASE_URL}/api/engine/stop?userId=${userId}`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to stop engine');
        return response.json();
    },

    // Emergency stop
    emergencyStop: async (userId: number = 1, reason: string = 'Manual emergency stop'): Promise<any> => {
        const response = await fetch(
            `${API_BASE_URL}/api/engine/emergency-stop?userId=${userId}&reason=${encodeURIComponent(reason)}`,
            { method: 'POST' }
        );
        if (!response.ok) throw new Error('Failed to execute emergency stop');
        return response.json();
    },

    // Get engine status
    getStatus: async (userId: number = 1): Promise<EngineStatus> => {
        const response = await fetch(`${API_BASE_URL}/api/engine/status?userId=${userId}`);
        if (!response.ok) throw new Error('Failed to fetch engine status');
        return response.json();
    },

    // Reset daily counters
    resetCounters: async (): Promise<any> => {
        const response = await fetch(`${API_BASE_URL}/api/engine/reset-counters`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to reset counters');
        return response.json();
    },
};
