import { API_BASE_URL, API_ENDPOINTS } from './config';
import { ExecutableStrategy } from '../types/strategy';

/** Unwrap backend envelope: { success, data } → data, or return array directly */
function unwrap<T>(result: any, fallback: T): T {
    if (Array.isArray(result)) return result as unknown as T;
    if (result && result.data !== undefined) return result.data as T;
    return fallback;
}

export const strategyApi = {
    // Get all strategies
    getAllStrategies: async (search?: string): Promise<ExecutableStrategy[]> => {
        const url = search
            ? `${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}?search=${encodeURIComponent(search)}`
            : `${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}`;

        const response = await fetch(url, {
            credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch strategies');
        const result = await response.json();
        return unwrap<ExecutableStrategy[]>(result, []);
    },

    // Get strategy by ID
    getStrategyById: async (id: number | string): Promise<ExecutableStrategy> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}/${id}`, {
            credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch strategy');
        const result = await response.json();
        return unwrap<ExecutableStrategy>(result, result);
    },

    // Create strategy
    createStrategy: async (strategy: Partial<ExecutableStrategy>): Promise<ExecutableStrategy> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(strategy),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Failed to create strategy');
        }
        const result = await response.json();
        return unwrap<ExecutableStrategy>(result, result);
    },

    // Activate strategy — also starts it in the backend execution engine
    activateStrategy: async (id: number | string): Promise<ExecutableStrategy> => {
        // Start in execution engine (backend)
        const engineRes = await fetch(`${API_BASE_URL}${API_ENDPOINTS.ENGINE}/strategy/${id}/start`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!engineRes.ok) {
            // Fallback: try the old activate endpoint
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}/${id}/activate`, {
                method: 'PUT',
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to activate strategy');
            const result = await response.json();
            return unwrap<ExecutableStrategy>(result, result);
        }
        const result = await engineRes.json();
        return unwrap<ExecutableStrategy>(result, result);
    },

    // Deactivate strategy — also stops it in the backend execution engine
    deactivateStrategy: async (id: number | string): Promise<ExecutableStrategy> => {
        // Stop in execution engine (backend)
        const engineRes = await fetch(`${API_BASE_URL}${API_ENDPOINTS.ENGINE}/strategy/${id}/stop`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!engineRes.ok) {
            // Fallback: try the old deactivate endpoint
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}/${id}/deactivate`, {
                method: 'PUT',
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to deactivate strategy');
            const result = await response.json();
            return unwrap<ExecutableStrategy>(result, result);
        }
        const result = await engineRes.json();
        return unwrap<ExecutableStrategy>(result, result);
    },

    // Update strategy status
    updateStrategyStatus: async (id: number, status: string): Promise<ExecutableStrategy> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}/${id}/status?status=${status}`, {
            method: 'PUT',
            credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to update strategy status');
        const result = await response.json();
        return unwrap<ExecutableStrategy>(result, result);
    },

    // Delete strategy
    deleteStrategy: async (id: number): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.STRATEGIES}/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to delete strategy');
    },
};
