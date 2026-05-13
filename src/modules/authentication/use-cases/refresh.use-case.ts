import { Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nUnauthorizedException } from '@/i18n';
import { RefreshTokenDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { AuthenticationTokensService } from '@/modules/authentication/services/authentication-tokens.service';
import type { SessionContext } from '@/modules/authentication/types/session-context.interface';

@Injectable()
export class RefreshUseCase {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService,
        private readonly authenticationTokensService: AuthenticationTokensService
    ) {}

    async execute(dto: RefreshTokenDto, sessionContext: SessionContext = {}) {
        if (!dto.refreshToken) throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.invalidRefreshToken, 'Refresh token invalido');

        const storedToken = await this.repository.findStoredRefreshToken(this.cryptoService.hashToken(dto.refreshToken));
        if (!storedToken) throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.invalidRefreshToken, 'Refresh token invalido');

        if (storedToken.revokedAt) {
            await this.repository.revokeSession(storedToken.userId, storedToken.sessionId);
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.reusedRefreshToken, 'Refresh token reutilizado');
        }

        if (storedToken.user.status !== UserStatus.active || storedToken.session.revokedAt) throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.invalidRefreshToken, 'Refresh token invalido');

        const now = new Date();
        if (storedToken.expiresAt <= now || storedToken.idleExpiresAt <= now || storedToken.session.expiresAt <= now || storedToken.session.idleExpiresAt <= now) {
            await this.repository.revokeRefreshToken(storedToken.id, now);
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.expiredRefreshToken, 'Refresh token expirado');
        }

        await this.repository.revokeRefreshToken(storedToken.id, now);
        const idleExpiresAt = new Date(now.getTime() + this.config.session.idleTimeoutMinutes * 60 * 1000);
        await this.repository.touchSession(storedToken.sessionId, idleExpiresAt, now);

        return this.authenticationTokensService.issueTokensForSession(
            { id: storedToken.user.id, username: storedToken.user.username },
            storedToken.sessionId,
            storedToken.session.expiresAt,
            idleExpiresAt,
            {
                userAgent: sessionContext.userAgent,
                ipAddress: sessionContext.ipAddress,
                deviceName: sessionContext.deviceName,
            }
        );
    }
}
