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
        const token = () => localStorage.getItem('jwt_token');
        const headers: HeadersInit = token() ? { Authorization: `Bearer ${token()}` } : {};
        const response = await fetch(`${API_BASE_URL}/engine/start`, {
            method: 'POST',
            headers,
        });
        if (!response.ok) throw new Error('Failed to start engine');
        return response.json();
    },

    // Stop engine
    stopEngine: async (): Promise<any> => {
        const token = localStorage.getItem('jwt_token');
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`${API_BASE_URL}/engine/stop`, {
            method: 'POST',
            headers,
        });
        if (!response.ok) throw new Error('Failed to stop engine');
        return response.json();
    },

    // Emergency stop
    emergencyStop: async (reason: string = 'Manual emergency stop'): Promise<any> => {
        const token = localStorage.getItem('jwt_token');
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`${API_BASE_URL}/engine/emergency-stop`, {
            method: 'POST',
            headers,
        });
        if (!response.ok) throw new Error('Failed to execute emergency stop');
        return response.json();
    },

    // Get engine status
    getStatus: async (): Promise<EngineStatus> => {
        const token = localStorage.getItem('jwt_token');
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`${API_BASE_URL}/engine/status`, { headers });
        if (!response.ok) throw new Error('Failed to fetch engine status');
        return response.json();
    },

    // Reset daily counters
    resetCounters: async (): Promise<any> => {
        const token = localStorage.getItem('jwt_token');
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`${API_BASE_URL}/engine/reload`, {
            method: 'POST',
            headers,
        });
        if (!response.ok) throw new Error('Failed to reset counters');
        return response.json();
    },
};
