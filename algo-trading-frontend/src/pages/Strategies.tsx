import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { mockStrategies } from '../data/mockStrategies';
import StrategyCard from '../components/StrategyCard';

export default function Strategies() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Running' | 'Stopped'>('All');
    const [filterInstrument, setFilterInstrument] = useState<'All' | 'NIFTY' | 'BANKNIFTY'>('All');

    const filteredStrategies = mockStrategies.filter(strategy => {
        const matchesSearch = strategy.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All' || strategy.status === filterStatus;
        const matchesInstrument = filterInstrument === 'All' || strategy.instrument === filterInstrument;

        return matchesSearch && matchesStatus && matchesInstrument;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Strategies</h1>
                    <p className="text-gray-600 mt-1">Manage and monitor your trading strategies</p>
                </div>

                <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
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
                        onChange={(e) => setFilterStatus(e.target.value as 'All' | 'Running' | 'Stopped')}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="All">All Status</option>
                        <option value="Running">Running</option>
                        <option value="Stopped">Stopped</option>
                    </select>

                    <select
                        value={filterInstrument}
                        onChange={(e) => setFilterInstrument(e.target.value as 'All' | 'NIFTY' | 'BANKNIFTY')}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="All">All Instruments</option>
                        <option value="NIFTY">NIFTY</option>
                        <option value="BANKNIFTY">BANKNIFTY</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStrategies.map((strategy) => (
                    <StrategyCard key={strategy.id} strategy={strategy} />
                ))}
            </div>

            {filteredStrategies.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-gray-500">No strategies found matching your filters</p>
                </div>
            )}
        </div>
    );
}
