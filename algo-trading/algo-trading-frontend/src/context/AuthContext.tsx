import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';

interface User {
    name: string;
    email: string;
    role: 'USER' | 'ADMIN';
    createdAt: string;
    subscription: 'Free' | 'Pro';
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    loading: boolean;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Auto-login with a default user (no backend auth required)
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
        } else {
            setUser({
                name: 'Trader',
                email: 'trader@algo.app',
                role: 'ADMIN',
                createdAt: new Date().toISOString(),
                subscription: 'Pro'
            });
        }
        setLoading(false);
    }, []);

    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const userData = await authService.login({ email, password });
            setUser(userData);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || 'Login failed' };
        }
    };

    const signup = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const userData = await authService.signup({ name, email, password });
            setUser(userData);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || 'Signup failed' };
        }
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    const isAdmin = user?.role === 'ADMIN';

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            login,
            signup,
            logout,
            loading,
            isAdmin
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
