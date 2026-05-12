import { Injectable } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

type TokenUser = {
    id: string;
    username: string;
};

type SessionContext = {
    userAgent?: string | null;
    ipAddress?: string | null;
    organizationId?: string | null;
    deviceName?: string | null;
};

@Injectable()
export class AuthTokensService {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: AuthenticationRepository,
        private readonly jwtService: JwtService,
        private readonly cryptoService: CryptoService
    ) {}

    async issueTokens(user: TokenUser, sessionContext: SessionContext = {}) {
        const now = Date.now();
        const expiresAt = new Date(now + this.config.session.totalMinutes * 60 * 1000);
        const idleExpiresAt = new Date(now + this.config.session.idleTimeoutMinutes * 60 * 1000);

        const session = await this.repository.createSession({
            userId: user.id,
            organizationId: sessionContext.organizationId ?? null,
            expiresAt,
            idleExpiresAt,
            userAgent: sessionContext.userAgent ?? null,
            ipAddress: sessionContext.ipAddress ?? null,
            deviceName: sessionContext.deviceName ?? null,
        });

        const accessToken = await this.jwtService.signAsync(
            { sub: user.id, username: user.username, sessionId: session.id },
            {
                secret: this.config.jwt.accessSecret,
                expiresIn: this.config.jwt.accessExpiresIn as JwtSignOptions['expiresIn'],
            }
        );

        const refreshToken = await this.jwtService.signAsync(
            { sub: user.id, sessionId: session.id },
            {
                secret: this.config.jwt.refreshSecret,
                expiresIn: this.config.jwt.refreshExpiresIn as JwtSignOptions['expiresIn'],
            }
        );

        await this.repository.createRefreshToken({
            userId: user.id,
            sessionId: session.id,
            tokenHash: this.cryptoService.hashToken(refreshToken),
            expiresAt: this.resolveTokenExpirationDate(refreshToken, expiresAt),
            idleExpiresAt,
            userAgent: sessionContext.userAgent ?? null,
            ipAddress: sessionContext.ipAddress ?? null,
        });

        return { accessToken, refreshToken, sessionId: session.id };
    }

    private resolveTokenExpirationDate(token: string, fallback: Date): Date {
        const decoded = this.jwtService.decode<{ exp?: number }>(token);
        return decoded?.exp ? new Date(decoded.exp * 1000) : fallback;
    }
}
