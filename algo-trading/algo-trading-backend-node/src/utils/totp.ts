// ============================================================
// TOTP GENERATOR — Time-based One-Time Password (RFC 6238)
// ============================================================
// Used for Angel One SmartAPI TOTP authentication.
// Pure implementation — no external dependencies.
// ============================================================

import crypto from 'crypto';

/**
 * Generate a 6-digit TOTP code from a base32-encoded secret.
 * Compatible with Google Authenticator / Angel One TOTP.
 */
export function generateTOTP(secret: string, timeStep = 30, digits = 6): string {
    const key = base32Decode(secret);
    const time = Math.floor(Date.now() / 1000 / timeStep);

    // Convert time to 8-byte big-endian buffer
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(0, 0);
    timeBuffer.writeUInt32BE(time, 4);

    // HMAC-SHA1
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0x0f;
    const code =
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);

    const otp = code % Math.pow(10, digits);
    return otp.toString().padStart(digits, '0');
}

/**
 * Decode a base32-encoded string to a Buffer
 */
function base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = encoded.replace(/[\s=-]/g, '').toUpperCase();

    let bits = '';
    for (const char of cleaned) {
        const val = alphabet.indexOf(char);
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }

    return Buffer.from(bytes);
}
