import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, BarChart3, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

type SortKey = 'pnl' | 'executedAt' | 'entryPrice' | 'quantity' | 'symbol';
type SortDir = 'asc' | 'desc';

interface BackendTrade {
    id: string;
    userId: string;
    strategyId: string | null;
    strategyName?: string;
    symbol: string;
    side: string;
    quantity: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    entryTime: string;
    exitTime: string;
    duration: number;
}

interface Trade {
    id: string;
    strategyId: string;
    strategyName: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    executedAt: Date;
}

function PnlCell({ pnl, entryPrice, qty }: { pnl: number; entryPrice: number; qty: number }) {
    const pct = entryPrice && qty ? ((pnl / (entryPrice * qty)) * 100) : 0;
    const cls = pnl > 0 ? 'pnl-pos' : pnl < 0 ? 'pnl-neg' : 'pnl-zero';
    return (
        <div>
            <div className={cls}>{pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}</div>
            <div className={`text-xs mt-0.5 ${pnl > 0 ? 'text-emerald-500' : pnl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
            </div>
        </div>
    );
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
    if (col !== sortKey) return <ArrowUpDown className="h-3 w-3 opacity-30 ml-1 inline" />;
    return sortDir === 'asc'
        ? <ChevronUp className="h-3 w-3 ml-1 inline text-blue-500" />
        : <ChevronDown className="h-3 w-3 ml-1 inline text-blue-500" />;
}

export default function Trades() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterSide, setFilterSide] = useState<'All' | 'BUY' | 'SELL'>('All');
    const [sortKey, setSortKey] = useState<SortKey>('executedAt');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    useEffect(() => {
        fetchTrades();
    }, []);

    const fetchTrades = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/trades', {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch trades');
            const result = await response.json();
            const backendTrades: BackendTrade[] = result.data?.trades || result.data || [];
            
            // Transform backend trades to frontend format
            const transformedTrades: Trade[] = backendTrades.map(t => ({
                id: t.id,
                strategyId: t.strategyId || 'manual',
                strategyName: t.strategyName || 'Manual Trade',
                symbol: t.symbol,
                side: t.side as 'BUY' | 'SELL',
                quantity: t.quantity,
                entryPrice: t.entryPrice,
                exitPrice: t.exitPrice,
                pnl: t.pnl,
                executedAt: new Date(t.exitTime),
            }));
            
            setTrades(transformedTrades);
        } catch (error) {
            console.error('Error fetching trades:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateDemoTrades = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:3001/api/demo/generate-trades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ count: 10 }),
            });
            if (!response.ok) throw new Error('Failed to generate demo trades');
            await fetchTrades();
            alert('10 demo trades generated!');
        } catch (error) {
            console.error('Error generating demo trades:', error);
            alert('Failed to generate demo trades');
        } finally {
            setLoading(false);
        }
    };

    const clearAllData = async () => {
        if (!confirm('Clear all trades and positions? This cannot be undone.')) return;
        try {
            setLoading(true);
            const response = await fetch('http://localhost:3001/api/demo/clear-all', {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to clear data');
            await fetchTrades();
            alert('All data cleared!');
        } catch (error) {
            console.error('Error clearing data:', error);
            alert('Failed to clear data');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const filteredTrades = useMemo(() => {
        let filtered = trades.filter(t =>
            filterSide === 'All' || t.side === filterSide
        );
        filtered = [...filtered].sort((a, b) => {
            let av: any, bv: any;
            switch (sortKey) {
                case 'pnl': av = a.pnl; bv = b.pnl; break;
                case 'entryPrice': av = a.entryPrice; bv = b.entryPrice; break;
                case 'quantity': av = a.quantity; bv = b.quantity; break;
                case 'symbol': av = a.symbol; bv = b.symbol; break;
                default: av = new Date(a.executedAt).getTime(); bv = new Date(b.executedAt).getTime();
            }
            return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
        });
        return filtered;
    }, [trades, filterSide, sortKey, sortDir]);

    const totalPnL = filteredTrades.reduce((s, t) => s + t.pnl, 0);
    const winning = filteredTrades.filter(t => t.pnl > 0).length;
    const losing = filteredTrades.filter(t => t.pnl < 0).length;
    const winRate = filteredTrades.length > 0 ? (winning / filteredTrades.length) * 100 : 0;
    const avgPnl = filteredTrades.length > 0 ? totalPnL / filteredTrades.length : 0;

    const SortTh = ({ k, label }: { k: SortKey; label: string }) => (
        <th className="th-sortable" onClick={() => handleSort(k)}>
            {label}<SortIcon col={k} sortKey={sortKey} sortDir={sortDir} />
        </th>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Trades</h1>
                    <p className="page-sub">Complete history of all executions</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={generateDemoTrades}
                        disabled={loading}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        Generate Demo Trades
                    </button>
                    <button
                        onClick={clearAllData}
                        disabled={loading}
                        className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                        Clear All
                    </button>
                    <select
                        value={filterSide}
                        onChange={e => setFilterSide(e.target.value as any)}
                        className="input w-auto text-xs"
                    >
                        <option value="All">All Sides</option>
                        <option value="BUY">Buy Only</option>
                        <option value="SELL">Sell Only</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card">
                    <p className="stat-label">Total P&L</p>
                    <p className={`stat-value ${totalPnL > 0 ? 'text-emerald-600' : totalPnL < 0 ? 'text-red-600' : ''}`}>
                        {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="stat-sub flex items-center gap-1.5 mt-1.5">
                        {totalPnL >= 0
                            ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                            : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                        Avg ₹{avgPnl.toFixed(2)} / trade
                    </p>
                </div>

                <div className="stat-card">
                    <p className="stat-label">Total Trades</p>
                    <p className="stat-value">{filteredTrades.length}</p>
                    <p className="stat-sub mt-1.5">{winning}W · {losing}L</p>
                </div>

                <div className="stat-card">
                    <p className="stat-label">Win Rate</p>
                    <p className={`stat-value ${winRate >= 50 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {winRate.toFixed(1)}%
                    </p>
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${winRate >= 50 ? 'bg-emerald-500' : 'bg-red-400'}`}
                            style={{ width: `${winRate}%` }}
                        />
                    </div>
                </div>

                <div className="stat-card">
                    <p className="stat-label">Best Trade</p>
                    <p className="stat-value text-emerald-600">
                        {filteredTrades.length > 0
                            ? `+₹${Math.max(...filteredTrades.map(t => t.pnl)).toFixed(2)}`
                            : '—'}
                    </p>
                    <p className="stat-sub mt-1.5">
                        Worst: {filteredTrades.length > 0
                            ? `₹${Math.min(...filteredTrades.map(t => t.pnl)).toFixed(2)}`
                            : '—'}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="table-container">
                <div className="table-header">
                    <span className="table-title">Execution History</span>
                    <span className="text-xs text-gray-400">{filteredTrades.length} records</span>
                </div>

                {filteredTrades.length === 0 ? (
                    <div className="empty-state">
                        <BarChart3 className="empty-icon" />
                        <p className="empty-title">No trades yet</p>
                        <p className="empty-sub">Start a strategy to see executions here</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-50/80 border-b border-gray-100">
                                <tr>
                                    <th className="th">Strategy</th>
                                    <SortTh k="symbol" label="Symbol" />
                                    <th className="th">Side</th>
                                    <SortTh k="entryPrice" label="Entry" />
                                    <th className="th">Exit</th>
                                    <SortTh k="quantity" label="Qty" />
                                    <SortTh k="pnl" label="P&L" />
                                    <SortTh k="executedAt" label="Time" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredTrades.map((trade) => (
                                    <tr key={trade.id} className="tr">
                                        <td className="td">
                                            <div className="font-medium text-gray-900 text-xs">{trade.strategyName}</div>
                                            <div className="text-gray-400 text-xs">#{trade.strategyId}</div>
                                        </td>
                                        <td className="td">
                                            <span className="font-mono font-semibold text-gray-800 text-xs">{trade.symbol}</span>
                                        </td>
                                        <td className="td">
                                            <span className={`badge ${trade.side === 'BUY' ? 'badge-green' : 'badge-red'}`}>
                                                {trade.side}
                                            </span>
                                        </td>
                                        <td className="td font-mono text-gray-700">₹{trade.entryPrice.toFixed(2)}</td>
                                        <td className="td font-mono text-gray-700">₹{trade.exitPrice.toFixed(2)}</td>
                                        <td className="td text-gray-600">{trade.quantity}</td>
                                        <td className="td">
                                            <PnlCell pnl={trade.pnl} entryPrice={trade.entryPrice} qty={trade.quantity} />
                                        </td>
                                        <td className="td">
                                            <div className="text-gray-700">{new Date(trade.executedAt).toLocaleDateString('en-IN')}</div>
                                            <div className="text-gray-400 text-xs">{new Date(trade.executedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

