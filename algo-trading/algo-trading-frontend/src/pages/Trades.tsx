import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, BarChart3, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useTradingContext } from '../context/TradingContext';

type SortKey = 'pnl' | 'executedAt' | 'entryPrice' | 'quantity' | 'symbol';
type SortDir = 'asc' | 'desc';

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
    const tradingContext = useTradingContext();
    const [filterSide, setFilterSide] = useState<'All' | 'BUY' | 'SELL'>('All');
    const [sortKey, setSortKey] = useState<SortKey>('executedAt');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const filteredTrades = useMemo(() => {
        let trades = tradingContext.trades.filter(t =>
            filterSide === 'All' || t.side === filterSide
        );
        trades = [...trades].sort((a, b) => {
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
        return trades;
    }, [tradingContext.trades, filterSide, sortKey, sortDir]);

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


return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Trades</h1>
                <p className="text-gray-600 mt-1">View and analyze all your trading activity</p>
            </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">Total PnL</p>
                        <p className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    {totalPnL >= 0 ? (
                        <TrendingUp className="h-10 w-10 text-green-600" />
                    ) : (
                        <TrendingDown className="h-10 w-10 text-red-600" />
                    )}
                </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <p className="text-sm text-gray-500 mb-1">Total Trades</p>
                <p className="text-3xl font-bold text-gray-900">{filteredTrades.length}</p>
                <p className="text-sm text-gray-500 mt-2">
                    All completed trades
                </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <p className="text-sm text-gray-500 mb-1">Win Rate</p>
                <p className="text-3xl font-bold text-gray-900">{winRate.toFixed(1)}%</p>
                <p className="text-sm text-green-600 mt-2">
                    {winningTrades} winning trades
                </p>
            </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center space-x-4">
                <Filter className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filters:</span>

                <select
                    value={filterSide}
                    onChange={(e) => setFilterSide(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                    <option value="All">All Sides</option>
                    <option value="BUY">Buy</option>
                    <option value="SELL">Sell</option>
                </select>

                <span className="text-sm text-gray-500">Showing {filteredTrades.length} trades</span>
            </div>
        </div>

        {/* Trades Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {filteredTrades.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-700 text-lg font-medium mb-2">No trades yet</p>
                        <p className="text-gray-400 text-sm">Start paper trading to see activity here.</p>
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Strategy
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Symbol
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Side
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Entry
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Exit
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Qty
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    PnL
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Executed At
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredTrades.map((trade) => (
                                <tr key={trade.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{trade.strategyName}</div>
                                        <div className="text-xs text-gray-500">ID: {trade.strategyId}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{trade.symbol}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${trade.side === 'BUY'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {trade.side}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        ₹{trade.entryPrice.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        ₹{trade.exitPrice.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {trade.quantity}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className={`text-sm font-semibold ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {trade.pnl >= 0 ? '+' : ''}₹{trade.pnl.toFixed(2)}
                                        </div>
                                        <div className={`text-xs ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                                            }`}>
                                            {trade.pnl >= 0 ? '+' : ''}{((trade.pnl / (trade.entryPrice * trade.quantity)) * 100).toFixed(2)}%
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {new Date(trade.executedAt).toLocaleDateString()}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(trade.executedAt).toLocaleTimeString()}
                                        </div>
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
