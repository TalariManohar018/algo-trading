import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Strategies from './pages/Strategies';
import Builder from './pages/Builder';
import Backtest from './pages/Backtest';

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-gray-100">
                <Navbar />
                <Sidebar />

                <main className="ml-64 mt-16 p-8">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/strategies" element={<Strategies />} />
                        <Route path="/builder" element={<Builder />} />
                        <Route path="/backtest" element={<Backtest />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
