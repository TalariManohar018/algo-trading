import { X } from 'lucide-react';
import { Condition } from '../data/mockStrategies';

interface ConditionBlockProps {
    condition: Condition;
    showLogic: boolean;
    onUpdate: (id: string, field: keyof Condition, value: string) => void;
    onRemove: (id: string) => void;
}

const indicators = ['EMA', 'RSI', 'VWAP', 'Price', 'Volume', 'ADX', 'MACD', 'Bollinger Bands'];
const conditionTypes = ['>', '<', '>=', '<=', '=', 'Crosses Above', 'Crosses Below'];

export default function ConditionBlock({ condition, showLogic, onUpdate, onRemove }: ConditionBlockProps) {
    return (
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
                {showLogic && (
                    <select
                        value={condition.logic}
                        onChange={(e) => onUpdate(condition.id, 'logic', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white font-semibold text-blue-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                    </select>
                )}

                <select
                    value={condition.indicator}
                    onChange={(e) => onUpdate(condition.id, 'indicator', e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {indicators.map(ind => (
                        <option key={ind} value={ind}>{ind}</option>
                    ))}
                </select>

                <select
                    value={condition.condition}
                    onChange={(e) => onUpdate(condition.id, 'condition', e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {conditionTypes.map(cond => (
                        <option key={cond} value={cond}>{cond}</option>
                    ))}
                </select>

                <input
                    type="text"
                    value={condition.value}
                    onChange={(e) => onUpdate(condition.id, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                <button
                    onClick={() => onRemove(condition.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}
