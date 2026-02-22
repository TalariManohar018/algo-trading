import { useState } from 'react';
import { Plus, Eye, AlertCircle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ConditionBlock from './ConditionBlock';
import { useError } from '../context/ErrorContext';
import { useLoading } from '../context/LoadingContext';
import { ExecutableStrategy, StrategyCondition, TimeFrame, OrderType, ProductType } from '../types/strategy';
import { strategyValidator } from '../services/strategyValidator';
import { strategyApi } from '../api/strategies';

interface BuilderCondition extends StrategyCondition {
    id: string;
}

export default function StrategyBuilder() {
    const navigate = useNavigate();
    const { showError, showSuccess } = useError();
    const { setLoading: setGlobalLoading } = useLoading();

    // Basic Info
    const [strategyName, setStrategyName] = useState('');
    const [description, setDescription] = useState('');
    const [symbol, setSymbol] = useState('NIFTY');
    const [instrumentType, setInstrumentType] = useState<'OPTION' | 'FUTURE'>('FUTURE');

    // Trading Parameters
    const [timeframe, setTimeframe] = useState<TimeFrame>('FIVE_MINUTES');
    const [quantity, setQuantity] = useState<number>(1);
    const [orderType, setOrderType] = useState<OrderType>('MARKET');
    const [productType, setProductType] = useState<ProductType>('MIS');
    const [maxTradesPerDay, setMaxTradesPerDay] = useState<number>(5);

    // Trading Window
    const [startTime, setStartTime] = useState('09:15');
    const [endTime, setEndTime] = useState('15:15');
    const [squareOffTime, setSquareOffTime] = useState('15:20');

    // Risk Config
    const [maxLossPerTrade, setMaxLossPerTrade] = useState<number>(1000);
    const [maxProfitTarget, setMaxProfitTarget] = useState<number>(2000);
    const [stopLossPercent, setStopLossPercent] = useState<number>(2);
    const [takeProfitPercent, setTakeProfitPercent] = useState<number>(5);

    // Conditions
    const [entryConditions, setEntryConditions] = useState<BuilderCondition[]>([
        { id: '1', indicatorType: 'RSI', conditionType: 'LESS_THAN', value: 30, period: 14 }
    ]);
    const [exitConditions, setExitConditions] = useState<BuilderCondition[]>([
        { id: '2', indicatorType: 'RSI', conditionType: 'GREATER_THAN', value: 70, period: 14 }
    ]);

    // UI State
    const [showJsonPreview, setShowJsonPreview] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const addEntryCondition = () => {
        const newCondition: BuilderCondition = {
            id: `entry-${Date.now()}`,
            indicatorType: 'RSI',
            conditionType: 'GREATER_THAN',
            value: 50,
            period: 14,
            logic: 'AND'
        };
        setEntryConditions([...entryConditions, newCondition]);
    };

    const addExitCondition = () => {
        const newCondition: BuilderCondition = {
            id: `exit-${Date.now()}`,
            indicatorType: 'RSI',
            conditionType: 'LESS_THAN',
            value: 50,
            period: 14,
            logic: 'AND'
        };
        setExitConditions([...exitConditions, newCondition]);
    };

    const updateEntryCondition = (id: string, field: keyof BuilderCondition, value: any) => {
        setEntryConditions(entryConditions.map(c =>
            c.id === id ? { ...c, [field]: value } : c
        ));
    };

    const updateExitCondition = (id: string, field: keyof BuilderCondition, value: any) => {
        setExitConditions(exitConditions.map(c =>
            c.id === id ? { ...c, [field]: value } : c
        ));
    };

    const removeEntryCondition = (id: string) => {
        if (entryConditions.length > 1) {
            setEntryConditions(entryConditions.filter(c => c.id !== id));
        }
    };

    const removeExitCondition = (id: string) => {
        if (exitConditions.length > 1) {
            setExitConditions(exitConditions.filter(c => c.id !== id));
        }
    };

    const buildStrategy = (): Partial<ExecutableStrategy> => {
        return {
            id: `STR-${Date.now()}`,
            name: strategyName,
            description,
            symbol,
            instrumentType,
            timeframe,
            quantity,
            orderType,
            productType,
            entryConditions: entryConditions.map(c => ({
                id: c.id,
                indicatorType: c.indicatorType,
                conditionType: c.conditionType,
                value: c.value,
                logic: c.logic,
                period: c.period
            })),
            exitConditions: exitConditions.map(c => ({
                id: c.id,
                indicatorType: c.indicatorType,
                conditionType: c.conditionType,
                value: c.value,
                logic: c.logic,
                period: c.period
            })),
            maxTradesPerDay,
            tradingWindow: {
                startTime,
                endTime
            },
            squareOffTime,
            riskConfig: {
                maxLossPerTrade,
                maxProfitTarget,
                stopLossPercent,
                takeProfitPercent
            },
            status: 'CREATED',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    };

    const validateStrategy = () => {
        const strategy = buildStrategy();
        const result = strategyValidator.validateStrategy(strategy);
        setValidationErrors(result.errors);
        setValidationWarnings(result.warnings);
        return result.valid;
    };

    const handleSave = async () => {
        if (!validateStrategy()) {
            showError('Please fix validation errors before saving');
            return;
        }

        setIsSaving(true);
        setGlobalLoading(true, 'Creating strategy...');

        try {
            const strategy = buildStrategy();

            // Call backend API to create strategy
            await strategyApi.createStrategy(strategy);

            setGlobalLoading(false);
            showSuccess('Strategy created successfully!');
            navigate('/strategies');
        } catch (error) {
            setGlobalLoading(false);
            showError(error instanceof Error ? error.message : 'Failed to create strategy');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Build Executable Strategy</h2>
                <button
                    onClick={() => setShowJsonPreview(!showJsonPreview)}
                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <Eye className="h-4 w-4" />
                    <span>{showJsonPreview ? 'Hide' : 'Preview'} JSON</span>
                </button>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-red-900 mb-2">Validation Errors</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                                {validationErrors.map((error, idx) => (
                                    <li key={idx}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Warnings */}
            {validationWarnings.length > 0 && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-yellow-900 mb-2">Warnings</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                                {validationWarnings.map((warning, idx) => (
                                    <li key={idx}>{warning}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* JSON Preview */}
            {showJsonPreview && (
                <div className="mb-6 bg-gray-900 text-green-400 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-xs font-mono">{JSON.stringify(buildStrategy(), null, 2)}</pre>
                </div>
            )}

            <div className="space-y-6">
                {/* Basic Info */}
                <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Strategy Name *
                            </label>
                            <input
                                type="text"
                                value={strategyName}
                                onChange={(e) => setStrategyName(e.target.value)}
                                placeholder="EMA Crossover Strategy"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Symbol *
                            </label>
                            <input
                                type="text"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                placeholder="NIFTY"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Instrument Type *
                            </label>
                            <select
                                value={instrumentType}
                                onChange={(e) => setInstrumentType(e.target.value as 'OPTION' | 'FUTURE')}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="FUTURE">Future</option>
                                <option value="OPTION">Option</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Timeframe *
                            </label>
                            <select
                                value={timeframe}
                                onChange={(e) => setTimeframe(e.target.value as TimeFrame)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="ONE_MINUTE">1 Minute</option>
                                <option value="FIVE_MINUTES">5 Minutes</option>
                                <option value="FIFTEEN_MINUTES">15 Minutes</option>
                                <option value="THIRTY_MINUTES">30 Minutes</option>
                                <option value="ONE_HOUR">1 Hour</option>
                                <option value="ONE_DAY">1 Day</option>
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Strategy description and notes"
                                rows={2}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Trading Parameters */}
                <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Trading Parameters</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Quantity *
                            </label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value ? parseInt(e.target.value) : 1)}
                                min="1"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Order Type *
                            </label>
                            <select
                                value={orderType}
                                onChange={(e) => setOrderType(e.target.value as OrderType)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="MARKET">Market</option>
                                <option value="LIMIT">Limit</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Product Type *
                            </label>
                            <select
                                value={productType}
                                onChange={(e) => setProductType(e.target.value as ProductType)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="MIS">MIS (Intraday)</option>
                                <option value="NRML">NRML (Delivery)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Max Trades Per Day *
                            </label>
                            <input
                                type="number"
                                value={maxTradesPerDay}
                                onChange={(e) => setMaxTradesPerDay(e.target.value ? parseInt(e.target.value) : 1)}
                                min="1"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Trading Window */}
                <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Trading Window</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Start Time *
                            </label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                End Time *
                            </label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Square Off Time *
                            </label>
                            <input
                                type="time"
                                value={squareOffTime}
                                onChange={(e) => setSquareOffTime(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Risk Configuration */}
                <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Management</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Max Loss Per Trade (₹) *
                            </label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={maxLossPerTrade}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        setMaxLossPerTrade(val === '' || val === '.' ? 0 : parseFloat(val) || 0);
                                    }
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Max Profit Target (₹)
                            </label>
                            <input
                                type="number"
                                value={maxProfitTarget}
                                onChange={(e) => setMaxProfitTarget(e.target.value ? parseFloat(e.target.value) : 0)}
                                min="0"
                                step="any"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Stop Loss (%)
                            </label>
                            <input
                                type="number"
                                value={stopLossPercent}
                                onChange={(e) => setStopLossPercent(e.target.value ? parseFloat(e.target.value) : 0)}
                                min="0"
                                step="any"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Take Profit (%)
                            </label>
                            <input
                                type="number"
                                value={takeProfitPercent}
                                onChange={(e) => setTakeProfitPercent(e.target.value ? parseFloat(e.target.value) : 0)}
                                min="0"
                                step="any"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Entry Conditions */}
                <div className="border-b border-gray-200 pb-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Entry Conditions *</h3>
                        <button
                            onClick={addEntryCondition}
                            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Add Entry</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {entryConditions.map((condition, index) => (
                            <ConditionBlock
                                key={condition.id}
                                condition={condition}
                                showLogic={index > 0}
                                onUpdate={updateEntryCondition}
                                onRemove={removeEntryCondition}
                            />
                        ))}
                    </div>
                </div>

                {/* Exit Conditions */}
                <div className="pb-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Exit Conditions</h3>
                        <button
                            onClick={addExitCondition}
                            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Add Exit</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {exitConditions.map((condition, index) => (
                            <ConditionBlock
                                key={condition.id}
                                condition={condition}
                                showLogic={index > 0}
                                onUpdate={updateExitCondition}
                                onRemove={removeExitCondition}
                            />
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <button
                        onClick={() => validateStrategy()}
                        className="flex items-center space-x-2 px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                        <CheckCircle className="h-4 w-4" />
                        <span>Validate</span>
                    </button>

                    <div className="flex space-x-3">
                        <button
                            onClick={() => navigate('/strategies')}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || validationErrors.length > 0}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Saving...' : 'Save Strategy'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
