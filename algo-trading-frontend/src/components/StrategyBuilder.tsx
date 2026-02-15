import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Condition } from '../data/mockStrategies';
import ConditionBlock from './ConditionBlock';

export default function StrategyBuilder() {
    const [strategyName, setStrategyName] = useState('');
    const [instrument, setInstrument] = useState<'NIFTY' | 'BANKNIFTY'>('NIFTY');
    const [conditions, setConditions] = useState<Condition[]>([
        { id: '1', indicator: 'EMA', condition: '>', value: '50' }
    ]);

    const addCondition = () => {
        const newCondition: Condition = {
            id: Date.now().toString(),
            indicator: 'RSI',
            condition: '>',
            value: '50',
            logic: 'AND'
        };
        setConditions([...conditions, newCondition]);
    };

    const updateCondition = (id: string, field: keyof Condition, value: string) => {
        setConditions(conditions.map(c =>
            c.id === id ? { ...c, [field]: value } : c
        ));
    };

    const removeCondition = (id: string) => {
        if (conditions.length > 1) {
            setConditions(conditions.filter(c => c.id !== id));
        }
    };

    const handleSave = () => {
        console.log('Saving strategy:', { strategyName, instrument, conditions });
        alert('Strategy saved successfully!');
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Build Your Strategy</h2>

            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Strategy Name
                        </label>
                        <input
                            type="text"
                            value={strategyName}
                            onChange={(e) => setStrategyName(e.target.value)}
                            placeholder="My Awesome Strategy"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Instrument
                        </label>
                        <select
                            value={instrument}
                            onChange={(e) => setInstrument(e.target.value as 'NIFTY' | 'BANKNIFTY')}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="NIFTY">NIFTY</option>
                            <option value="BANKNIFTY">BANKNIFTY</option>
                        </select>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Entry Conditions</h3>
                        <button
                            onClick={addCondition}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Add Condition</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {conditions.map((condition, index) => (
                            <ConditionBlock
                                key={condition.id}
                                condition={condition}
                                showLogic={index > 0}
                                onUpdate={updateCondition}
                                onRemove={removeCondition}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Save Strategy
                    </button>
                </div>
            </div>
        </div>
    );
}
