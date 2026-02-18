import { useState } from 'react';

interface AsyncState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

export function useAsync<T>(asyncFunction: (...args: any[]) => Promise<T>) {
    const [state, setState] = useState<AsyncState<T>>({
        data: null,
        loading: false,
        error: null
    });

    const execute = async (...args: any[]) => {
        setState({ data: null, loading: true, error: null });
        try {
            const result = await asyncFunction(...args);
            setState({ data: result, loading: false, error: null });
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setState({ data: null, loading: false, error: errorMessage });
            throw err;
        }
    };

    const reset = () => {
        setState({ data: null, loading: false, error: null });
    };

    return { ...state, execute, reset };
}
