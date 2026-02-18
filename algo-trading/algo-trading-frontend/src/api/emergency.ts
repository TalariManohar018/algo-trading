import { apiClient } from './apiClient';

export interface EmergencyStopResponse {
    success: boolean;
    timestamp: string;
    triggeredBy: string;
    engineStopped: boolean;
    ordersCancelled: boolean;
    positionsSquaredOff: boolean;
    riskLocked: boolean;
    closedPositions: Array<{
        symbol: string;
        pnl: number;
    }>;
    errors: string[];
}

export interface BrokerModeInfo {
    mode: string;
    provider: string;
    isLive: boolean;
    isConnected: boolean;
    warning: string;
}

export interface AuditLog {
    id: number;
    userId: number;
    eventType: string;
    severity: string;
    message: string;
    metadata: string;
    timestamp: string;
}

export const emergencyStop = async (): Promise<EmergencyStopResponse> => {
    return await apiClient.emergencyStop();
};

export const resetAfterEmergency = async () => {
    return await apiClient.resetAfterEmergency();
};

export const getBrokerMode = async (): Promise<BrokerModeInfo> => {
    return await apiClient.getBrokerMode();
};

export const getAuditLogs = async (): Promise<AuditLog[]> => {
    return await apiClient.getAuditLogs();
};

export const getCriticalLogs = async (): Promise<AuditLog[]> => {
    return await apiClient.getCriticalLogs();
};
