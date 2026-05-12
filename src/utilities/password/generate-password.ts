import { generate } from 'generate-password';

export function generateSecurePassword(): string {
    return generate({
        length: 12,
        numbers: true,
        uppercase: true,
        lowercase: true,
        symbols: false,
        strict: true,
        excludeSimilarCharacters: true,
    });
}
