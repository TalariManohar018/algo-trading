import { X, Play, Square, Copy, Trash2, Info } from 'lucide-react';
import { Strategy } from '../services/strategyService';
import { useError } from '../context/ErrorContext';

interface StrategyDetailsModalProps {
    strategy: Strategy;
    onClose: () => void;
    onStart?: (id: number) => void;
    onStop?: (id: number) => void;
    onDuplicate?: (id: number) => void;
    onDelete?: (id: number) => void;
}

export default function StrategyDetailsModal({
    strategy,
    onClose,
    onDuplicate,
    onDelete
}: StrategyDetailsModalProps) {
    const { showSuccess } = useError();
    const isRunning = strategy.status === 'RUNNING';

    const handleDuplicate = () => {
        if (onDuplicate) {
            onDuplicate(strategy.id);
            showSuccess(`Strategy "${strategy.name}" duplicated successfully`);
            onClose();
        }
    };

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this strategy? This action cannot be undone.')) {
            if (onDelete) {
                onDelete(strategy.id);
                showSuccess(`Strategy "${strategy.name}" deleted successfully`);
                onClose();
            }
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RUNNING':
                return 'bg-green-100 text-green-700';
            case 'STOPPED':
                return 'bg-gray-100 text-gray-700';
            case 'PAUSED':
                return 'bg-yellow-100 text-yellow-700';
            case 'ERROR':
                return 'bg-red-100 text-red-700';
            default:
                return 'bg-blue-100 text-blue-700';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">{strategy.name}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Status & Basic Info */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(strategy.status)}`}>
                                {strategy.status}
                            </span>
                            <span className="text-sm text-gray-500">
                                Updated: {new Date(strategy.updatedAt).toLocaleString()}
                            </span>
                        </div>

                        <p className="text-gray-600">{strategy.description}</p>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Symbol</p>
                            <p className="font-semibold text-gray-900">{strategy.symbol}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Instrument Type</p>
                            <p className="font-semibold text-gray-900">{strategy.instrumentType}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Created</p>
                            <p className="font-semibold text-gray-900">
                                {new Date(strategy.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Conditions</p>
                            <p className="font-semibold text-gray-900">{strategy.conditions.length}</p>
                        </div>
                    </div>

                    {/* Parameters */}
                    {strategy.parameters && Object.keys(strategy.parameters).length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Parameters</h3>
                            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                {Object.entries(strategy.parameters).map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                        <span className="text-gray-600 capitalize">
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </span>
                                        <span className="font-semibold text-gray-900">
                                            {typeof value === 'number' && key.toLowerCase().includes('loss')
                                                ? `₹${value.toLocaleString()}`
                                                : value.toString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Conditions */}
                    {strategy.conditions.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Conditions</h3>
                            <div className="space-y-2">
                                {strategy.conditions.map((condition, index) => (
                                    <div key={condition.id || index} className="bg-blue-50 rounded-lg p-3">
                                        <div className="flex items-center space-x-2">
                                            <Info className="h-4 w-4 text-blue-600" />
                                            <span className="text-sm font-medium text-blue-900">
                                                {condition.type}
                                            </span>
                                        </div>
                                        {condition.indicator && (
                                            <p className="text-sm text-blue-700 mt-1 ml-6">
                                                {condition.indicator} {condition.operator?.replace('_', ' ')} {condition.value}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                    <div className="flex space-x-2">
                        <button
                            onClick={handleDuplicate}
                            className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <Copy className="h-4 w-4" />
                            <span>Duplicate</span>
                        </button>
                        <button
                            onClick={handleDelete}
                            className="flex items-center space-x-2 px-4 py-2 text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete</span>
                        </button>
                    </div>
                    <div>
                        {isRunning ? (
                            <button
                                disabled
                                className="flex items-center space-x-2 px-6 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                                title="Execution engine not enabled yet"
                            >
                                <Square className="h-4 w-4" />
                                <span>Stop Strategy</span>
                            </button>
                        ) : (
                            <button
                                disabled
                                className="flex items-center space-x-2 px-6 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                                title="Execution engine not enabled yet"
                            >
                                <Play className="h-4 w-4" />
                                <span>Start Strategy</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
