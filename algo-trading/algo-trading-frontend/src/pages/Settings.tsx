import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { User, Zap, Shield, Bell, Wallet, AlertTriangle, Clock, Calendar, HelpCircle, CheckCircle } from 'lucide-react';
import { useError } from '../context/ErrorContext';

export default function Settings() {
    const { user } = useAuth();
    const { settings, updateSettings, resetWallet } = useSettings();
    const { showSuccess, showError } = useError();
    const navigate = useNavigate();
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showLiveConfirm, setShowLiveConfirm] = useState(false);

    const handleSaveSettings = () => {
        showSuccess('Settings saved successfully');
    };

    const handleSetPaperMode = () => {
        updateSettings({ tradingMode: 'PAPER' });
        console.log('[Settings] Trading mode set to: PAPER');
        showSuccess('Switched to Paper Trading mode — virtual wallet active');
    };

    const handleSetLiveMode = () => {
        updateSettings({ tradingMode: 'LIVE' });
        setShowLiveConfirm(false);
        console.warn('[Settings] Trading mode set to: LIVE (broker not connected — execution will be blocked)');
        showError('Live Trading mode selected — broker not connected. Trade execution will be blocked until broker credentials are configured.');
    };

    const handleResetWallet = () => {
        resetWallet();
        setShowResetConfirm(false);
        showSuccess('Virtual wallet reset successfully');
    };

    if (!user) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600 mt-1">Configure your trading environment and preferences</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Settings */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Trading Mode */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <Zap className="h-5 w-5 text-gray-500" />
                            <h2 className="text-xl font-semibold text-gray-900">Trading Mode</h2>
                        </div>

                        <div className="space-y-4">
                            {/* Paper Trading */}
                            <div
                                onClick={handleSetPaperMode}
                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${settings.tradingMode === 'PAPER'
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-gray-200 hover:border-blue-300 bg-white'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <h3 className="font-semibold text-gray-900">Paper Trading</h3>
                                            {settings.tradingMode === 'PAPER' && (
                                                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3" /> Active
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Trade with virtual money. Perfect for testing strategies risk-free.
                                        </p>
                                        <p className="text-xs text-emerald-600 mt-1 font-medium">
                                            Virtual wallet: ₹{settings.startingCapital.toLocaleString('en-IN')} — No real money at risk
                                        </p>
                                    </div>
                                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${settings.tradingMode === 'PAPER' ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                                        }`}>
                                        {settings.tradingMode === 'PAPER' && <div className="h-2 w-2 bg-white rounded-full" />}
                                    </div>
                                </div>
                            </div>

                            {/* Live Trading */}
                            <div
                                onClick={() => setShowLiveConfirm(true)}
                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${settings.tradingMode === 'LIVE'
                                    ? 'border-red-500 bg-red-50'
                                    : 'border-gray-200 hover:border-red-300 bg-white'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <h3 className="font-semibold text-gray-900">Live Trading</h3>
                                            {settings.tradingMode === 'LIVE' && (
                                                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3" /> Active
                                                </span>
                                            )}
                                            {settings.tradingMode !== 'LIVE' && (
                                                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                                                    Broker Required
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Trade with real money. Requires broker connection.
                                        </p>
                                        <div className="flex items-center space-x-1 mt-2">
                                            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
                                            <span className="text-xs text-yellow-700 font-medium">
                                                Broker not connected — orders will be blocked
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${settings.tradingMode === 'LIVE' ? 'border-red-500 bg-red-500' : 'border-gray-300'
                                        }`}>
                                        {settings.tradingMode === 'LIVE' && <div className="h-2 w-2 bg-white rounded-full" />}
                                    </div>
                                </div>
                            </div>

                            {/* Live Mode confirmation dialog */}
                            {showLiveConfirm && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-start gap-2 mb-3">
                                        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-red-900">Switch to Live Trading?</p>
                                            <p className="text-xs text-red-700 mt-1">
                                                To enable live trading, connect your Angel One account first from the
                                                <strong> Broker Connect</strong> page.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setShowLiveConfirm(false); navigate('/broker'); }}
                                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                                        >
                                            Go to Broker Connect
                                        </button>
                                        <button
                                            onClick={handleSetLiveMode}
                                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                                        >
                                            Set Live Mode Anyway
                                        </button>
                                        <button
                                            onClick={() => setShowLiveConfirm(false)}
                                            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-600"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Virtual Wallet */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <Wallet className="h-5 w-5 text-gray-500" />
                            <h2 className="text-xl font-semibold text-gray-900">Virtual Wallet</h2>
                            <div className="flex items-center space-x-1 text-gray-400 cursor-help" title="Only available in Paper Trading mode">
                                <HelpCircle className="h-4 w-4" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Starting Capital (₹)
                                </label>
                                <input
                                    type="number"
                                    value={settings.startingCapital}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value) || 0;
                                        updateSettings({ startingCapital: value });
                                    }}
                                    onBlur={handleSaveSettings}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    min="10000"
                                    step="10000"
                                />
                                <p className="text-xs text-gray-500 mt-1">Initial balance for paper trading</p>
                            </div>

                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">Current Balance</span>
                                    <span className="text-lg font-bold text-blue-600">
                                        ₹{settings.currentBalance.toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500">Profit/Loss</span>
                                    <span className={`font-semibold ${settings.currentBalance >= settings.startingCapital
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                        }`}>
                                        {settings.currentBalance >= settings.startingCapital ? '+' : ''}
                                        ₹{(settings.currentBalance - settings.startingCapital).toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowResetConfirm(true)}
                                className="w-full px-4 py-2 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium"
                            >
                                Reset Wallet & Clear All Data
                            </button>

                            {showResetConfirm && (
                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm text-yellow-800 font-medium mb-3">
                                        Are you sure? This will reset your balance and clear all trades, positions, and strategies.
                                    </p>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={handleResetWallet}
                                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                                        >
                                            Yes, Reset Everything
                                        </button>
                                        <button
                                            onClick={() => setShowResetConfirm(false)}
                                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Risk Management */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <Shield className="h-5 w-5 text-gray-500" />
                            <h2 className="text-xl font-semibold text-gray-900">Risk Management</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs text-amber-800 font-medium">
                                    ⚠️ Risk rules will be enforced once execution engine is enabled.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Max Loss Per Day (₹)
                                </label>
                                <input
                                    type="number"
                                    value={settings.maxLossPerDay}
                                    onChange={(e) => updateSettings({ maxLossPerDay: parseInt(e.target.value) || 0 })}
                                    onBlur={handleSaveSettings}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    min="1000"
                                    step="1000"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    The maximum combined loss allowed in a single trading day. Trading will automatically stop when this limit is hit.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Max Trades Per Day
                                </label>
                                <input
                                    type="number"
                                    value={settings.maxTradesPerDay}
                                    onChange={(e) => updateSettings({ maxTradesPerDay: parseInt(e.target.value) || 0 })}
                                    onBlur={handleSaveSettings}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    min="1"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Caps the number of round-trip trades per day to prevent over-trading and excessive brokerage costs.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Max Capital Per Trade (%)
                                </label>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="range"
                                        min="1"
                                        max="50"
                                        value={settings.maxCapitalPerTrade}
                                        onChange={(e) => updateSettings({ maxCapitalPerTrade: parseInt(e.target.value) })}
                                        onMouseUp={handleSaveSettings}
                                        className="flex-1"
                                    />
                                    <span className="text-sm font-semibold text-gray-900 w-12">
                                        {settings.maxCapitalPerTrade}%
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Maximum {settings.maxCapitalPerTrade}% of capital per trade =
                                    ₹{((settings.currentBalance * settings.maxCapitalPerTrade) / 100).toLocaleString('en-IN')}.
                                    Limits exposure on any single trade to protect your portfolio from outsized losses.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Strategy Execution Rules */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <Calendar className="h-5 w-5 text-gray-500" />
                            <h2 className="text-xl font-semibold text-gray-900">Strategy Execution Rules</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-900">Allow Multiple Strategies</p>
                                    <p className="text-sm text-gray-500">Run multiple strategies simultaneously</p>
                                </div>
                                <button
                                    onClick={() => {
                                        updateSettings({ allowMultipleStrategies: !settings.allowMultipleStrategies });
                                        handleSaveSettings();
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.allowMultipleStrategies ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.allowMultipleStrategies ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <div className="flex items-center space-x-2">
                                        <Clock className="h-4 w-4" />
                                        <span>Auto Square-Off Time</span>
                                    </div>
                                </label>
                                <input
                                    type="time"
                                    value={settings.autoSquareOffTime}
                                    onChange={(e) => updateSettings({ autoSquareOffTime: e.target.value })}
                                    onBlur={handleSaveSettings}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">All positions will be squared off at this time</p>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-900">Market Days Only</p>
                                    <p className="text-sm text-gray-500">Prevent trading on weekends</p>
                                </div>
                                <button
                                    onClick={() => {
                                        updateSettings({ marketDaysOnly: !settings.marketDaysOnly });
                                        handleSaveSettings();
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.marketDaysOnly ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.marketDaysOnly ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Profile Information */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <User className="h-5 w-5 text-gray-500" />
                            <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={user.name}
                                    disabled
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={user.email}
                                    disabled
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Role
                                </label>
                                <input
                                    type="text"
                                    value={user.role}
                                    disabled
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Notifications */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center space-x-3 mb-4">
                            <Bell className="h-5 w-5 text-gray-500" />
                            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">Strategy Started</span>
                                <button
                                    onClick={() => {
                                        updateSettings({
                                            notifications: {
                                                ...settings.notifications,
                                                strategyStarted: !settings.notifications.strategyStarted
                                            }
                                        });
                                        handleSaveSettings();
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.notifications.strategyStarted ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notifications.strategyStarted ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">Strategy Stopped</span>
                                <button
                                    onClick={() => {
                                        updateSettings({
                                            notifications: {
                                                ...settings.notifications,
                                                strategyStopped: !settings.notifications.strategyStopped
                                            }
                                        });
                                        handleSaveSettings();
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.notifications.strategyStopped ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notifications.strategyStopped ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">Trade Executed</span>
                                <button
                                    onClick={() => {
                                        updateSettings({
                                            notifications: {
                                                ...settings.notifications,
                                                tradeExecuted: !settings.notifications.tradeExecuted
                                            }
                                        });
                                        handleSaveSettings();
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.notifications.tradeExecuted ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notifications.tradeExecuted ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">Daily PnL Summary</span>
                                <button
                                    onClick={() => {
                                        updateSettings({
                                            notifications: {
                                                ...settings.notifications,
                                                dailyPnlSummary: !settings.notifications.dailyPnlSummary
                                            }
                                        });
                                        handleSaveSettings();
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.notifications.dailyPnlSummary ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notifications.dailyPnlSummary ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Today's Limits</h3>
                        <div className="space-y-3">
                            <div>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-gray-600">Daily Trades</span>
                                    <span className="font-semibold text-gray-900">
                                        0 / {settings.maxTradesPerDay}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full"
                                        style={{ width: '0%' }}
                                    ></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-gray-600">Loss Limit</span>
                                    <span className="font-semibold text-green-600">
                                        ₹0 / ₹{settings.maxLossPerDay.toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-green-600 h-2 rounded-full"
                                        style={{ width: '0%' }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
