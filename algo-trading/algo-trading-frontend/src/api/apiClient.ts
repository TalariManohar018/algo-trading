import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

class ApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        this.client.interceptors.request.use(
            (config: InternalAxiosRequestConfig) => {
                const token = localStorage.getItem('jwt_token');
                if (token && config.headers) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        this.client.interceptors.response.use(
            (response) => response,
            (error: AxiosError) => {
                if (error.response?.status === 401) {
                    localStorage.removeItem('jwt_token');
                    localStorage.removeItem('currentUser');
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }
        );
    }

    // Auth
    async register(username: string, password: string, email: string) {
        const response = await this.client.post('/auth/register', { username, password, email });
        return response.data;
    }

    async login(username: string, password: string) {
        const response = await this.client.post('/auth/login', { username, password });
        if (response.data.token) {
            localStorage.setItem('jwt_token', response.data.token);
        }
        return response.data;
    }

    logout() {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('currentUser');
    }

    // Strategies
    async getStrategies() {
        const response = await this.client.get('/strategies');
        return response.data;
    }

    async getStrategy(id: string) {
        const response = await this.client.get(`/strategies/${id}`);
        return response.data;
    }

    async createStrategy(strategy: any) {
        const response = await this.client.post('/strategies', strategy);
        return response.data;
    }

    async activateStrategy(id: string) {
        const response = await this.client.put(`/strategies/${id}/activate`);
        return response.data;
    }

    async deactivateStrategy(id: string) {
        const response = await this.client.put(`/strategies/${id}/deactivate`);
        return response.data;
    }

    async deleteStrategy(id: string) {
        const response = await this.client.delete(`/strategies/${id}`);
        return response.data;
    }

    // Orders
    async createOrder(order: any) {
        const response = await this.client.post('/orders', order);
        return response.data;
    }

    async placeOrder(id: string) {
        const response = await this.client.post(`/orders/${id}/place`);
        return response.data;
    }

    async fillOrder(id: string, filledPrice: number) {
        const response = await this.client.post(`/orders/${id}/fill`, { filledPrice });
        return response.data;
    }

    async getOrders() {
        const response = await this.client.get('/orders');
        return response.data;
    }

    async getOpenOrders() {
        const response = await this.client.get('/orders/open');
        return response.data;
    }

    // Positions
    async getPositions() {
        const response = await this.client.get('/positions');
        return response.data;
    }

    async getOpenPositions() {
        const response = await this.client.get('/positions/open');
        return response.data;
    }

    async updatePositionPrice(id: string, currentPrice: number) {
        const response = await this.client.post(`/positions/${id}/update-price`, { currentPrice });
        return response.data;
    }

    async closePosition(id: string, exitPrice: number) {
        const response = await this.client.post(`/positions/${id}/close`, { exitPrice });
        return response.data;
    }

    // Trades
    async getTrades() {
        const response = await this.client.get('/trades');
        return response.data;
    }

    async getTradesByStrategy(strategyId: string) {
        const response = await this.client.get(`/trades/strategy/${strategyId}`);
        return response.data;
    }

    async getTrade(id: string) {
        const response = await this.client.get(`/trades/${id}`);
        return response.data;
    }

    async getTotalPnL() {
        const response = await this.client.get('/trades/pnl/total');
        return response.data;
    }

    async getPnLByStrategy() {
        const response = await this.client.get('/trades/pnl/by-strategy');
        return response.data;
    }

    async getWinRate(strategyId: string) {
        const response = await this.client.get(`/trades/winrate/${strategyId}`);
        return response.data;
    }

    // Wallet
    async getWallet() {
        const response = await this.client.get('/wallet');
        return response.data;
    }

    // Risk
    async getRiskState() {
        const response = await this.client.get('/risk');
        return response.data;
    }

    async unlockRisk(password: string) {
        const response = await this.client.post('/risk/unlock', { password });
        return response.data;
    }

    async resetRisk() {
        const response = await this.client.post('/risk/reset');
        return response.data;
    }

    // Engine
    async startEngine() {
        const response = await this.client.post('/engine/start');
        return response.data;
    }

    async stopEngine() {
        const response = await this.client.post('/engine/stop');
        return response.data;
    }

    async emergencyStop() {
        const response = await this.client.post('/emergency/stop');
        return response.data;
    }

    async resetAfterEmergency() {
        const response = await this.client.post('/emergency/reset');
        return response.data;
    }

    async getBrokerMode() {
        const response = await this.client.get('/emergency/broker-mode');
        return response.data;
    }

    async getAuditLogs() {
        const response = await this.client.get('/emergency/audit-logs');
        return response.data;
    }

    async getCriticalLogs() {
        const response = await this.client.get('/emergency/audit-logs/critical');
        return response.data;
    }

    async getEngineStatus() {
        const response = await this.client.get('/engine/status');
        return response.data;
    }

    // Backtest
    async runBacktest(strategyId: string, params: any) {
        const response = await this.client.post(`/backtest/${strategyId}`, params);
        return response.data;
    }

    // Health
    async healthCheck() {
        const response = await this.client.get('/health');
        return response.data;
    }
}

export const apiClient = new ApiClient();
