import { TrendingUp, TrendingDown, X, Activity } from 'lucide-react';
import { useTradingContext } from '../context/TradingContext';
import { useError } from '../context/ErrorContext';
import { useLoading } from '../context/LoadingContext';
import { useState } from 'react';

export default function Positions() {
    const tradingContext = useTradingContext();
    const { showError, showSuccess } = useError();
    const { setLoading } = useLoading();
    const [closingId, setClosingId] = useState<string | null>(null);

    const openPositions = tradingContext.positions.filter(p => p.status === 'OPEN');

    const handleClosePosition = async (positionId: string) => {
        if (!confirm('Close this position?')) return;
        const position = openPositions.find(p => p.id === positionId);
        if (!position) { showError('Position not found'); return; }
        try {
            setClosingId(positionId);
            setLoading(true, 'Closing position...');
            tradingContext.closePosition(positionId, position.currentPrice);
            showSuccess(`Closed. P&L: ₹${position.unrealizedPnl.toFixed(2)}`);
        } catch (err) {
            showError(err instanceof Error ? err.message : 'Failed to close position');
        } finally {
            setClosingId(null);
            setLoading(false);
        }
    };

    const totalPnL = openPositions.reduce((s, p) => s + p.unrealizedPnl, 0);
    const profitable = openPositions.filter(p => p.unrealizedPnl > 0).length;
    const strategiesCount = new Set(openPositions.map(p => p.strategyName)).size;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Positions</h1>
                    <p className="page-sub">Real-time open position monitor</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="live-dot" />
                    Live
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="stat-card flex items-start justify-between">
                    <div>
                        <p className="stat-label">Unrealized P&L</p>
                        <p className={`stat-value ${totalPnL > 0 ? 'text-emerald-600' : totalPnL < 0 ? 'text-red-600' : ''}`}>
                            {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="stat-sub flex items-center gap-1.5 mt-1.5">
                            <span className="live-dot" /> Updates live
                        </p>
                    </div>
                    {totalPnL >= 0
                        ? <TrendingUp className="h-8 w-8 text-emerald-400 shrink-0" />
                        : <TrendingDown className="h-8 w-8 text-red-400 shrink-0" />}
                </div>

                <div className="stat-card">
                    <p className="stat-label">Open Positions</p>
                    <p className="stat-value">{openPositions.length}</p>
                    <p className="stat-sub mt-1.5">Across {strategiesCount} {strategiesCount === 1 ? 'strategy' : 'strategies'}</p>
                </div>

                <div className="stat-card">
                    <p className="stat-label">Profitable</p>
                    <p className="stat-value">{profitable}<span className="text-base font-normal text-gray-400">/{openPositions.length}</span></p>
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: openPositions.length ? `${(profitable / openPositions.length) * 100}%` : '0%' }}
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="table-container">
                <div className="table-header">
                    <span className="table-title">Open Positions</span>
                    <span className="text-xs text-gray-400">{openPositions.length} active</span>
                </div>

                {openPositions.length === 0 ? (
                    <div className="empty-state">
                        <Activity className="empty-icon" />
                        <p className="empty-title">No open positions</p>
                        <p className="empty-sub">Start a strategy to open positions</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-50/80 border-b border-gray-100">
                                <tr>
                                    <th className="th">Strategy</th>
                                    <th className="th">Symbol</th>
                                    <th className="th">Side</th>
                                    <th className="th">Entry</th>
                                    <th className="th">Current</th>
                                    <th className="th">Qty</th>
                                    <th className="th">Unrealized P&L</th>
                                    <th className="th">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {openPositions.map((pos) => {
                                    const pct = pos.entryPrice && pos.quantity
                                        ? (pos.unrealizedPnl / (pos.entryPrice * pos.quantity)) * 100
                                        : 0;
                                    const isClosing = closingId === pos.id;
                                    return (
                                        <tr key={pos.id} className="tr">
                                            <td className="td">
                                                <div className="font-medium text-gray-900 text-xs">{pos.strategyName}</div>
                                                <div className="text-gray-400 text-xs">{new Date(pos.openedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                                            </td>
                                            <td className="td">
                                                <span className="font-mono font-semibold text-gray-800">{pos.symbol}</span>
                                            </td>
                                            <td className="td">
                                                <span className={`badge ${pos.side === 'LONG' ? 'badge-green' : 'badge-red'}`}>
                                                    {pos.side}
                                                </span>
                                            </td>
                                            <td className="td font-mono text-gray-700">₹{pos.entryPrice.toFixed(2)}</td>
                                            <td className="td font-mono font-semibold text-gray-900">₹{pos.currentPrice.toFixed(2)}</td>
                                            <td className="td text-gray-600">{pos.quantity}</td>
                                            <td className="td">
                                                <div className={pos.unrealizedPnl > 0 ? 'pnl-pos' : pos.unrealizedPnl < 0 ? 'pnl-neg' : 'pnl-zero'}>
                                                    {pos.unrealizedPnl >= 0 ? '+' : ''}₹{pos.unrealizedPnl.toFixed(2)}
                                                </div>
                                                <div className={`text-xs mt-0.5 ${pos.unrealizedPnl > 0 ? 'text-emerald-500' : pos.unrealizedPnl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                                    {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                                </div>
                                            </td>
                                            <td className="td">
                                                <button
                                                    onClick={() => handleClosePosition(pos.id)}
                                                    disabled={isClosing}
                                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                    {isClosing ? 'Closing…' : 'Close'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
