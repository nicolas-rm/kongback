import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { AppConfigService } from '@/configurations/app-config.service';
import { JwtTokenService } from '@/modules/authentication/services/jwt-token.service';

@Injectable()
export class AuthCookiesService {
    constructor(
        private readonly config: AppConfigService,
        private readonly jwtTokenService: JwtTokenService
    ) {}

    setAuthCookies(response: Response, accessToken: string, refreshToken: string): void {
        const secure = this.config.nodeEnv === 'production';
        const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };

        response.cookie('access_token', accessToken, { ...base, maxAge: this.jwtTokenService.resolveMaxAgeMs(accessToken, this.config.jwt.accessExpiresIn) });
        response.cookie('refresh_token', refreshToken, { ...base, maxAge: this.jwtTokenService.resolveMaxAgeMs(refreshToken, this.config.jwt.refreshExpiresIn) });
    }

    clearAuthCookies(response: Response): void {
        const secure = this.config.nodeEnv === 'production';
        const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };

        response.clearCookie('access_token', base);
        response.clearCookie('refresh_token', base);
    }
}
