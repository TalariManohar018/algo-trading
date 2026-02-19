import React, { useState } from 'react';
import { AlertOctagon, Power } from 'lucide-react';
import { emergencyStop, resetAfterEmergency, EmergencyStopResponse } from '../api/emergency';

const EmergencyKillSwitch: React.FC = () => {
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<EmergencyStopResponse | null>(null);

    const handleEmergencyStop = async () => {
        setLoading(true);
        try {
            const result = await emergencyStop();
            setResponse(result);
            setShowConfirmation(false);
        } catch (error) {
            console.error('Emergency stop failed:', error);
            alert('Emergency stop failed! Check console for details.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('Reset emergency state? Engine will be STOPPED but unlocked.')) {
            return;
        }

        setLoading(true);
        try {
            await resetAfterEmergency();
            setResponse(null);
            alert('Emergency reset completed. Engine is now STOPPED.');
        } catch (error) {
            console.error('Reset failed:', error);
            alert('Reset failed! Check console for details.');
        } finally {
            setLoading(false);
        }
    };

    if (response) {
        return (
            <div className="bg-red-900 border border-red-600 rounded-xl shadow-sm p-6 h-full">
                <div className="flex items-center space-x-3 mb-4">
                    <AlertOctagon className="h-8 w-8 text-red-400" />
                    <h3 className="text-xl font-bold text-white">Emergency Stop Executed</h3>
                </div>

                <div className="space-y-2 mb-4 text-white">
                    <p>✅ Engine Stopped: {response.engineStopped ? 'Yes' : 'No'}</p>
                    <p>✅ Orders Cancelled: {response.ordersCancelled ? 'Yes' : 'No'}</p>
                    <p>✅ Positions Squared Off: {response.positionsSquaredOff ? 'Yes' : 'No'}</p>
                    <p>✅ Risk Locked: {response.riskLocked ? 'Yes' : 'No'}</p>

                    {response.closedPositions.length > 0 && (
                        <div className="mt-4">
                            <p className="font-semibold mb-2">Closed Positions:</p>
                            <ul className="list-disc list-inside space-y-1">
                                {response.closedPositions.map((pos, idx) => (
                                    <li key={idx}>
                                        {pos.symbol}: ₹{pos.pnl.toFixed(2)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {response.errors.length > 0 && (
                        <div className="mt-4 bg-red-800 p-3 rounded">
                            <p className="font-semibold mb-2">Errors:</p>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                {response.errors.map((error, idx) => (
                                    <li key={idx}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleReset}
                    disabled={loading}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
                >
                    {loading ? 'Resetting...' : 'Reset Emergency State'}
                </button>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 border border-red-600 rounded-xl shadow-sm p-6 h-full flex flex-col">
            <div className="flex items-center space-x-3 mb-4">
                <Power className="h-7 w-7 text-red-500" />
                <h3 className="text-lg font-bold text-white tracking-tight">Emergency Kill Switch</h3>
            </div>

            <p className="text-gray-300 mb-4 text-sm">
                Immediately stops all trading, cancels pending orders, and squares off all positions.
                <span className="text-red-400 font-semibold"> USE WITH CAUTION.</span>
            </p>

            {!showConfirmation ? (
                <button
                    onClick={() => setShowConfirmation(true)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-colors"
                >
                    🚨 EMERGENCY STOP
                </button>
            ) : (
                <div className="space-y-3">
                    <div className="bg-red-900 p-4 rounded border border-red-600">
                        <p className="text-white font-bold mb-2">⚠️ CONFIRM EMERGENCY STOP</p>
                        <p className="text-gray-300 text-sm mb-3">
                            This will:
                            <br />• Stop the trading engine immediately
                            <br />• Cancel ALL pending orders
                            <br />• Square off ALL open positions
                            <br />• Lock the system until manual reset
                        </p>
                        <p className="text-red-400 text-sm font-semibold">
                            This action cannot be undone. Are you sure?
                        </p>
                    </div>

                    <div className="flex space-x-3">
                        <button
                            onClick={handleEmergencyStop}
                            disabled={loading}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50"
                        >
                            {loading ? 'STOPPING...' : 'YES, STOP NOW'}
                        </button>
                        <button
                            onClick={() => setShowConfirmation(false)}
                            disabled={loading}
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmergencyKillSwitch;
