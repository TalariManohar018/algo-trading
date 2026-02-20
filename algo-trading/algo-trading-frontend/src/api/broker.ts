// ============================================================
// BROKER API — Angel One broker connection management
// ============================================================

import { API_BASE_URL } from './config';

const BROKER_URL = `${API_BASE_URL}/broker`;

export interface BrokerLoginRequest {
    apiKey: string;
    clientId: string;
    password: string;
    totpSecret: string;
    liveTotp?: string;  // Optional: direct 6-digit TOTP from authenticator app
}

export interface BrokerStatus {
    connected: boolean;
    broker: string;
    clientId?: string;
    mode: string;
}

/**
 * Login to Angel One SmartAPI
 */
export async function brokerLogin(creds: BrokerLoginRequest): Promise<{ success: boolean; message: string; data?: any }> {
    // Only send liveTotp if totpSecret is empty (they are mutually exclusive)
    const payload = {
        apiKey: creds.apiKey,
        clientId: creds.clientId,
        password: creds.password,
        totpSecret: creds.totpSecret || '',
        ...(creds.liveTotp && !creds.totpSecret ? { liveTotp: creds.liveTotp } : {}),
    };
    const res = await fetch(`${BROKER_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    // Normalize: backend error handler uses "error" field, success uses "data"
    return {
        success: json.success ?? false,
        message: json.message || json.error || (json.success ? 'Connected' : 'Login failed'),
        data: json.data,
    };
}

/**
 * Logout from Angel One
 */
export async function brokerLogout(): Promise<{ success: boolean }> {
    const res = await fetch(`${BROKER_URL}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
}

/**
 * Get current broker connection status
 */
export async function getBrokerStatus(): Promise<BrokerStatus> {
    const res = await fetch(`${BROKER_URL}/status`);
    const data = await res.json();
    return data.data || data;
}

/**
 * Refresh Angel One session token
 */
export async function refreshBrokerSession(): Promise<{ success: boolean }> {
    const res = await fetch(`${BROKER_URL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
}

/**
 * Activate emergency stop — blocks all new orders
 */
export async function emergencyStop(squareOff = false): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BROKER_URL}/emergency-stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squareOff }),
    });
    return res.json();
}

/**
 * Resume trading after emergency stop
 */
export async function resumeTrading(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BROKER_URL}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
}
