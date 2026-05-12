import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AppConfigService } from '@/configurations/app-config.service';

@Injectable()
export class AuthCookiesService {
    constructor(
        private readonly config: AppConfigService,
        private readonly jwtService: JwtService
    ) {}

    setAuthCookies(response: Response, accessToken: string, refreshToken: string): void {
        const secure = this.config.nodeEnv === 'production';
        const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };

        response.cookie('access_token', accessToken, { ...base, maxAge: this.resolveTokenMaxAgeMs(accessToken, this.config.jwt.accessExpiresIn) });
        response.cookie('refresh_token', refreshToken, { ...base, maxAge: this.resolveTokenMaxAgeMs(refreshToken, this.config.jwt.refreshExpiresIn) });
    }

    clearAuthCookies(response: Response): void {
        const secure = this.config.nodeEnv === 'production';
        const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };

        response.clearCookie('access_token', base);
        response.clearCookie('refresh_token', base);
    }

    private resolveTokenMaxAgeMs(token: string, fallbackDuration: string): number {
        const decoded = this.jwtService.decode<{ exp?: number }>(token);
        return decoded?.exp ? Math.max(1000, decoded.exp * 1000 - Date.now()) : this.parseDurationMs(fallbackDuration);
    }

    private parseDurationMs(duration: string): number {
        const match = /^(\d+)(s|m|h|d|w)$/.exec(duration);
        if (!match) return 60 * 60 * 1000;

        const units: Record<string, number> = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 };
        return parseInt(match[1], 10) * (units[match[2]] ?? 36e5);
    }
}
