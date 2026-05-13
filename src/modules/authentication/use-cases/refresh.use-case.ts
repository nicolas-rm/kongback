import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { RefreshTokenDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { AuthTokensService } from '@/modules/authentication/services/auth-tokens.service';
import type { SessionContext } from '@/modules/authentication/types/session-context.interface';

@Injectable()
export class RefreshUseCase {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService,
        private readonly authTokensService: AuthTokensService
    ) {}

    async execute(dto: RefreshTokenDto, sessionContext: SessionContext = {}) {
        if (!dto.refreshToken) throw new UnauthorizedException('Refresh token invalido');

        const storedToken = await this.repository.findStoredRefreshToken(this.cryptoService.hashToken(dto.refreshToken));
        if (!storedToken) throw new UnauthorizedException('Refresh token invalido');

        if (storedToken.revokedAt) {
            await this.repository.revokeSession(storedToken.userId, storedToken.sessionId);
            throw new UnauthorizedException('Refresh token reutilizado');
        }

        if (storedToken.user.status !== UserStatus.active || storedToken.session.revokedAt) throw new UnauthorizedException('Refresh token invalido');

        const now = new Date();
        if (storedToken.expiresAt <= now || storedToken.idleExpiresAt <= now || storedToken.session.expiresAt <= now || storedToken.session.idleExpiresAt <= now) {
            await this.repository.revokeRefreshToken(storedToken.id, now);
            throw new UnauthorizedException('Refresh token expirado');
        }

        await this.repository.revokeRefreshToken(storedToken.id, now);
        await this.repository.touchSession(storedToken.sessionId, new Date(now.getTime() + this.config.session.idleTimeoutMinutes * 60 * 1000), now);

        return this.authTokensService.issueTokens(
            { id: storedToken.user.id, username: storedToken.user.username },
            {
                userAgent: sessionContext.userAgent,
                ipAddress: sessionContext.ipAddress,
                deviceName: sessionContext.deviceName,
            }
        );
    }
}
