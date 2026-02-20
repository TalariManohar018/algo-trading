import { useState, useEffect, useCallback } from 'react';
import {
    Link2, Link2Off, Shield, Eye, EyeOff, RefreshCw, AlertTriangle,
    CheckCircle, XCircle, Loader2, ExternalLink, Wifi, WifiOff, Zap
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useError } from '../context/ErrorContext';
import {
    brokerLogin, brokerLogout, getBrokerStatus,
    refreshBrokerSession, emergencyStop, resumeTrading,
    BrokerLoginRequest, BrokerStatus,
} from '../api/broker';

export default function BrokerConnect() {
    const { settings, updateSettings } = useSettings();
    const { showSuccess, showError } = useError();

    // Connection state
    const [status, setStatus] = useState<BrokerStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [polling, setPolling] = useState(false);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);
    const [creds, setCreds] = useState<BrokerLoginRequest>({
        apiKey: '',
        clientId: '',
        password: '',
        totpSecret: '',
    });

    // Check broker status on mount
    const checkStatus = useCallback(async () => {
        try {
            setPolling(true);
            const s = await getBrokerStatus();
            setStatus(s);
        } catch {
            setStatus({ connected: false, broker: 'none', mode: 'paper' });
        } finally {
            setPolling(false);
        }
    }, []);

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 15000); // poll every 15s
        return () => clearInterval(interval);
    }, [checkStatus]);

    // Login handler
    const handleLogin = async () => {
        if (!creds.apiKey || !creds.clientId || !creds.password || !creds.totpSecret) {
            showError('Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            const result = await brokerLogin(creds);
            if (result.success) {
                showSuccess('Connected to Angel One! Live trading is now available.');
                updateSettings({ tradingMode: 'LIVE' });
                setShowForm(false);
                setCreds({ apiKey: '', clientId: '', password: '', totpSecret: '' });
                await checkStatus();
            } else {
                showError(result.message);
            }
        } catch (err: any) {
            showError(err.message || 'Failed to connect to Angel One');
        } finally {
            setLoading(false);
        }
    };

    // Logout handler
    const handleLogout = async () => {
        setLoading(true);
        try {
            await brokerLogout();
            showSuccess('Disconnected from Angel One. Switched to Paper Trading.');
            updateSettings({ tradingMode: 'PAPER' });
            await checkStatus();
        } catch {
            showError('Failed to disconnect');
        } finally {
            setLoading(false);
        }
    };

    // Refresh session
    const handleRefresh = async () => {
        setLoading(true);
        try {
            const result = await refreshBrokerSession();
            if (result.success) {
                showSuccess('Session refreshed');
                await checkStatus();
            } else {
                showError('Session refresh failed. Please re-login.');
            }
        } catch {
            showError('Session refresh failed');
        } finally {
            setLoading(false);
        }
    };

    // Emergency stop
    const handleEmergencyStop = async () => {
        if (!confirm('EMERGENCY STOP: This will block all new orders and optionally square off all positions. Continue?')) return;
        setLoading(true);
        try {
            const result = await emergencyStop(true);
            showError(result.message || 'Emergency stop activated');
            await checkStatus();
        } catch {
            showError('Emergency stop failed');
        } finally {
            setLoading(false);
        }
    };

    // Resume
    const handleResume = async () => {
        setLoading(true);
        try {
            const result = await resumeTrading();
            showSuccess(result.message || 'Trading resumed');
            await checkStatus();
        } catch {
            showError('Resume failed');
        } finally {
            setLoading(false);
        }
    };

    const isConnected = status?.connected === true;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Broker Connection</h1>
                <p className="text-gray-600 mt-1">
                    Connect your Angel One account to enable automated live trading
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Connection Status + Login */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Connection Status Card */}
                    <div className={`rounded-xl border-2 p-6 transition-all ${isConnected
                        ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50'
                        : 'border-gray-200 bg-white'
                        }`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                {isConnected ? (
                                    <div className="bg-green-100 p-3 rounded-xl">
                                        <Wifi className="h-6 w-6 text-green-600" />
                                    </div>
                                ) : (
                                    <div className="bg-gray-100 p-3 rounded-xl">
                                        <WifiOff className="h-6 w-6 text-gray-400" />
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        {isConnected ? 'Angel One Connected' : 'Not Connected'}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {isConnected
                                            ? `Client ID: ${status?.clientId || '—'} • Live trading active`
                                            : 'Connect your Angel One account to start live trading'
                                        }
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                {polling && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
                                <span className={`px-3 py-1.5 text-xs font-bold rounded-full ${isConnected
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {isConnected ? 'LIVE' : 'OFFLINE'}
                                </span>
                            </div>
                        </div>

                        {isConnected && (
                            <div className="flex items-center gap-3 mt-4">
                                <button
                                    onClick={handleRefresh}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh Session
                                </button>
                                <button
                                    onClick={handleLogout}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                    <Link2Off className="h-4 w-4" />
                                    Disconnect
                                </button>
                            </div>
                        )}

                        {!isConnected && (
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="mt-4 flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                <Link2 className="h-4 w-4" />
                                Connect Angel One Account
                            </button>
                        )}
                    </div>

                    {/* Login Form */}
                    {showForm && !isConnected && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                            <div className="flex items-center space-x-3 mb-6">
                                <div className="bg-orange-100 p-2 rounded-lg">
                                    <img
                                        src="https://www.angelone.in/favicon.ico"
                                        alt="Angel One"
                                        className="h-5 w-5"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Angel One SmartAPI Login</h3>
                                    <p className="text-xs text-gray-500">Your credentials are sent directly to Angel One's API and not stored on any server</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* API Key */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                    <input
                                        type="text"
                                        value={creds.apiKey}
                                        onChange={(e) => setCreds({ ...creds, apiKey: e.target.value })}
                                        placeholder="Your Angel One SmartAPI key"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Get this from <a href="https://smartapi.angelone.in/publisher" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">smartapi.angelone.in</a>
                                    </p>
                                </div>

                                {/* Client ID */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                                    <input
                                        type="text"
                                        value={creds.clientId}
                                        onChange={(e) => setCreds({ ...creds, clientId: e.target.value.toUpperCase() })}
                                        placeholder="e.g. A12345678"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm uppercase"
                                    />
                                </div>

                                {/* Password / MPIN */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Password / MPIN</label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords ? 'text' : 'password'}
                                            value={creds.password}
                                            onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                                            placeholder="Your Angel One MPIN or password"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords(!showPasswords)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* TOTP Secret */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">TOTP Secret</label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords ? 'text' : 'password'}
                                            value={creds.totpSecret}
                                            onChange={(e) => setCreds({ ...creds, totpSecret: e.target.value.toUpperCase() })}
                                            placeholder="Base32 TOTP secret from Angel One app"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-10 uppercase"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords(!showPasswords)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Found in Angel One app → Settings → TOTP → Scan QR code to get secret
                                    </p>
                                </div>

                                {/* Submit */}
                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        onClick={handleLogin}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Connecting...
                                            </>
                                        ) : (
                                            <>
                                                <Link2 className="h-4 w-4" />
                                                Connect & Login
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => { setShowForm(false); setCreds({ apiKey: '', clientId: '', password: '', totpSecret: '' }); }}
                                        className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Auto Trading Section */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center space-x-3 mb-4">
                            <Zap className="h-5 w-5 text-yellow-500" />
                            <h2 className="text-lg font-semibold text-gray-900">Automated Trading</h2>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            When connected, your strategies will automatically execute trades on Angel One.
                            The engine evaluates your strategies on every candle close and places real orders.
                        </p>

                        <div className="space-y-3">
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Strategy → Signal → Order</p>
                                    <p className="text-xs text-gray-500">Your custom strategies evaluate market data and generate BUY/SELL signals automatically</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <Shield className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Risk Management Built-in</p>
                                    <p className="text-xs text-gray-500">Max daily loss, max order value, position limits — all checked before every order</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Emergency Stop</p>
                                    <p className="text-xs text-gray-500">One-click kill switch to stop all orders and square off positions instantly</p>
                                </div>
                            </div>
                        </div>

                        {/* How it works */}
                        <div className="mt-6 p-4 border border-blue-200 bg-blue-50 rounded-lg">
                            <h4 className="text-sm font-semibold text-blue-900 mb-2">How Auto Trading Works</h4>
                            <ol className="space-y-1 text-xs text-blue-800 list-decimal list-inside">
                                <li>Create a strategy in the <strong>Strategy Builder</strong></li>
                                <li>Click <strong>Start</strong> on the strategy to activate it</li>
                                <li>Connect your Angel One account above</li>
                                <li>The engine monitors the market and executes trades automatically</li>
                                <li>View live trades in the <strong>Trades</strong> and <strong>Positions</strong> pages</li>
                            </ol>
                        </div>
                    </div>
                </div>

                {/* Right Column: Info & Safety */}
                <div className="space-y-6">

                    {/* Current Mode */}
                    <div className={`rounded-xl border p-5 ${settings.tradingMode === 'LIVE'
                        ? 'border-red-200 bg-red-50'
                        : 'border-green-200 bg-green-50'
                        }`}>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Trading Mode</h3>
                        <div className="flex items-center gap-2">
                            <span className={`text-2xl font-bold ${settings.tradingMode === 'LIVE' ? 'text-red-600' : 'text-green-600'}`}>
                                {settings.tradingMode}
                            </span>
                            {settings.tradingMode === 'LIVE' && isConnected && (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                            )}
                            {settings.tradingMode === 'LIVE' && !isConnected && (
                                <XCircle className="h-5 w-5 text-red-500" />
                            )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                            {settings.tradingMode === 'PAPER'
                                ? 'Using virtual wallet — no real money'
                                : isConnected
                                    ? 'Orders execute on Angel One with real money'
                                    : 'Live mode selected but broker not connected'
                            }
                        </p>
                    </div>

                    {/* Emergency Controls */}
                    {isConnected && (
                        <div className="rounded-xl border border-red-200 bg-white p-5">
                            <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Emergency Controls
                            </h3>
                            <div className="space-y-3">
                                <button
                                    onClick={handleEmergencyStop}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                    <AlertTriangle className="h-4 w-4" />
                                    EMERGENCY STOP
                                </button>
                                <button
                                    onClick={handleResume}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors border border-green-200"
                                >
                                    <CheckCircle className="h-4 w-4" />
                                    Resume Trading
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Safety Info */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-500" />
                            Safety Features
                        </h3>
                        <ul className="space-y-2 text-xs text-gray-600">
                            <li className="flex items-start gap-2">
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                Max daily loss limit (₹5,000 default)
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                Max order value cap (₹50,000 default)
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                Auto session refresh on token expiry
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                Rate limiting (9 req/s, Angel One limit: 10)
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                Retry with exponential backoff
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                Emergency kill switch
                            </li>
                        </ul>
                    </div>

                    {/* Help Link */}
                    <div className="rounded-xl border border-gray-200 bg-white p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">Need Help?</h3>
                        <a
                            href="https://smartapi.angelone.in/docs"
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                            Angel One SmartAPI Docs
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <p className="text-xs text-gray-500 mt-2">
                            To get your API key and TOTP secret, visit the SmartAPI publisher page and enable TOTP in your Angel One mobile app.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
