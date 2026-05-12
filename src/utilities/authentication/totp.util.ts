import { createHmac, randomBytes } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type VerifyTotpOptions = {
    digits?: number;
    periodSeconds?: number;
    window?: number;
    at?: Date;
};

export function generateTotpSecret(bytesLength = 20): string {
    return base32Encode(randomBytes(Math.max(10, bytesLength)));
}

export function buildTotpOtpAuthUrl(input: { secret: string; accountName: string; issuer: string; digits?: number; periodSeconds?: number }): string {
    const digits = input.digits ?? 6;
    const periodSeconds = input.periodSeconds ?? 30;
    const label = `${input.issuer}:${input.accountName}`;

    return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(input.secret)}&issuer=${encodeURIComponent(input.issuer)}&algorithm=SHA1&digits=${digits}&period=${periodSeconds}`;
}

export function verifyTotpCode(secret: string, inputCode: string, options: VerifyTotpOptions = {}): boolean {
    const normalizedCode = String(inputCode ?? '').replace(/\D/g, '');
    const digits = options.digits ?? 6;
    if (normalizedCode.length !== digits) return false;

    const secretBytes = base32Decode(secret);
    if (secretBytes.length === 0) return false;

    const periodSeconds = options.periodSeconds ?? 30;
    const window = options.window ?? 1;
    const counter = Math.floor((options.at ?? new Date()).getTime() / 1000 / periodSeconds);

    for (let offset = -window; offset <= window; offset += 1) {
        if (counter + offset < 0) continue;
        if (timingSafeStringEquals(generateTotpCode(secretBytes, counter + offset, digits), normalizedCode)) return true;
    }

    return false;
}

export function generateRecoveryCodes(count = 8): string[] {
    const codes = new Set<string>();
    while (codes.size < Math.max(1, count)) codes.add(generateRecoveryCode());
    return [...codes];
}

export function normalizeRecoveryCode(code: string): string {
    return String(code ?? '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function generateRecoveryCode(): string {
    const chars = Array.from({ length: 8 }, () => RECOVERY_ALPHABET[randomBytes(1)[0] % RECOVERY_ALPHABET.length]);
    return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

function generateTotpCode(secretBytes: Buffer, counter: number, digits: number): string {
    const counterBytes = Buffer.alloc(8);
    counterBytes.writeUInt32BE(Math.floor(counter / 0x1_0000_0000) >>> 0, 0);
    counterBytes.writeUInt32BE(counter >>> 0, 4);

    const digest = createHmac('sha1', secretBytes).update(counterBytes).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);

    return (binary % 10 ** digits).toString().padStart(digits, '0');
}

function base32Encode(bytes: Buffer): string {
    const binary = [...bytes].map((byte) => byte.toString(2).padStart(8, '0')).join('');
    let output = '';

    for (let index = 0; index < binary.length; index += 5) {
        output += BASE32_ALPHABET[parseInt(binary.slice(index, index + 5).padEnd(5, '0'), 2)];
    }

    return output;
}

function base32Decode(input: string): Buffer {
    const normalized = String(input ?? '')
        .toUpperCase()
        .replace(/=+$/g, '')
        .replace(/\s+/g, '');
    const binary = normalized
        .split('')
        .map((char) => {
            const index = BASE32_ALPHABET.indexOf(char);
            return index >= 0 ? index.toString(2).padStart(5, '0') : '';
        })
        .join('');
    const bytes: number[] = [];

    for (let index = 0; index + 8 <= binary.length; index += 8) {
        bytes.push(parseInt(binary.slice(index, index + 8), 2));
    }

    return Buffer.from(bytes);
}

function timingSafeStringEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
    return mismatch === 0;
}
