import { apiClient } from '../api/apiClient';

export interface Strategy {
    id: number;
    name: string;
    description: string;
    symbol: string;
    instrumentType: 'OPTION' | 'FUTURE';
    timeframe?: string;
    status: 'CREATED' | 'RUNNING' | 'STOPPED' | 'ERROR';
    createdAt: string;
    updatedAt: string;
    conditions: Condition[];
    parameters?: Record<string, any>;
}

export interface Condition {
    id?: number;
    type: string;
    indicator?: string;
    operator?: string;
    value?: number;
}

class StrategyService {
    async getAllStrategies(_search?: string): Promise<Strategy[]> {
        try {
            const response = await apiClient.getStrategies();
            const strategies = response.data || response;
            return strategies.map(this.mapBackendToFrontend.bind(this));
        } catch (error) {
            console.error('Failed to fetch strategies from backend:', error);
            return this.getMockStrategies();
        }
    }

    async getStrategyById(id: number): Promise<Strategy> {
        try {
            const strategy = await apiClient.getStrategy(id.toString());
            return this.mapBackendToFrontend(strategy);
        } catch (error) {
            console.error('Failed to fetch strategy from backend:', error);
            throw new Error('Strategy not found');
        }
    }

    async createStrategy(data: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Strategy> {
        try {
            const request = {
                name: data.name,
                description: data.description,
                instrumentType: data.instrumentType,
                symbol: data.symbol,
                conditions: data.conditions.map(c => ({
                    indicatorType: c.indicator || 'RSI',
                    conditionType: c.operator || 'GREATER_THAN',
                    value: c.value || 0
                }))
            };
            const strategy = await apiClient.createStrategy(request);
            return this.mapBackendToFrontend(strategy);
        } catch (error) {
            console.error('Failed to create strategy:', error);
            throw new Error('Failed to create strategy');
        }
    }

    async updateStrategy(id: number, data: Partial<Strategy>): Promise<Strategy> {
        try {
            const current = await this.getStrategyById(id);
            const request = {
                name: data.name || current.name,
                description: data.description || current.description,
                instrumentType: data.instrumentType || current.instrumentType,
                symbol: data.symbol || current.symbol,
                conditions: (data.conditions || current.conditions).map(c => ({
                    indicatorType: c.indicator || 'RSI',
                    conditionType: c.operator || 'GREATER_THAN',
                    value: c.value || 0
                }))
            };
            const strategy = await apiClient.createStrategy(request);
            return this.mapBackendToFrontend(strategy);
        } catch (error) {
            console.error('Failed to update strategy:', error);
            throw new Error('Failed to update strategy');
        }
    }

    async deleteStrategy(id: number): Promise<void> {
        try {
            await apiClient.deleteStrategy(id.toString());
        } catch (error) {
            console.error('Failed to delete strategy:', error);
            throw new Error('Failed to delete strategy');
        }
    }

    async startStrategy(id: number): Promise<Strategy> {
        try {
            await apiClient.activateStrategy(id.toString());
            return await this.getStrategyById(id);
        } catch (error) {
            console.error('Failed to start strategy:', error);
            throw new Error('Failed to start strategy');
        }
    }

    async stopStrategy(id: number): Promise<Strategy> {
        try {
            await apiClient.deactivateStrategy(id.toString());
            return await this.getStrategyById(id);
        } catch (error) {
            console.error('Failed to stop strategy:', error);
            throw new Error('Failed to stop strategy');
        }
    }

    async setStrategyError(id: number): Promise<Strategy> {
        return await this.getStrategyById(id);
    }

    async duplicateStrategy(id: number): Promise<Strategy> {
        try {
            const original = await this.getStrategyById(id);
            const duplicate = await this.createStrategy({
                name: `${original.name} (Copy)`,
                description: original.description,
                symbol: original.symbol,
                instrumentType: original.instrumentType,
                status: 'CREATED',
                conditions: original.conditions
            });
            return duplicate;
        } catch (error) {
            console.error('Failed to duplicate strategy:', error);
            throw new Error('Failed to duplicate strategy');
        }
    }

    private mapBackendToFrontend(backendStrategy: any): Strategy {
        // parameters is stored as a JSON string in the backend
        let parsedParams: any = {};
        try {
            if (typeof backendStrategy.parameters === 'string') {
                parsedParams = JSON.parse(backendStrategy.parameters);
            } else if (backendStrategy.parameters && typeof backendStrategy.parameters === 'object') {
                parsedParams = backendStrategy.parameters;
            }
        } catch { /* ignore */ }

        // Combine entry and exit conditions from parameters
        const entryConditions = (parsedParams.entryConditions || []).map((c: any) => ({
            id: typeof c.id === 'number' ? c.id : parseInt(c.id) || 0,
            type: 'ENTRY',
            indicator: c.indicatorType,
            operator: c.conditionType,
            value: c.value
        }));
        const exitConditions = (parsedParams.exitConditions || []).map((c: any) => ({
            id: typeof c.id === 'number' ? c.id : parseInt(c.id) || 0,
            type: 'EXIT',
            indicator: c.indicatorType,
            operator: c.conditionType,
            value: c.value
        }));

        return {
            id: typeof backendStrategy.id === 'string'
                ? (parseInt(backendStrategy.id) || backendStrategy.id as any)
                : backendStrategy.id,
            name: backendStrategy.name,
            description: backendStrategy.description || '',
            symbol: backendStrategy.symbol,
            instrumentType: backendStrategy.instrumentType || parsedParams.instrumentType || 'FUTURE',
            status: this.mapStatus(backendStrategy.status),
            createdAt: backendStrategy.createdAt || new Date().toISOString(),
            updatedAt: backendStrategy.updatedAt || new Date().toISOString(),
            conditions: [...entryConditions, ...exitConditions],
            parameters: parsedParams
        };
    }

    private mapStatus(backendStatus: string): 'CREATED' | 'RUNNING' | 'STOPPED' | 'ERROR' {
        switch (backendStatus) {
            case 'ACTIVE': return 'RUNNING';
            case 'INACTIVE': return 'STOPPED';
            case 'CREATED': return 'CREATED';
            case 'ERROR': return 'ERROR';
            default: return 'CREATED';
        }
    }

    private getMockStrategies(): Strategy[] {
        return [
            {
                id: 1,
                name: 'Iron Condor NIFTY',
                description: 'Short straddle with protective wings on NIFTY weekly options',
                symbol: 'NIFTY',
                instrumentType: 'OPTION',
                status: 'RUNNING',
                createdAt: '2024-02-10T10:30:00Z',
                updatedAt: '2024-02-15T09:15:00Z',
                conditions: [
                    { id: 1, type: 'ENTRY', indicator: 'RSI', operator: 'LESS_THAN', value: 30 },
                    { id: 2, type: 'EXIT', indicator: 'PROFIT_TARGET', operator: 'GREATER_THAN', value: 50 }
                ],
                parameters: {
                    lotSize: 50,
                    maxLoss: 5000,
                    profitTarget: 2500
                }
            },
            {
                id: 2,
                name: 'Bull Call Spread',
                description: 'Bullish strategy for BANKNIFTY',
                symbol: 'BANKNIFTY',
                instrumentType: 'OPTION',
                status: 'STOPPED',
                createdAt: '2024-02-08T14:20:00Z',
                updatedAt: '2024-02-14T16:00:00Z',
                conditions: [
                    { id: 3, type: 'ENTRY', indicator: 'MACD', operator: 'CROSSOVER', value: 0 }
                ],
                parameters: {
                    lotSize: 25,
                    maxLoss: 3000
                }
            },
            {
                id: 3,
                name: 'Straddle Strategy',
                description: 'Volatility play on NIFTY',
                symbol: 'NIFTY',
                instrumentType: 'OPTION',
                status: 'RUNNING',
                createdAt: '2024-02-12T11:00:00Z',
                updatedAt: '2024-02-15T10:30:00Z',
                conditions: [],
                parameters: {
                    lotSize: 75
                }
            }
        ];
    }
}

export const strategyService = new StrategyService();
