import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useError } from '../context/ErrorContext';

export default function ProfileMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { showSuccess } = useError();

    useEffect(() => {
        // Close dropdown when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const handleLogout = () => {
        logout();
        showSuccess('Logged out successfully');
        navigate('/login');
        setIsOpen(false);
    };

    const handleProfileClick = () => {
        navigate('/profile');
        setIsOpen(false);
    };

    const handleSettingsClick = () => {
        navigate('/settings');
        setIsOpen(false);
    };

    if (!user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Profile Avatar Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
                <span className="text-sm font-semibold text-white">
                    {getInitials(user.name)}
                </span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 animate-fadeIn">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                        <button
                            onClick={handleProfileClick}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-colors duration-150"
                        >
                            <User className="h-4 w-4 text-gray-500" />
                            <span>My Profile</span>
                        </button>

                        <button
                            onClick={handleSettingsClick}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-colors duration-150"
                        >
                            <Settings className="h-4 w-4 text-gray-500" />
                            <span>Settings</span>
                        </button>

                        <button
                            onClick={handleLogout}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3 transition-colors duration-150"
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
