import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { seedPaperStrategies } from './utils/seedPaperStrategies'

// Initialize demo users if not exists
const users = localStorage.getItem('users');
if (!users) {
    localStorage.setItem('users', JSON.stringify([
        {
            id: 'user_demo_001',
            email: 'demo@algotrader.com',
            password: 'demo123',
            name: 'Demo User',
            role: 'USER',
            createdAt: new Date().toISOString(),
            subscription: 'Free'
        },
        {
            id: 'user_admin_001',
            email: 'admin@algotrader.com',
            password: 'admin123',
            name: 'Admin User',
            role: 'ADMIN',
            createdAt: new Date().toISOString(),
            subscription: 'Pro'
        }
    ]));
}

// Initialize demo strategies for paper trading
seedPaperStrategies();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
