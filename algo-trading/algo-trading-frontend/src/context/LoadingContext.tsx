import { createContext, useContext, useState, ReactNode } from 'react';

interface LoadingContextType {
    isLoading: boolean;
    loadingMessage: string;
    setLoading: (loading: boolean, message?: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Loading...');

    const setLoading = (loading: boolean, message = 'Loading...') => {
        setIsLoading(loading);
        setLoadingMessage(message);
    };

    return (
        <LoadingContext.Provider value={{ isLoading, loadingMessage, setLoading }}>
            {children}
            {isLoading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 max-w-sm w-full mx-4">
                        <div className="flex flex-col items-center space-y-4">
                            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-lg font-medium text-gray-900">{loadingMessage}</p>
                        </div>
                    </div>
                </div>
            )}
        </LoadingContext.Provider>
    );
}

export function useLoading() {
    const context = useContext(LoadingContext);
    if (context === undefined) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
}
