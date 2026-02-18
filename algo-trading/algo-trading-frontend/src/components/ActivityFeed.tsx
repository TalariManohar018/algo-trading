import { useTradingContext } from '../context/TradingContext';
import { ActivityEvent } from '../services/paperTradingEngine';

export default function ActivityFeed() {
    const { activityLog } = useTradingContext();

    const getEventIcon = (type: ActivityEvent['type']) => {
        switch (type) {
            case 'CANDLE': return '📊';
            case 'SIGNAL': return '🔔';
            case 'ORDER': return '📝';
            case 'FILL': return '✅';
            case 'POSITION': return '📍';
            case 'EXIT': return '🚪';
            case 'ALERT': return '⚠️';
            case 'ERROR': return '❌';
            default: return '·';
        }
    };

    const getEventColor = (type: ActivityEvent['type']) => {
        switch (type) {
            case 'SIGNAL': return 'text-blue-600';
            case 'ORDER': return 'text-purple-600';
            case 'FILL': return 'text-green-600';
            case 'POSITION': return 'text-indigo-600';
            case 'EXIT': return 'text-orange-600';
            case 'ALERT': return 'text-yellow-600';
            case 'ERROR': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    const formatTime = (timestamp: Date) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Activity Feed</h3>
                <span className="text-sm text-gray-500">Last {activityLog.length} events</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
                {activityLog.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <p>No activity yet. Start the engine to begin.</p>
                    </div>
                ) : (
                    activityLog.map((event, index) => (
                        <div
                            key={`${event.timestamp}-${index}`}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <span className="text-2xl">{getEventIcon(event.type)}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`font-medium ${getEventColor(event.type)}`}>
                                        {event.type}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {formatTime(event.timestamp)}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700 mt-1">{event.message}</p>
                                {event.data && (
                                    <p className="text-xs text-gray-500 mt-1 font-mono">
                                        {JSON.stringify(event.data, null, 0)}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
