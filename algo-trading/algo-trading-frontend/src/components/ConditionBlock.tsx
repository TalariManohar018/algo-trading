import { X } from 'lucide-react';
import { IndicatorType, ConditionType, ConditionLogic } from '../types/strategy';

interface Condition {
    id: string;
    indicatorType: IndicatorType;
    conditionType: ConditionType;
    value: number;
    logic?: ConditionLogic;
    period?: number;
}

interface ConditionBlockProps {
    condition: Condition;
    showLogic: boolean;
    onUpdate: (id: string, field: keyof Condition, value: any) => void;
    onRemove: (id: string) => void;
}

const indicators: IndicatorType[] = ['EMA', 'SMA', 'RSI', 'MACD', 'VWAP', 'Price', 'Volume', 'ADX', 'Bollinger Bands'];
const conditionTypes: { value: ConditionType; label: string }[] = [
    { value: 'GREATER_THAN', label: '>' },
    { value: 'LESS_THAN', label: '<' },
    { value: 'GREATER_THAN_EQUAL', label: '>=' },
    { value: 'LESS_THAN_EQUAL', label: '<=' },
    { value: 'EQUALS', label: '=' },
    { value: 'CROSS_ABOVE', label: 'Crosses Above' },
    { value: 'CROSS_BELOW', label: 'Crosses Below' },
];

export default function ConditionBlock({ condition, showLogic, onUpdate, onRemove }: ConditionBlockProps) {
    const needsPeriod = ['EMA', 'SMA', 'RSI', 'ADX'].includes(condition.indicatorType);

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
                    value={condition.indicatorType}
                    onChange={(e) => onUpdate(condition.id, 'indicatorType', e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {indicators.map(ind => (
                        <option key={ind} value={ind}>{ind}</option>
                    ))}
                </select>

                {needsPeriod && (
                    <input
                        type="number"
                        value={condition.period || 14}
                        onChange={(e) => onUpdate(condition.id, 'period', parseInt(e.target.value) || 14)}
                        placeholder="Period"
                        min="1"
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                )}

                <select
                    value={condition.conditionType}
                    onChange={(e) => onUpdate(condition.id, 'conditionType', e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {conditionTypes.map(cond => (
                        <option key={cond.value} value={cond.value}>{cond.label}</option>
                    ))}
                </select>

                <input
                    type="number"
                    value={condition.value}
                    onChange={(e) => onUpdate(condition.id, 'value', parseFloat(e.target.value) || 0)}
                    placeholder="Value"
                    step="0.01"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                <button
                    onClick={() => onRemove(condition.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove condition"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}
