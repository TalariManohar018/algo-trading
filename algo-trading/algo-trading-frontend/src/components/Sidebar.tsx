import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Layers, PenTool, BarChart3, Receipt, Briefcase, Settings, Shield, Link2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
    const location = useLocation();
    const { isAdmin } = useAuth();

    const menuItems = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/strategies', icon: Layers, label: 'Strategies' },
        { path: '/builder', icon: PenTool, label: 'Builder' },
        { path: '/backtest', icon: BarChart3, label: 'Backtest' },
        { path: '/trades', icon: Receipt, label: 'Trades' },
        { path: '/positions', icon: Briefcase, label: 'Positions' },
        { path: '/broker', icon: Link2, label: 'Broker Connect' },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ];

    // Add admin-only menu item
    if (isAdmin) {
        menuItems.push({
            path: '/admin',
            icon: Shield,
            label: 'Admin Panel'
        });
    }

    return (
        <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200">
            <nav className="p-4 space-y-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${isActive
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
