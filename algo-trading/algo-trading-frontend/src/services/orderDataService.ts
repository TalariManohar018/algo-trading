import { apiClient } from '../api/apiClient';

class OrderDataService {
    async getAllOrders() {
        try {
            return await apiClient.getOrders();
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            return [];
        }
    }

    async getOpenOrders() {
        try {
            return await apiClient.getOpenOrders();
        } catch (error) {
            console.error('Failed to fetch open orders:', error);
            return [];
        }
    }
}

export const orderDataService = new OrderDataService();
