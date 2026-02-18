import { useAuth } from '../context/AuthContext';
import { User, Mail, Calendar, Crown, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) return null;

    const accountAge = user.createdAt
        ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
                <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-8">
                {/* Avatar & Name */}
                <div className="flex items-center space-x-6 mb-8 pb-8 border-b border-gray-200">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
                        <span className="text-3xl font-bold text-white">
                            {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
                        <p className="text-gray-500 mt-1">{user.email}</p>
                    </div>
                </div>

                {/* Account Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>

                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <User className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Full Name</p>
                                <p className="text-base font-medium text-gray-900">{user.name}</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <Mail className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Email Address</p>
                                <p className="text-base font-medium text-gray-900">{user.email}</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Calendar className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Member Since</p>
                                <p className="text-base font-medium text-gray-900">
                                    {user.createdAt
                                        ? new Date(user.createdAt).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })
                                        : 'Recently'}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {accountAge > 0 ? `${accountAge} days ago` : 'Today'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-gray-900">Subscription</h3>

                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                                        <Crown className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Current Plan</p>
                                        <p className="text-xl font-bold text-gray-900">
                                            {user.subscription || 'Free'} Plan
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {user.subscription === 'Free' ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Active Strategies</span>
                                        <span className="font-medium text-gray-900">3 / 3</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Backtest Credits</span>
                                        <span className="font-medium text-gray-900">10 / month</span>
                                    </div>
                                    <button className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                                        Upgrade to Pro
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Active Strategies</span>
                                        <span className="font-medium text-gray-900">Unlimited</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Backtest Credits</span>
                                        <span className="font-medium text-gray-900">Unlimited</span>
                                    </div>
                                    <div className="mt-4 text-sm text-gray-600">
                                        Next billing date: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-8 pt-8 border-t border-gray-200 flex items-center justify-between">
                    <div>
                        <button className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                            Change Password
                        </button>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-sm text-gray-500 mb-1">Total Strategies</p>
                    <p className="text-3xl font-bold text-gray-900">12</p>
                    <p className="text-sm text-green-600 mt-2">+3 this month</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-sm text-gray-500 mb-1">Total Trades</p>
                    <p className="text-3xl font-bold text-gray-900">248</p>
                    <p className="text-sm text-blue-600 mt-2">15 active</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-sm text-gray-500 mb-1">Overall PnL</p>
                    <p className="text-3xl font-bold text-green-600">+₹45,230</p>
                    <p className="text-sm text-gray-500 mt-2">Last 30 days</p>
                </div>
            </div>
        </div>
    );
}
