import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Layers, PenTool, BarChart3 } from 'lucide-react';

export default function Sidebar() {
    const location = useLocation();

    const menuItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/strategies', icon: Layers, label: 'Strategies' },
        { path: '/builder', icon: PenTool, label: 'Builder' },
        { path: '/backtest', icon: BarChart3, label: 'Backtest' },
    ];

    return (
        <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-gray-50 border-r border-gray-200">
            <nav className="p-4 space-y-2">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
