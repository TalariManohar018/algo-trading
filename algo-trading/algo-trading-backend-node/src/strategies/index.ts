// ============================================================
// STRATEGY REGISTRY — Factory + registry for all strategies
// ============================================================
// Add new strategies here. The engine discovers them via this
// registry. No other code changes needed for new strategies.
// ============================================================

import { IStrategy } from './base';
import { MovingAverageCrossover } from './movingAverageCrossover';
import { RSIStrategy } from './rsiStrategy';
import { CustomStrategy } from './customStrategy';

class StrategyRegistry {
    private strategies = new Map<string, IStrategy>();

    constructor() {
        this.register(new MovingAverageCrossover());
        this.register(new RSIStrategy());
        this.register(new CustomStrategy());
        // Register new strategies here:
        // this.register(new BollingerBandStrategy());
        // this.register(new MACDStrategy());
        // this.register(new VWAPStrategy());
    }

    private register(strategy: IStrategy): void {
        this.strategies.set(strategy.name, strategy);
    }

    get(name: string): IStrategy | undefined {
        return this.strategies.get(name);
    }

    getOrThrow(name: string): IStrategy {
        const strategy = this.strategies.get(name);
        if (!strategy) {
            throw new Error(`Unknown strategy type: ${name}. Available: ${this.listNames().join(', ')}`);
        }
        return strategy;
    }

    listNames(): string[] {
        return Array.from(this.strategies.keys());
    }

    listAll(): { name: string; description: string; defaultParams: Record<string, number> }[] {
        return Array.from(this.strategies.values()).map((s) => ({
            name: s.name,
            description: s.getDescription(),
            defaultParams: s.getDefaultParameters(),
        }));
    }
}

export const strategyRegistry = new StrategyRegistry();
