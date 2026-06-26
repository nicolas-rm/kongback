import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { AppConfigService } from '@/configurations/app-config.service';
import { I18N_KEYS, I18nUnauthorizedException } from '@/i18n';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

type JwtPayload = {
    sub: string;
    sessionId?: string;
};

export type SocketAuthenticationUser = {
    id: string;
    username: string;
};

@Injectable()
export class NotificationsSocketAuthenticationService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly config: AppConfigService,
        private readonly authenticationRepository: AuthenticationRepository
    ) {}

    async authenticate(client: Socket): Promise<SocketAuthenticationUser> {
        this.assertAllowedOrigin(client);
        const accessToken = this.getAccessToken(client);
        if (!accessToken) throw new I18nUnauthorizedException(I18N_KEYS.errors.authorization.unauthorized, 'No autorizado');

        const payload = await this.verifyAccessToken(accessToken);
        if (payload.sessionId) {
            const session = await this.authenticationRepository.findActiveSession(payload.sessionId);
            if (!session || session.userId !== payload.sub) throw new I18nUnauthorizedException(I18N_KEYS.errors.authorization.unauthorized, 'No autorizado');
        }

        const user = await this.authenticationRepository.findActiveUserForRequest(payload.sub);
        if (!user) throw new I18nUnauthorizedException(I18N_KEYS.errors.authorization.unauthorized, 'No autorizado');

        return { id: user.id, username: user.username };
    }

    private assertAllowedOrigin(client: Socket): void {
        const origin = this.normalizeOrigin(client.handshake.headers.origin);
        if (!origin) return;

        const allowedOrigins = new Set([this.config.webUrl, ...this.config.security.allowedOrigins].map((value) => this.normalizeOrigin(value)).filter((value): value is string => Boolean(value)));
        if (!allowedOrigins.has(origin)) throw new I18nUnauthorizedException(I18N_KEYS.errors.authorization.unauthorized, 'No autorizado');
    }

    private async verifyAccessToken(accessToken: string): Promise<JwtPayload> {
        try {
            return await this.jwtService.verifyAsync<JwtPayload>(accessToken, { secret: this.config.jwt.accessSecret });
        } catch {
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authorization.unauthorized, 'No autorizado');
        }
    }

    private getAccessToken(client: Socket): string | null {
        const authenticationToken = typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : null;
        if (authenticationToken) return authenticationToken;

        const cookieHeader = client.handshake.headers.cookie;
        if (!cookieHeader) return null;

        const cookies = Object.fromEntries(
            cookieHeader
                .split(';')
                .map((cookie) => cookie.trim().split('='))
                .filter(([name, value]) => name && value)
                .map(([name, value]) => [name, decodeURIComponent(value)])
        );

        return cookies.access_token ?? null;
    }

    private normalizeOrigin(value: string | string[] | undefined): string | null {
        const origin = Array.isArray(value) ? value[0] : value;
        if (!origin) return null;

        try {
            return new URL(origin).origin;
        } catch {
            return null;
        }
    }
}
