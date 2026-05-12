import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

type ExpirableJwtPayload = {
    exp?: number;
};

@Injectable()
export class JwtTokenService {
    constructor(private readonly jwtService: JwtService) {}

    resolveExpirationDate(token: string, fallback: Date): Date {
        const exp = this.decodeExpirationTimestamp(token);
        return exp ? new Date(exp * 1000) : fallback;
    }

    resolveMaxAgeMs(token: string, fallbackDuration: string): number {
        const exp = this.decodeExpirationTimestamp(token);
        return exp ? Math.max(1000, exp * 1000 - Date.now()) : this.parseDurationMs(fallbackDuration);
    }

    private decodeExpirationTimestamp(token: string): number | null {
        const decoded = this.jwtService.decode<ExpirableJwtPayload>(token);
        return decoded?.exp ?? null;
    }

    private parseDurationMs(duration: string): number {
        const match = /^(\d+)(s|m|h|d|w)$/.exec(duration);
        if (!match) return 60 * 60 * 1000;

        const units: Record<string, number> = {
            s: 1_000,
            m: 60_000,
            h: 60 * 60_000,
            d: 24 * 60 * 60_000,
            w: 7 * 24 * 60 * 60_000,
        };

        return Number.parseInt(match[1], 10) * (units[match[2]] ?? units.h);
    }
}
