import { TrendingUp } from 'lucide-react';

export default function Navbar() {
    return (
        <nav className="bg-white border-b border-gray-200 fixed w-full z-30 top-0">
            <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <TrendingUp className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-gray-800">AlgoTrader Pro</span>
                    </div>

                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm text-gray-600">Market Open</span>
                        </div>

                        <div className="text-sm text-gray-600">
                            NIFTY: <span className="font-semibold text-green-600">21,450.50</span>
                            <span className="text-green-600 ml-1">+0.85%</span>
                        </div>

                        <div className="text-sm text-gray-600">
                            BANKNIFTY: <span className="font-semibold text-green-600">47,890.25</span>
                            <span className="text-green-600 ml-1">+1.12%</span>
                        </div>

                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-gray-700">MT</span>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
