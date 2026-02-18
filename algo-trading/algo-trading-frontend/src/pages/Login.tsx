import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please fill in all fields');
            return;
        }

        const result = await login(email, password);
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center space-x-2 mb-2">
                        <div className="bg-blue-600 p-3 rounded-lg">
                            <TrendingUp className="h-8 w-8 text-white" />
                        </div>
                        <span className="text-3xl font-bold text-gray-800">AlgoTrader Pro</span>
                    </div>
                    <p className="text-gray-600">Advanced Algorithmic Trading Platform</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-xl shadow-xl p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Login to your account</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 shadow-lg hover:shadow-xl"
                        >
                            Login
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-gray-600">
                            Don't have an account?{' '}
                            <Link to="/signup" className="text-blue-600 font-semibold hover:text-blue-700">
                                Sign up
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Demo Credentials */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 font-medium mb-2">Demo Credentials:</p>
                    <p className="text-sm text-blue-700">Email: demo@algotrader.com</p>
                    <p className="text-sm text-blue-700">Password: demo123</p>
                </div>
            </div>
        </div>
    );
}
