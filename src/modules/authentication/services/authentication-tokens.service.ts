import { Injectable } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { JwtTokenService } from '@/modules/authentication/services/jwt-token.service';

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
export class AuthenticationTokensService {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: AuthenticationRepository,
        private readonly jwtService: JwtService,
        private readonly jwtTokenService: JwtTokenService,
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

        await this.repository.enforceActiveSessionLimit(user.id, session.id, this.config.session.maxActiveSessions);

        return this.issueTokensForSession(user, session.id, expiresAt, idleExpiresAt, sessionContext);
    }

    async issueTokensForSession(user: TokenUser, sessionId: string, expiresAt: Date, idleExpiresAt: Date, sessionContext: SessionContext = {}) {
        const accessToken = await this.jwtService.signAsync(
            { sub: user.id, username: user.username, sessionId },
            {
                secret: this.config.jwt.accessSecret,
                expiresIn: this.config.jwt.accessExpiresIn as JwtSignOptions['expiresIn'],
            }
        );

        const refreshToken = await this.jwtService.signAsync(
            { sub: user.id, sessionId },
            {
                secret: this.config.jwt.refreshSecret,
                expiresIn: this.config.jwt.refreshExpiresIn as JwtSignOptions['expiresIn'],
            }
        );

        await this.repository.createRefreshToken({
            userId: user.id,
            sessionId,
            tokenHash: this.cryptoService.hashToken(refreshToken),
            expiresAt: this.jwtTokenService.resolveExpirationDate(refreshToken, expiresAt),
            idleExpiresAt,
            userAgent: sessionContext.userAgent ?? null,
            ipAddress: sessionContext.ipAddress ?? null,
        });

        return { accessToken, refreshToken, sessionId };
    }
}
