import { useNavigate, useLocation } from 'react-router-dom';
import { TrendingUp, Link2 } from 'lucide-react';
import ProfileMenu from './ProfileMenu';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useState, useEffect } from 'react';
import { getBrokerStatus } from '../api/broker';

export default function Navbar() {
    const { isAuthenticated } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const location = useLocation();

    // Broker status polling
    const [brokerConnected, setBrokerConnected] = useState(false);
    useEffect(() => {
        const check = async () => {
            try {
                const s = await getBrokerStatus();
                setBrokerConnected(s.connected === true);
            } catch { setBrokerConnected(false); }
        };
        check();
        const iv = setInterval(check, 20000);
        return () => clearInterval(iv);
    }, []);

    // Hide navbar on login/signup pages
    const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';
    if (isAuthPage) return null;

    return (
        <nav className="bg-white border-b border-gray-200 fixed w-full z-30 top-0 shadow-sm">
            <div className="px-6 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <TrendingUp className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-gray-900 tracking-tight">AlgoTrader Pro</span>

                        {/* Trading Mode Badge */}
                        {isAuthenticated && (
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${settings.tradingMode === 'PAPER'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                                }`}>
                                {settings.tradingMode === 'PAPER' ? 'PAPER' : 'LIVE'}
                            </span>
                        )}

                        {/* Broker Status */}
                        {isAuthenticated && (
                            <button
                                onClick={() => navigate('/broker')}
                                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-colors ${brokerConnected
                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                title={brokerConnected ? 'Angel One connected — Click to manage' : 'Click to connect Angel One'}
                            >
                                <Link2 className="h-3 w-3" />
                                {brokerConnected ? 'Angel One' : 'Connect Broker'}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm text-gray-600">Market Open</span>
                        </div>

                        <div className="text-sm text-gray-600">
                            NIFTY: <span className="font-semibold text-green-600">21,450.50</span>
                            <span className="text-green-600 ml-1">+0.85%</span>
                        </div>

                        <div className="text-sm text-gray-600">
                            BANKNIFTY: <span className="font-semibold text-green-600">47,890.25</span>
                            <span className="text-green-600 ml-1">+1.12%</span>
                        </div>

                        {/* Show Login/Signup buttons OR Profile Menu */}
                        {!isAuthenticated ? (
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={() => navigate('/login')}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors duration-200"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => navigate('/signup')}
                                    className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
                                >
                                    Sign Up
                                </button>
                            </div>
                        ) : (
                            <ProfileMenu />
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
