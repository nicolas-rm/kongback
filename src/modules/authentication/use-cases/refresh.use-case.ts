import { Injectable } from '@nestjs/common';
import { Status } from '@prisma/client';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, type I18nKey, I18nUnauthorizedException } from '@/i18n';
import { AuditService } from '@/modules/audit/audit.service';
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
        private readonly authenticationTokensService: AuthenticationTokensService,
        private readonly audit: AuditService
    ) {}

    async execute(dto: RefreshTokenDto, sessionContext: SessionContext = {}) {
        if (!dto.refreshToken) {
            void this.audit.recordSecurity({ action: 'refresh_token_missing', result: 'denied', statusCode: 401, reason: 'missing_refresh_token' });
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.invalidRefreshToken, 'Tu sesion no es valida. Inicia sesion nuevamente.', {
                extra: { reason: 'missing_refresh_token' },
            });
        }

        const storedToken = await this.repository.findStoredRefreshToken(this.cryptoService.hashToken(dto.refreshToken));
        if (!storedToken) {
            void this.audit.recordSecurity({ action: 'refresh_token_invalid', result: 'denied', statusCode: 401, reason: 'refresh_token_not_found' });
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.invalidRefreshToken, 'Tu sesion no es valida. Inicia sesion nuevamente.', {
                extra: { reason: 'refresh_token_not_found' },
            });
        }

        if (storedToken.revokedAt) {
            await this.repository.revokeSession(storedToken.userId, storedToken.sessionId);
            void this.audit.recordSecurity({
                action: 'refresh_token_reused',
                result: 'denied',
                statusCode: 401,
                reason: 'refresh_token_reused',
                metadata: { userId: storedToken.userId, sessionId: storedToken.sessionId },
            });
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.reusedRefreshToken, 'Por seguridad cerramos tu sesion. Inicia sesion nuevamente.', {
                extra: { reason: 'refresh_token_reused' },
            });
        }

        if (storedToken.user.status !== Status.active) {
            void this.audit.recordSecurity({ action: 'refresh_token_invalid', result: 'denied', statusCode: 401, reason: 'user_inactive', metadata: { userId: storedToken.userId } });
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.invalidRefreshToken, 'Tu sesion no es valida. Inicia sesion nuevamente.', { extra: { reason: 'user_inactive' } });
        }
        if (storedToken.session.revokedAt) {
            void this.audit.recordSecurity({
                action: 'refresh_token_invalid',
                result: 'denied',
                statusCode: 401,
                reason: 'session_revoked',
                metadata: { userId: storedToken.userId, sessionId: storedToken.sessionId },
            });
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.invalidRefreshToken, 'Tu sesion no es valida. Inicia sesion nuevamente.', { extra: { reason: 'session_revoked' } });
        }

        const now = new Date();
        if (storedToken.expiresAt <= now || storedToken.idleExpiresAt <= now || storedToken.session.expiresAt <= now || storedToken.session.idleExpiresAt <= now) {
            await this.repository.revokeRefreshToken(storedToken.id, now);
            const error = this.resolveExpiredRefreshError(storedToken, now);
            void this.audit.recordSecurity({
                action: error.reason,
                result: 'denied',
                statusCode: 401,
                reason: error.reason,
                metadata: { userId: storedToken.userId, sessionId: storedToken.sessionId },
            });
            throw new I18nUnauthorizedException(error.key, error.message, { extra: { reason: error.reason } });
        }

        await this.repository.revokeRefreshToken(storedToken.id, now);
        const idleExpiresAt = new Date(now.getTime() + this.config.session.idleTimeoutMinutes * 60 * 1000);
        await this.repository.touchSession(storedToken.sessionId, idleExpiresAt, now);

        void this.audit.recordSecurity({
            action: 'refresh_token_used',
            result: 'success',
            metadata: { userId: storedToken.user.id, sessionId: storedToken.sessionId, idleExpiresAt },
        });
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

    private resolveExpiredRefreshError(
        storedToken: {
            expiresAt: Date;
            idleExpiresAt: Date;
            session: {
                expiresAt: Date;
                idleExpiresAt: Date;
            };
        },
        now: Date
    ): { key: I18nKey; message: string; reason: string } {
        if (storedToken.expiresAt <= now) {
            return { key: I18N_KEYS.errors.authentication.expiredRefreshToken, message: 'Tu sesion expiro. Inicia sesion nuevamente.', reason: 'refresh_token_expired' };
        }
        if (storedToken.idleExpiresAt <= now || storedToken.session.idleExpiresAt <= now) {
            return {
                key: I18N_KEYS.errors.authentication.sessionIdleExpired,
                message: 'Tu sesion expiro por inactividad. Inicia sesion nuevamente.',
                reason: storedToken.idleExpiresAt <= now ? 'refresh_token_idle_expired' : 'session_idle_expired',
            };
        }
        return { key: I18N_KEYS.errors.authentication.sessionExpired, message: 'Tu sesion expiro. Inicia sesion nuevamente.', reason: 'session_expired' };
    }
}
