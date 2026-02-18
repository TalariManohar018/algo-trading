import { apiClient } from '../api/apiClient';

class PositionDataService {
    async getAllPositions() {
        try {
            return await apiClient.getPositions();
        } catch (error) {
            console.error('Failed to fetch positions:', error);
            return [];
        }
    }

    async getOpenPositions() {
        try {
            return await apiClient.getOpenPositions();
        } catch (error) {
            console.error('Failed to fetch open positions:', error);
            return [];
        }
    }

    async updatePositionPrice(id: string, currentPrice: number) {
        try {
            return await apiClient.updatePositionPrice(id, currentPrice);
        } catch (error) {
            console.error('Failed to update position price:', error);
            throw error;
        }
    }

    async closePosition(id: string, exitPrice: number) {
        try {
            return await apiClient.closePosition(id, exitPrice);
        } catch (error) {
            console.error('Failed to close position:', error);
            throw error;
        }
    }
}

export const positionDataService = new PositionDataService();
