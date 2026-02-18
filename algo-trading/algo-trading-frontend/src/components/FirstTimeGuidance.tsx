import { Rocket, TrendingUp, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FirstTimeGuidance() {
    const navigate = useNavigate();

    const steps = [
        {
            number: 1,
            title: 'Create Strategy',
            description: 'Build your algorithmic trading strategy with custom indicators and conditions',
            icon: TrendingUp,
            action: () => navigate('/builder'),
            buttonText: 'Strategy Builder',
        },
        {
            number: 2,
            title: 'Backtest Strategy',
            description: 'Test your strategy against historical data to validate performance',
            icon: PlayCircle,
            action: () => navigate('/backtest'),
            buttonText: 'Run Backtest',
        },
        {
            number: 3,
            title: 'Deploy Strategy',
            description: 'Go live and monitor your positions in real-time',
            icon: Rocket,
            action: () => navigate('/strategies'),
            buttonText: 'View Strategies',
        },
    ];

    return (
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg border border-blue-700 p-8 text-white">
            <div className="max-w-4xl">
                <div className="flex items-center space-x-3 mb-6">
                    <Rocket className="h-8 w-8" />
                    <h2 className="text-2xl font-bold">Welcome to Algorithmic Trading!</h2>
                </div>

                <p className="text-blue-100 mb-8">
                    Get started with your first automated trading strategy in 3 simple steps:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {steps.map((step) => {
                        const Icon = step.icon;
                        return (
                            <div
                                key={step.number}
                                className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 hover:bg-white/20 transition-all"
                            >
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="bg-white/20 rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">
                                        {step.number}
                                    </div>
                                    <Icon className="h-6 w-6" />
                                </div>

                                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                                <p className="text-blue-100 text-sm mb-4 min-h-[40px]">
                                    {step.description}
                                </p>

                                <button
                                    onClick={step.action}
                                    className="w-full px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold text-sm"
                                >
                                    {step.buttonText}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-8 p-4 bg-white/10 rounded-lg border border-white/20">
                    <p className="text-sm text-blue-100">
                        💡 <span className="font-semibold">Tip:</span> Start with paper trading to test your strategies risk-free before going live with real capital.
                    </p>
                </div>
            </div>
        </div>
    );
}
