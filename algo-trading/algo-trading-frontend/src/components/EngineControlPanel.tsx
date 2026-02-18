import { useState, useEffect } from 'react';
import { Play, Square, AlertTriangle, RefreshCw } from 'lucide-react';
import { engineApi, EngineStatus } from '../api/engine';
import { marketDataApi } from '../api/marketData';
import { useError } from '../context/ErrorContext';

export default function EngineControlPanel() {
    const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
    const [marketDataRunning, setMarketDataRunning] = useState(false);
    const [loading, setLoading] = useState(false);
    const { showError, showSuccess } = useError();

    const fetchStatus = async () => {
        try {
            const [engineData, marketData] = await Promise.all([
                engineApi.getStatus(),
                marketDataApi.getStatus(),
            ]);
            setEngineStatus(engineData);
            setMarketDataRunning(marketData.running);
        } catch (error) {
            console.error('Error fetching status:', error);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const handleStartMarketData = async () => {
        setLoading(true);
        try {
            await marketDataApi.start();
            showSuccess('Market data simulator started');
            await fetchStatus();
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Failed to start market data');
        } finally {
            setLoading(false);
        }
    };

    const handleStartEngine = async () => {
        setLoading(true);
        try {
            // Ensure market data is running first
            if (!marketDataRunning) {
                await marketDataApi.start();
            }

            await engineApi.startEngine();
            showSuccess('Trading engine started successfully');
            await fetchStatus();
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Failed to start engine');
        } finally {
            setLoading(false);
        }
    };

    const handleStopEngine = async () => {
        setLoading(true);
        try {
            await engineApi.stopEngine();
            showSuccess('Trading engine stopped');
            await fetchStatus();
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Failed to stop engine');
        } finally {
            setLoading(false);
        }
    };

    const handleEmergencyStop = async () => {
        if (!confirm('🚨 EMERGENCY STOP will close all positions immediately. Continue?')) {
            return;
        }

        setLoading(true);
        try {
            await engineApi.emergencyStop();
            showSuccess('Emergency stop executed - all positions closed');
            await fetchStatus();
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Failed to execute emergency stop');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'RUNNING':
                return 'bg-green-100 text-green-800';
            case 'STOPPED':
                return 'bg-gray-100 text-gray-800';
            case 'LOCKED':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Trading Engine Control</h2>

            {/* Status Display */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Engine Status</div>
                    <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(engineStatus?.status)}`}>
                            {engineStatus?.status || 'UNKNOWN'}
                        </span>
                    </div>
                    {engineStatus?.lockReason && (
                        <div className="mt-2 text-sm text-red-600">
                            🔒 {engineStatus.lockReason}
                        </div>
                    )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Market Data</div>
                    <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${marketDataRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                            {marketDataRunning ? 'RUNNING' : 'STOPPED'}
                        </span>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Running Strategies</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {engineStatus?.runningStrategiesCount || 0}
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Open Positions</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {engineStatus?.openPositionsCount || 0}
                    </div>
                </div>
            </div>

            {/* Control Buttons */}
            <div className="flex space-x-3">
                {!marketDataRunning && (
                    <button
                        onClick={handleStartMarketData}
                        disabled={loading}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play className="h-4 w-4" />
                        <span>Start Market Data</span>
                    </button>
                )}

                {engineStatus?.status === 'STOPPED' || engineStatus?.status === 'LOCKED' ? (
                    <button
                        onClick={handleStartEngine}
                        disabled={loading || engineStatus?.status === 'LOCKED'}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play className="h-4 w-4" />
                        <span>Start Engine</span>
                    </button>
                ) : (
                    <button
                        onClick={handleStopEngine}
                        disabled={loading}
                        className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Square className="h-4 w-4" />
                        <span>Stop Engine</span>
                    </button>
                )}

                <button
                    onClick={handleEmergencyStop}
                    disabled={loading || engineStatus?.status === 'STOPPED'}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <AlertTriangle className="h-4 w-4" />
                    <span>EMERGENCY STOP</span>
                </button>

                <button
                    onClick={fetchStatus}
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw className="h-4 w-4" />
                    <span>Refresh</span>
                </button>
            </div>
        </div>
    );
}
