import { useState, useEffect } from 'react';
import { Plus, Search, Eye, Activity, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Strategy, strategyService } from '../services/strategyService';
import StrategyDetailsModal from '../components/StrategyDetailsModal';
import { useError } from '../context/ErrorContext';
import { useLoading } from '../context/LoadingContext';
import { useSettings } from '../context/SettingsContext';
import { useTradingContext } from '../context/TradingContext';
import { strategyApi } from '../api/strategies';

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
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

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
            const backendStrategies = await strategyService.getAllStrategies(searchTerm || undefined);
            setStrategies(backendStrategies);
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

            // Get the original backend ID (UUID string)
            const originalId = (strategyData as any).originalId || strategyData.id;

            // Call backend engine API to start strategy
            try {
                await strategyApi.activateStrategy(originalId);
            } catch (backendErr) {
                console.warn('Backend engine start failed (may be paper-only mode):', backendErr);
            }

            // Also update local trading context
            const strategy = tradingContext.strategies.find(s =>
                s.id === originalId || s.name === strategyData.name
            );

            if (strategy) {
                const updatedStrategy = { ...strategy, status: 'ACTIVE' as const };
                tradingContext.updateStrategy(updatedStrategy);
            }

            showSuccess('Strategy started');
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

            // Get the original backend ID (UUID string)
            const originalId = (strategyData as any).originalId || strategyData.id;

            // Call backend engine API to stop strategy
            try {
                await strategyApi.deactivateStrategy(originalId);
            } catch (backendErr) {
                console.warn('Backend engine stop failed (may be paper-only mode):', backendErr);
            }

            // Also update local trading context
            const strategy = tradingContext.strategies.find(s =>
                s.id === originalId || s.name === strategyData.name
            );

            if (strategy) {
                const updatedStrategy = { ...strategy, status: 'STOPPED' as const };
                tradingContext.updateStrategy(updatedStrategy);
            }

            showSuccess('Strategy stopped');
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
            const strategyData = strategies.find(s => s.id === id);
            const originalId = (strategyData as any)?.originalId || id.toString();
            await strategyService.deleteStrategy(id, originalId);
            setConfirmDeleteId(null);
            showSuccess('Strategy deleted');
            await fetchStrategies();
            setGlobalLoading(false);
        } catch (error) {
            setGlobalLoading(false);
            setConfirmDeleteId(null);
            showError(error instanceof Error ? error.message : 'Failed to delete strategy. Running strategies must be stopped first.');
        }
    };

    const handleTestExecute = async (id: number) => {
        try {
            setGlobalLoading(true, 'Executing test trade...');
            const strategyData = strategies.find(s => s.id === id);
            if (!strategyData) {
                showError('Strategy not found');
                setGlobalLoading(false);
                return;
            }

            const originalId = (strategyData as any).originalId || strategyData.id;

            const response = await fetch(`http://localhost:3001/api/strategies/${originalId}/test-execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ closeImmediately: true }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to execute test trade');
            }
            
            const result = await response.json();

            showSuccess(`✅ Test trade executed! P&L: ₹${result.data.pnl.toFixed(2)} - Check Trades page!`);
            setGlobalLoading(false);
        } catch (error) {
            setGlobalLoading(false);
            showError(error instanceof Error ? error.message : 'Failed to execute test trade');
        }
    };

    const filteredStrategies = strategies.filter(strategy => {
        const matchesSearch = strategy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            strategy.symbol.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || strategy.status === filterStatus;
        const matchesInstrument = filterInstrument === 'All' || strategy.instrumentType === filterInstrument;

        return matchesSearch && matchesStatus && matchesInstrument;
    });

    const statusBadgeClass = (status: Strategy['status']) => {
        switch (status) {
            case 'RUNNING': return 'badge badge-green';
            case 'STOPPED': return 'badge badge-gray';
            case 'PAUSED': return 'badge badge-yellow';
            case 'ERROR': return 'badge badge-red';
            default: return 'badge badge-blue';
        }
    };

    const runningCount = strategies.filter(s => s.status === 'RUNNING' || (s.status as any) === 'ACTIVE').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Strategies</h1>
                    <p className="page-sub">
                        {strategies.length} {strategies.length === 1 ? 'strategy' : 'strategies'}
                        {runningCount > 0 && <> · <span className="text-emerald-600 font-medium">{runningCount} running</span></>}
                    </p>
                </div>
                <button onClick={() => navigate('/builder')} className="btn-primary">
                    <Plus className="h-4 w-4" />
                    New Strategy
                </button>
            </div>

            {/* Filters */}
            <div className="card p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search by name or symbol…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input pl-9"
                        />
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="input w-auto"
                    >
                        <option value="All">All Status</option>
                        <option value="CREATED">Created</option>
                        <option value="RUNNING">Running</option>
                        <option value="STOPPED">Stopped</option>
                        <option value="ERROR">Error</option>
                    </select>
                    <select
                        value={filterInstrument}
                        onChange={(e) => setFilterInstrument(e.target.value as any)}
                        className="input w-auto"
                    >
                        <option value="All">All Instruments</option>
                        <option value="OPTION">Options</option>
                        <option value="FUTURE">Futures</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card p-5 space-y-3">
                            <div className="skeleton h-4 w-3/5" />
                            <div className="skeleton h-3 w-2/5" />
                            <div className="skeleton h-3 w-full mt-4" />
                            <div className="skeleton h-8 w-full mt-2" />
                        </div>
                    ))}
                </div>
            ) : filteredStrategies.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Activity className="empty-icon" />
                        <p className="empty-title">
                            {strategies.length === 0 ? 'No strategies yet' : 'No strategies match your filters'}
                        </p>
                        <p className="empty-sub mb-4">
                            {strategies.length === 0
                                ? 'Build your first automated trading strategy'
                                : 'Try clearing filters'}
                        </p>
                        {strategies.length === 0 && (
                            <button onClick={() => navigate('/builder')} className="btn-primary btn-sm">
                                <Plus className="h-3.5 w-3.5" /> Create Strategy
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStrategies.map((strategy) => (
                        <div
                            key={strategy.id}
                            className="card p-5 hover:shadow-md transition-shadow flex flex-col"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-gray-900 text-sm truncate">{strategy.name}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        <span className="font-mono">{strategy.symbol}</span>
                                        {strategy.symbol && ' · '}{strategy.instrumentType}
                                        {' · '}{strategy.timeframe}
                                    </p>
                                </div>
                                <span className={`${statusBadgeClass(strategy.status)} ml-2 shrink-0`}>
                                    {strategy.status === 'RUNNING' && <span className="live-dot mr-1" />}
                                    {strategy.status}
                                </span>
                            </div>

                            {strategy.description && (
                                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{strategy.description}</p>
                            )}

                            <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-50 pt-3 mt-auto mb-3">
                                <span>{strategy.conditions.length} condition{strategy.conditions.length !== 1 ? 's' : ''}</span>
                                <span>{new Date(strategy.updatedAt).toLocaleDateString('en-IN')}</span>
                            </div>

                            {confirmDeleteId === strategy.id ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDeleteStrategy(strategy.id!)}
                                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                                    >
                                        Confirm Delete
                                    </button>
                                    <button
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSelectedStrategy(strategy)}
                                            className="btn-secondary flex-1 justify-center btn-sm"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                            View
                                        </button>
                                        <button
                                            onClick={() => handleTestExecute(strategy.id!)}
                                            className="btn-primary flex-1 justify-center btn-sm"
                                            title="Execute a test trade from this strategy"
                                        >
                                            Test Execute
                                        </button>
                                        <button
                                            onClick={() => setConfirmDeleteId(strategy.id!)}
                                            disabled={strategy.status === 'RUNNING'}
                                            title={strategy.status === 'RUNNING' ? 'Stop the strategy before deleting' : 'Delete strategy'}
                                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
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
