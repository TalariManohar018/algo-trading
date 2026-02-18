import { useTradingContext } from '../context/TradingContext';

export const EngineControl = () => {
    const { engineStatus, startEngine, stopEngine, strategies } = useTradingContext();

    const handleStart = async () => {
        if (strategies.length === 0) {
            alert('⚠️ No strategies loaded. Please activate at least one strategy before starting the engine.');
            return;
        }
        await startEngine();
    };

    const handleStop = async () => {
        await stopEngine();
    };

    const statusConfig = {
        STOPPED: { color: 'bg-gray-500', text: 'Stopped', icon: '⏸' },
        RUNNING: { color: 'bg-green-500', text: 'Running', icon: '▶' },
        PAUSED: { color: 'bg-yellow-500', text: 'Paused', icon: '⏸' },
        LOCKED: { color: 'bg-red-500', text: 'Locked', icon: '🔒' },
    };

    const config = statusConfig[engineStatus];

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">Trading Engine</h3>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white ${config.color}`}>
                            <span>{config.icon}</span>
                            {config.text}
                        </span>
                        {engineStatus === 'RUNNING' && (
                            <span className="text-sm text-gray-500">
                                {strategies.length} {strategies.length === 1 ? 'strategy' : 'strategies'} active
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    {engineStatus === 'STOPPED' ? (
                        <button
                            onClick={handleStart}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                        >
                            Start Engine
                        </button>
                    ) : (
                        <button
                            onClick={handleStop}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                            disabled={engineStatus === 'LOCKED'}
                        >
                            Stop Engine
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
