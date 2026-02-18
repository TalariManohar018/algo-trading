import { createContext, useContext, useState, ReactNode } from 'react';
import { X, AlertCircle, CheckCircle } from 'lucide-react';

interface NotificationContextType {
    error: string | null;
    success: string | null;
    showError: (message: string) => void;
    showSuccess: (message: string) => void;
    clearError: () => void;
    clearSuccess: () => void;
}

const ErrorContext = createContext<NotificationContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const showError = (message: string) => {
        setError(message);
        setTimeout(() => {
            setError(null);
        }, 5000);
    };

    const showSuccess = (message: string) => {
        setSuccess(message);
        setTimeout(() => {
            setSuccess(null);
        }, 3000);
    };

    const clearError = () => setError(null);
    const clearSuccess = () => setSuccess(null);

    return (
        <ErrorContext.Provider value={{ error, success, showError, showSuccess, clearError, clearSuccess }}>
            {children}
            {/* Error Toast */}
            {error && (
                <div className="fixed top-20 right-4 z-50 animate-fadeIn">
                    <div className="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-lg p-4 max-w-md">
                        <div className="flex items-start space-x-3">
                            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-red-800">Error</h3>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                            <button
                                onClick={clearError}
                                className="text-red-400 hover:text-red-600 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Success Toast */}
            {success && (
                <div className="fixed top-20 right-4 z-50 animate-fadeIn">
                    <div className="bg-green-50 border-l-4 border-green-500 rounded-lg shadow-lg p-4 max-w-md">
                        <div className="flex items-start space-x-3">
                            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-green-800">Success</h3>
                                <p className="text-sm text-green-700 mt-1">{success}</p>
                            </div>
                            <button
                                onClick={clearSuccess}
                                className="text-green-400 hover:text-green-600 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ErrorContext.Provider>
    );
}

export function useError() {
    const context = useContext(ErrorContext);
    if (context === undefined) {
        throw new Error('useError must be used within an ErrorProvider');
    }
    return context;
}
