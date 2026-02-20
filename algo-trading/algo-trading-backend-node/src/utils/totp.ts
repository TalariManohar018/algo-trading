// ============================================================
// TOTP GENERATOR — Time-based One-Time Password (RFC 6238)
// ============================================================
// Used for Angel One SmartAPI TOTP authentication.
// Uses `otpauth` — a production-tested TOTP library.
// ============================================================

import { TOTP, Secret } from 'otpauth';

/**
 * Generate a 6-digit TOTP code from a base32-encoded secret.
 * Compatible with Google Authenticator / Angel One TOTP.
 */
export function generateTOTP(secret: string): string {
    // Clean the secret: remove spaces, hyphens, and padding
    const cleaned = secret.replace(/[\s\-=]/g, '').toUpperCase();

    const totp = new TOTP({
        secret: Secret.fromBase32(cleaned),
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
    });

    return totp.generate();
}
