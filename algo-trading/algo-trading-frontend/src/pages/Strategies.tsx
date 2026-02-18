import { useState, useEffect } from 'react';
import { Plus, Search, Eye, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Strategy, strategyService } from '../services/strategyService';
import StrategyDetailsModal from '../components/StrategyDetailsModal';
import { useError } from '../context/ErrorContext';
import { useLoading } from '../context/LoadingContext';
import { useSettings } from '../context/SettingsContext';
import { useTradingContext } from '../context/TradingContext';

export default function Strategies() {
    const navigate = useNavigate();
    const { showError, showSuccess } = useError();
    const { setLoading: setGlobalLoading } = useLoading();
    const { settings } = useSettings();
    const tradingContext = useTradingContext();
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | 'CREATED' | 'RUNNING' | 'STOPPED' | 'ERROR'>('All');
    const [filterInstrument, setFilterInstrument] = useState<'All' | 'OPTION' | 'FUTURE'>('All');
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

    useEffect(() => {
        fetchStrategies();
    }, []);

    // Sync strategies when TradingContext strategies change
    useEffect(() => {
        fetchStrategies();
    }, [tradingContext.strategies]);

    const fetchStrategies = async () => {
        try {
            setLoading(true);
            // Use paper trading strategies from context
            const paperStrategies = tradingContext.strategies.map((s, index) => {
                // Extract numeric ID from string ID like "STR-DEMO-1" or "STR-1"
                const idParts = s.id.split('-');
                const numericId = parseInt(idParts[idParts.length - 1]) || (index + 1);

                // Combine entry and exit conditions for UI
                const entryConditions = (s.entryConditions || []).map((c, i) => ({
                    id: i,
                    type: c.indicatorType,
                    indicator: c.indicatorType,
                    operator: c.conditionType,
                    value: c.value,
                }));

                const exitConditions = (s.exitConditions || []).map((c, i) => ({
                    id: entryConditions.length + i,
                    type: c.indicatorType,
                    indicator: c.indicatorType,
                    operator: c.conditionType,
                    value: c.value,
                }));

                return {
                    id: numericId,
                    name: s.name || 'Unnamed Strategy',
                    description: s.description || '',
                    symbol: s.symbol || '',
                    instrumentType: s.instrumentType || 'OPTION',
                    timeframe: s.timeframe || '1m',
                    status: s.status || 'CREATED',
                    createdAt: s.createdAt || new Date(),
                    updatedAt: s.updatedAt || new Date(),
                    conditions: [...entryConditions, ...exitConditions],
                    originalId: s.id, // Keep original ID for lookups
                };
            });
            setStrategies(paperStrategies as any);
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Failed to fetch strategies');
        } finally {
            setLoading(false);
        }
    };

    const handleStartStrategy = async (id: number) => {
        try {
            // Check if multiple strategies are allowed
            const runningCount = strategies.filter(s =>
                s.status === 'RUNNING' || (s.status as any) === 'ACTIVE'
            ).length;
            if (!settings.allowMultipleStrategies && runningCount > 0) {
                showError('Only one strategy can run at a time. Stop other strategies first or enable "Allow Multiple Strategies" in Settings.');
                return;
            }

            setGlobalLoading(true, 'Starting strategy...');

            // Find the strategy by numeric ID
            const strategyData = strategies.find(s => s.id === id);
            if (!strategyData) {
                showError('Strategy not found');
                setGlobalLoading(false);
                return;
            }

            // Find in trading context using originalId or name
            const originalId = (strategyData as any).originalId;
            const strategy = tradingContext.strategies.find(s =>
                s.id === originalId || s.name === strategyData.name
            );

            if (strategy) {
                const updatedStrategy = { ...strategy, status: 'ACTIVE' as const };
                tradingContext.updateStrategy(updatedStrategy);
                showSuccess('Strategy started in paper trading mode');
            } else {
                showError('Strategy not found in trading context');
            }

            await fetchStrategies();
            setGlobalLoading(false);
        } catch (error) {
            setGlobalLoading(false);
            showError(error instanceof Error ? error.message : 'Failed to start strategy');
        }
    };

    const handleStopStrategy = async (id: number) => {
        try {
            setGlobalLoading(true, 'Stopping strategy...');

            // Find the strategy by numeric ID
            const strategyData = strategies.find(s => s.id === id);
            if (!strategyData) {
                showError('Strategy not found');
                setGlobalLoading(false);
                return;
            }

            // Find in trading context using originalId or name
            const originalId = (strategyData as any).originalId;
            const strategy = tradingContext.strategies.find(s =>
                s.id === originalId || s.name === strategyData.name
            );

            if (strategy) {
                const updatedStrategy = { ...strategy, status: 'STOPPED' as const };
                tradingContext.updateStrategy(updatedStrategy);
                showSuccess('Strategy stopped');
            } else {
                showError('Strategy not found in trading context');
            }

            await fetchStrategies();
            setGlobalLoading(false);
        } catch (error) {
            setGlobalLoading(false);
            showError(error instanceof Error ? error.message : 'Failed to stop strategy');
        }
    };

    const handleDuplicateStrategy = async (id: number) => {
        try {
            setGlobalLoading(true, 'Duplicating strategy...');
            await strategyService.duplicateStrategy(id);
            await fetchStrategies();
            setGlobalLoading(false);
        } catch (error) {
            setGlobalLoading(false);
            showError(error instanceof Error ? error.message : 'Failed to duplicate strategy');
        }
    };

    const handleDeleteStrategy = async (id: number) => {
        try {
            setGlobalLoading(true, 'Deleting strategy...');
            await strategyService.deleteStrategy(id);
            await fetchStrategies();
            setGlobalLoading(false);
        } catch (error) {
            setGlobalLoading(false);
            showError(error instanceof Error ? error.message : 'Failed to delete strategy');
        }
    };

    const filteredStrategies = strategies.filter(strategy => {
        const matchesSearch = strategy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            strategy.symbol.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || strategy.status === filterStatus;
        const matchesInstrument = filterInstrument === 'All' || strategy.instrumentType === filterInstrument;

        return matchesSearch && matchesStatus && matchesInstrument;
    });

    const getStatusColor = (status: Strategy['status']) => {
        switch (status) {
            case 'RUNNING':
                return 'bg-green-100 text-green-700';
            case 'STOPPED':
                return 'bg-gray-100 text-gray-700';
            case 'ERROR':
                return 'bg-red-100 text-red-700';
            default:
                return 'bg-blue-100 text-blue-700';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Strategies</h1>
                    <p className="text-gray-600 mt-1">
                        Manage and monitor your trading strategies
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {strategies.length} {strategies.length === 1 ? 'strategy' : 'strategies'}
                        </span>
                    </p>
                </div>

                <button
                    onClick={() => navigate('/builder')}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="h-5 w-5" />
                    <span>New Strategy</span>
                </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search strategies..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="All">All Status</option>
                        <option value="CREATED">Created</option>
                        <option value="RUNNING">Running</option>
                        <option value="STOPPED">Stopped</option>
                        <option value="ERROR">Error</option>
                    </select>

                    <select
                        value={filterInstrument}
                        onChange={(e) => setFilterInstrument(e.target.value as 'All' | 'OPTION' | 'FUTURE')}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="All">All Instruments</option>
                        <option value="OPTION">Options</option>
                        <option value="FUTURE">Futures</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-gray-500">Loading strategies...</div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredStrategies.map((strategy) => (
                            <div
                                key={strategy.id}
                                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">{strategy.name}</h3>
                                        <p className="text-sm text-gray-500 mt-1">{strategy.symbol} • {strategy.instrumentType}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(strategy.status)}`}>
                                        {strategy.status}
                                    </span>
                                </div>

                                {strategy.description && (
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{strategy.description}</p>
                                )}

                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Conditions</span>
                                        <span className="font-semibold text-gray-900">{strategy.conditions.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Updated</span>
                                        <span className="text-gray-900">{new Date(strategy.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedStrategy(strategy)}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <Eye className="h-4 w-4" />
                                    <span>View Details</span>
                                </button>
                            </div>
                        ))}
                    </div>

                    {filteredStrategies.length === 0 && !loading && (
                        <div className="text-center py-16">
                            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <Activity className="h-12 w-12 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {strategies.length === 0 ? 'No strategies yet' : 'No strategies found'}
                            </h3>
                            <p className="text-gray-500 mb-6">
                                {strategies.length === 0
                                    ? 'Create your first strategy to get started with automated trading'
                                    : 'Try adjusting your filters to see more results'}
                            </p>
                            {strategies.length === 0 && (
                                <button
                                    onClick={() => navigate('/builder')}
                                    className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Plus className="h-5 w-5" />
                                    <span>Create Your First Strategy</span>
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            {selectedStrategy && (
                <StrategyDetailsModal
                    strategy={selectedStrategy}
                    onClose={() => setSelectedStrategy(null)}
                    onStart={handleStartStrategy}
                    onStop={handleStopStrategy}
                    onDuplicate={handleDuplicateStrategy}
                    onDelete={handleDeleteStrategy}
                />
            )}
        </div>
    );
}
