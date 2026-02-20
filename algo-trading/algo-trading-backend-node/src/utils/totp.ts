// ============================================================
// TOTP GENERATOR — Time-based One-Time Password (RFC 6238)
// ============================================================
// Used for Angel One SmartAPI TOTP authentication.
// Uses `otpauth` — a production-tested TOTP library.
// Fetches accurate network time to avoid system clock drift.
// ============================================================

import { TOTP, Secret } from 'otpauth';
import logger from './logger';

/** Cached time offset (network time - system time) in milliseconds */
let cachedTimeOffset: number | null = null;
let lastOffsetFetch = 0;
const OFFSET_CACHE_MS = 5 * 60 * 1000; // Re-fetch every 5 minutes

/**
 * Fetch accurate time from a reliable HTTP server's Date header.
 * Returns the offset in ms: (serverTime - localTime).
 */
async function fetchTimeOffset(): Promise<number> {
    // Return cached offset if fresh
    if (cachedTimeOffset !== null && Date.now() - lastOffsetFetch < OFFSET_CACHE_MS) {
        return cachedTimeOffset;
    }

    const servers = [
        'https://www.google.com',
        'https://worldtimeapi.org/api/ip',
        'https://apiconnect.angelone.in',
    ];

    for (const url of servers) {
        try {
            const before = Date.now();
            const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
            const after = Date.now();
            const dateHeader = res.headers.get('date');
            if (dateHeader) {
                const serverTime = new Date(dateHeader).getTime();
                const localTime = (before + after) / 2; // midpoint for accuracy
                const offset = serverTime - localTime;
                cachedTimeOffset = offset;
                lastOffsetFetch = Date.now();
                logger.info('Time offset fetched', {
                    source: url,
                    offsetMs: Math.round(offset),
                    offsetSec: Math.round(offset / 1000),
                    serverTimeUTC: new Date(serverTime).toISOString(),
                    localTimeUTC: new Date(localTime).toISOString(),
                });
                return offset;
            }
        } catch (err) {
            logger.warn(`Failed to fetch time from ${url}: ${err}`);
        }
    }

    logger.warn('Could not fetch network time from any server, using system clock');
    return 0;
}

/**
 * Generate a 6-digit TOTP code from a base32-encoded secret.
 * Uses network-corrected time to handle system clock drift.
 * Compatible with Google Authenticator / Angel One TOTP.
 */
export async function generateTOTP(secret: string): Promise<string> {
    // Clean the secret: remove spaces, hyphens, and padding
    const cleaned = secret.replace(/[\s\-=]/g, '').toUpperCase();

    // Get accurate time offset from network
    const offsetMs = await fetchTimeOffset();
    const accurateNow = Date.now() + offsetMs;

    const totp = new TOTP({
        secret: Secret.fromBase32(cleaned),
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
    });

    // Generate with corrected timestamp
    const code = totp.generate({ timestamp: accurateNow });
    const timeCounter = Math.floor(accurateNow / 1000 / 30);

    logger.info('TOTP generated', {
        secretLength: cleaned.length,
        secretPrefix: cleaned.substring(0, 3) + '***',
        codeLength: code.length,
        timeCounter,
        systemTimeUTC: new Date().toISOString(),
        correctedTimeUTC: new Date(accurateNow).toISOString(),
        clockOffsetSec: Math.round(offsetMs / 1000),
    });

    return code;
}
