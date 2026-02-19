// ============================================================
// BROKER FACTORY — Global broker instance management
// ============================================================
// Manages the active broker instance (Paper or Angel One).
// The execution engine and routes use this to get the current broker.
// ============================================================

import { IBrokerService, PaperBrokerService, createBrokerService } from './brokerService';
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
