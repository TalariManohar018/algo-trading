import React, { useState, useEffect } from 'react';
import { FileText, AlertTriangle, Info, AlertCircle, AlertOctagon } from 'lucide-react';
import { getAuditLogs, AuditLog } from '../api/emergency';

const AuditLogViewer: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filter, setFilter] = useState<string>('ALL');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await getAuditLogs();
            setLogs(data);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'CRITICAL':
                return <AlertOctagon className="h-5 w-5 text-red-500" />;
            case 'WARNING':
                return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            case 'ERROR':
                return <AlertCircle className="h-5 w-5 text-orange-500" />;
            default:
                return <Info className="h-5 w-5 text-blue-500" />;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL':
                return 'bg-red-900 border-red-600';
            case 'WARNING':
                return 'bg-yellow-900 border-yellow-600';
            case 'ERROR':
                return 'bg-orange-900 border-orange-600';
            default:
                return 'bg-gray-800 border-gray-600';
        }
    };

    const filteredLogs = logs.filter(log => {
        if (filter === 'ALL') return true;
        return log.severity === filter;
    });

    return (
        <div className="bg-gray-800 rounded-xl shadow-sm p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-white" />
                    <h3 className="text-lg font-bold text-white tracking-tight">Audit Logs</h3>
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            <div className="flex space-x-2 mb-4">
                {['ALL', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'].map(severity => (
                    <button
                        key={severity}
                        onClick={() => setFilter(severity)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${filter === severity
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                    >
                        {severity}
                    </button>
                ))}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto flex-1">
                {filteredLogs.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No audit logs found</p>
                ) : (
                    filteredLogs.map(log => (
                        <div
                            key={log.id}
                            className={`border rounded-lg p-3 ${getSeverityColor(log.severity)}`}
                        >
                            <div className="flex items-start space-x-3">
                                {getSeverityIcon(log.severity)}
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-white font-semibold text-sm">
                                            {log.eventType}
                                        </span>
                                        <span className="text-gray-400 text-xs">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-gray-300 text-sm">{log.message}</p>
                                    {log.metadata && (
                                        <details className="mt-2">
                                            <summary className="text-gray-400 text-xs cursor-pointer hover:text-gray-300">
                                                Metadata
                                            </summary>
                                            <pre className="text-gray-400 text-xs mt-1 bg-gray-900 p-2 rounded overflow-x-auto">
                                                {JSON.stringify(JSON.parse(log.metadata), null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AuditLogViewer;
