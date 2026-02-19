// ============================================================
// BROKER FACTORY — Global broker instance management
// ============================================================
// Manages the active broker instance (Paper or Angel One).
// The execution engine and routes use this to get the current broker.
// ============================================================

import { IBrokerService, PaperBrokerService, createBrokerService } from './brokerService';
import { AngelOneBrokerService } from '../services/angelOneBroker';
import { env } from '../config/env';
import logger from '../utils/logger';

let activeBroker: IBrokerService | null = null;

/**
 * Get the current broker instance. Creates a paper broker if none exists.
 */
export function getBrokerInstance(): IBrokerService {
    if (!activeBroker) {
        activeBroker = createBrokerService();
        logger.info('Created default broker instance (paper)');
    }
    return activeBroker;
}

/**
 * Set a new broker instance (e.g., after Angel One login).
 * Pass null to reset to paper broker.
 */
export function setBrokerInstance(broker: IBrokerService | null): void {
    activeBroker = broker;
    if (broker) {
        logger.info('Active broker instance updated');
    } else {
        logger.info('Broker instance cleared — will use paper broker');
    }
}

/**
 * Check if a live (non-paper) broker is active.
 */
export function isLiveBrokerActive(): boolean {
    return activeBroker !== null && !(activeBroker instanceof PaperBrokerService);
}

/**
 * Auto-connect to Angel One on startup if TRADING_MODE is 'live'
 * and all required Angel One credentials are present.
 * Call this once during server startup.
 */
export async function autoConnectBroker(): Promise<void> {
    if (env.TRADING_MODE !== 'live') {
        logger.info(`Trading mode: ${env.TRADING_MODE} — using paper broker`);
        return;
    }

    const { ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PASSWORD, ANGEL_TOTP_SECRET } = env;

    if (!ANGEL_API_KEY || !ANGEL_CLIENT_ID || !ANGEL_PASSWORD || !ANGEL_TOTP_SECRET) {
        logger.warn('TRADING_MODE=live but Angel One credentials are incomplete. Falling back to paper broker.\n' +
            'Required: ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PASSWORD (or ANGEL_MPIN), ANGEL_TOTP_SECRET');
        return;
    }

    try {
        logger.info('Auto-connecting to Angel One (TRADING_MODE=live)...');
        const broker = new AngelOneBrokerService({
            apiKey: ANGEL_API_KEY,
            clientId: ANGEL_CLIENT_ID,
            password: ANGEL_PASSWORD,
            totpSecret: ANGEL_TOTP_SECRET,
        });
        await broker.login();
        setBrokerInstance(broker);
        logger.info('✅ Angel One auto-connected successfully. Live trading is ACTIVE.');
    } catch (error: any) {
        logger.error('❌ Angel One auto-connect failed. Falling back to paper broker.', {
            error: error.message,
        });
    }
}
