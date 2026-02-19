import { Play, Square, Activity, Clock } from 'lucide-react';
import { Strategy } from '../services/strategyService';
import { useSettings } from '../context/SettingsContext';

interface RunningStrategiesProps {
    strategies: Strategy[];
    onStart: (id: number) => Promise<void>;
    onStop: (id: number) => Promise<void>;
    isRiskBreached?: boolean;
}

export default function RunningStrategies({
    strategies,
    isRiskBreached = false
}: RunningStrategiesProps) {
    const { settings } = useSettings();
    const runningStrategies = strategies.filter(s => s.status === 'RUNNING');

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RUNNING': return 'bg-green-100 text-green-700 border-green-200';
            case 'STOPPED': return 'bg-gray-100 text-gray-700 border-gray-200';
            case 'ERROR': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'RUNNING': return <Play className="h-3 w-3" />;
            case 'STOPPED': return <Square className="h-3 w-3" />;
            default: return <Activity className="h-3 w-3" />;
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Running Strategies</h3>
                <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1">
                        <div className={`h-2 w-2 rounded-full ${runningStrategies.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                            }`}></div>
                        <span className="text-xs text-gray-500">
                            {runningStrategies.length} Active
                        </span>
                    </div>
                </div>
            </div>

            {strategies.length > 0 ? (
                <div className="space-y-3">
                    {strategies.map((strategy) => {
                        const isRunning = strategy.status === 'RUNNING';

                        return (
                            <div
                                key={strategy.id}
                                className={`p-4 rounded-lg border-2 transition-all ${isRunning ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <h4 className="font-semibold text-gray-900">{strategy.name}</h4>
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(strategy.status)}`}>
                                                <div className="flex items-center space-x-1">
                                                    {getStatusIcon(strategy.status)}
                                                    <span>{strategy.status}</span>
                                                </div>
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="text-gray-500">Instrument:</span>
                                                <span className="ml-1 font-medium text-gray-900">{strategy.symbol}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Type:</span>
                                                <span className="ml-1 font-medium text-gray-900">{strategy.instrumentType}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Mode:</span>
                                                <span className={`ml-1 font-semibold ${settings.tradingMode === 'PAPER' ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {settings.tradingMode}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Last Update:</span>
                                                <span className="ml-1 font-medium text-gray-900">
                                                    {new Date(strategy.updatedAt).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        </div>

                                        {strategy.status === 'RUNNING' && (
                                            <div className="mt-2 flex items-center space-x-1 text-xs text-green-600">
                                                <Clock className="h-3 w-3" />
                                                <span>Monitoring market conditions...</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="ml-4">
                                        {isRunning ? (
                                            <button
                                                disabled
                                                className="flex items-center space-x-2 px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed text-sm font-medium"
                                                title="Execution engine not enabled yet"
                                            >
                                                <Square className="h-4 w-4" />
                                                <span>Stop</span>
                                            </button>
                                        ) : (
                                            <button
                                                disabled
                                                className="flex items-center space-x-2 px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed text-sm font-medium"
                                                title="Execution engine not enabled yet"
                                            >
                                                <Play className="h-4 w-4" />
                                                <span>Start</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm mb-2">No strategies created yet</p>
                    <p className="text-gray-400 text-xs">Create a strategy to start trading</p>
                </div>
            )}

            {isRiskBreached && strategies.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-800 font-medium">
                        ⚠️ Risk limits breached - Strategy execution disabled
                    </p>
                </div>
            )}
        </div>
    );
}
