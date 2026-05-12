import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { AppConfigService } from '@/configurations/app-config.service';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

@Injectable()
export class CryptoService {
    constructor(private readonly config: AppConfigService) {}

    hashPassword(password: string): Promise<string> {
        return argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
        });
    }

    async verifyPassword(hash: string, password: string): Promise<boolean> {
        try {
            return await argon2.verify(hash, password);
        } catch {
            return false;
        }
    }

    hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }

    encrypt(plaintext: string): string {
        const key = Buffer.from(this.config.encryption.key, 'hex');
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();

        return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
    }

    decrypt(ciphertext: string): string | null {
        try {
            const [ivHex, tagHex, encHex] = ciphertext.split(':');
            if (!ivHex || !tagHex || !encHex) return null;

            const key = Buffer.from(this.config.encryption.key, 'hex');
            const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
            decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

            return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8');
        } catch {
            return null;
        }
    }
}
