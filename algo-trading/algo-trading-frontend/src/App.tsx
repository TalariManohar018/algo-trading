import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LoadingProvider } from './context/LoadingContext';
import { ErrorProvider } from './context/ErrorContext';
import { SettingsProvider } from './context/SettingsContext';
import { TradingProvider } from './context/TradingContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LiveTradingWarning from './components/LiveTradingWarning';
import Dashboard from './pages/Dashboard';
import Strategies from './pages/Strategies';
import Builder from './pages/Builder';
import Backtest from './pages/Backtest';
import Trades from './pages/Trades';
import Positions from './pages/Positions';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Protected Route Component — auth bypass: allow all access
function ProtectedRoute({ children }: { children: JSX.Element }) {
    return children;
}

// Public Route Component — auth bypass: allow all access
function PublicRoute({ children }: { children: JSX.Element }) {
    return children;
}

// Layout wrapper for protected pages
function ProtectedLayout({ children }: { children: JSX.Element }) {
    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-100">
                <Navbar />
                <LiveTradingWarning />
                <Sidebar />
                <main className="ml-64 mt-16 p-8">
                    {children}
                </main>
            </div>
        </ProtectedRoute>
    );
}

function AppRoutes() {
    return (
        <Router>
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={
                    <PublicRoute>
                        <Login />
                    </PublicRoute>
                } />
                <Route path="/signup" element={
                    <PublicRoute>
                        <Signup />
                    </PublicRoute>
                } />

                {/* Protected Routes */}
                <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
                <Route path="/strategies" element={<ProtectedLayout><Strategies /></ProtectedLayout>} />
                <Route path="/builder" element={<ProtectedLayout><Builder /></ProtectedLayout>} />
                <Route path="/backtest" element={<ProtectedLayout><Backtest /></ProtectedLayout>} />
                <Route path="/trades" element={<ProtectedLayout><Trades /></ProtectedLayout>} />
                <Route path="/positions" element={<ProtectedLayout><Positions /></ProtectedLayout>} />
                <Route path="/profile" element={<ProtectedLayout><Profile /></ProtectedLayout>} />
                <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />

                {/* Redirect root to dashboard */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* 404 - Redirect to dashboard */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Router>
    );
}

function App() {
    return (
        <AuthProvider>
            <LoadingProvider>
                <ErrorProvider>
                    <SettingsProvider>
                        <TradingProvider>
                            <AppRoutes />
                        </TradingProvider>
                    </SettingsProvider>
                </ErrorProvider>
            </LoadingProvider>
        </AuthProvider>
    );
}

export default App;
