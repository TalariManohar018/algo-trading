import { API_BASE_URL, API_ENDPOINTS } from './config';
import { ExecutableStrategy } from '../types/strategy';

export const strategyApi = {
    // Get all strategies
    getAllStrategies: async (search?: string): Promise<ExecutableStrategy[]> => {
        const url = search
            ? `${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}?search=${encodeURIComponent(search)}`
            : `${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch strategies');
        return response.json();
    },

    // Get strategy by ID
    getStrategyById: async (id: number): Promise<ExecutableStrategy> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}/${id}`);
        if (!response.ok) throw new Error('Failed to fetch strategy');
        return response.json();
    },

    // Create strategy
    createStrategy: async (strategy: Partial<ExecutableStrategy>): Promise<ExecutableStrategy> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(strategy),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Failed to create strategy');
        }
        return response.json();
    },

    // Activate strategy
    activateStrategy: async (id: number): Promise<ExecutableStrategy> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}/${id}/activate`, {
            method: 'PUT',
        });
        if (!response.ok) throw new Error('Failed to activate strategy');
        return response.json();
    },

    // Deactivate strategy
    deactivateStrategy: async (id: number): Promise<ExecutableStrategy> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}/${id}/deactivate`, {
            method: 'PUT',
        });
        if (!response.ok) throw new Error('Failed to deactivate strategy');
        return response.json();
    },

    // Update strategy status
    updateStrategyStatus: async (id: number, status: string): Promise<ExecutableStrategy> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}/${id}/status?status=${status}`, {
            method: 'PUT',
        });
        if (!response.ok) throw new Error('Failed to update strategy status');
        return response.json();
    },

    // Delete strategy
    deleteStrategy: async (id: number): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete strategy');
    },
};
