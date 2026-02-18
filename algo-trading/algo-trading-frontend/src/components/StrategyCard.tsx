import { useState } from 'react';
import { strategyApi } from '../api/strategies';
import { Strategy } from '../services/strategyService';
import { Play, Square, Trash2 } from 'lucide-react';

interface StrategyCardProps {
    strategy: Strategy;
    onUpdate?: () => void;
}

export default function StrategyCard({ strategy, onUpdate }: StrategyCardProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const isActive = strategy.status === 'RUNNING';

    const handleToggleStatus = async () => {
        setIsUpdating(true);
        try {
            if (isActive) {
                await strategyApi.deactivateStrategy(strategy.id!);
            } else {
                await strategyApi.activateStrategy(strategy.id!);
            }
            onUpdate?.();
        } catch (error) {
            console.error('Error toggling strategy status:', error);
            alert('Failed to update strategy status');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${strategy.name}"?`)) return;

        try {
            await strategyApi.deleteStrategy(strategy.id!);
            onUpdate?.();
        } catch (error) {
            console.error('Error deleting strategy:', error);
            alert('Failed to delete strategy');
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">{strategy.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{strategy.symbol} • {strategy.instrumentType}</p>
                </div>

                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                    }`}>
                    {isActive ? 'Active' : 'Inactive'}
                </div>
            </div>

            {strategy.description && (
                <p className="text-sm text-gray-600 mb-4">{strategy.description}</p>
            )}

            <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Conditions</span>
                    <span className="font-semibold text-gray-900">{strategy.conditions.length}</span>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Created</span>
                    <span className="text-sm text-gray-900">
                        {strategy.createdAt ? new Date(strategy.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                </div>
            </div>

            <div className="flex space-x-2">
                <button
                    onClick={handleToggleStatus}
                    disabled={isUpdating}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${isActive
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                        } disabled:opacity-50`}
                >
                    {isActive ? (
                        <>
                            <Square className="h-4 w-4" />
                            <span>Deactivate</span>
                        </>
                    ) : (
                        <>
                            <Play className="h-4 w-4" />
                            <span>Activate</span>
                        </>
                    )}
                </button>

                <button
                    onClick={handleDelete}
                    className="px-3 py-2 rounded-lg font-medium transition-colors bg-gray-50 text-gray-700 hover:bg-gray-100"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
