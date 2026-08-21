import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '@/configurations/app-config.service';
import { I18N_KEYS, type I18nKey, I18nUnauthorizedException } from '@/i18n';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { extractAccessTokenFromRequest } from '@/modules/authentication/utils/token-extractor';

type JwtPayload = {
    sub: string;
    username?: string;
    sessionId?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    private readonly logger = new Logger(JwtStrategy.name);

    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly config: AppConfigService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([extractAccessTokenFromRequest]),
            secretOrKey: config.jwt.accessSecret,
            passReqToCallback: false,
        });
    }

    async validate(payload: JwtPayload): Promise<RequestUser> {
        if (payload.sessionId) {
            const session = await this.repository.findSessionForAuthentication(payload.sessionId);
            if (!session) {
                this.rejectUnauthorized(I18N_KEYS.errors.authorization.unauthorized, 'Tu sesion no es valida. Inicia sesion nuevamente.', 'session_not_found', {
                    sessionId: payload.sessionId,
                    userId: payload.sub,
                });
            }
            if (session.userId !== payload.sub) {
                this.rejectUnauthorized(I18N_KEYS.errors.authorization.unauthorized, 'Tu sesion no es valida. Inicia sesion nuevamente.', 'session_user_mismatch', {
                    sessionId: session.id,
                    userId: payload.sub,
                });
            }

            const nowDate = new Date();
            if (session.revokedAt) {
                this.rejectUnauthorized(I18N_KEYS.errors.authorization.unauthorized, 'Tu sesion no es valida. Inicia sesion nuevamente.', 'session_revoked', {
                    sessionId: session.id,
                    userId: payload.sub,
                });
            }
            if (session.expiresAt <= nowDate) {
                this.rejectUnauthorized(I18N_KEYS.errors.authentication.sessionExpired, 'Tu sesion expiro. Inicia sesion nuevamente.', 'session_expired', {
                    sessionId: session.id,
                    userId: payload.sub,
                    expiresAt: session.expiresAt,
                });
            }
            if (session.idleExpiresAt <= nowDate) {
                this.rejectUnauthorized(I18N_KEYS.errors.authentication.sessionIdleExpired, 'Tu sesion expiro por inactividad. Inicia sesion nuevamente.', 'session_idle_expired', {
                    sessionId: session.id,
                    userId: payload.sub,
                    idleExpiresAt: session.idleExpiresAt,
                });
            }

            const now = Date.now();
            const touchEveryMs = this.config.session.touchIntervalSeconds * 1000;
            let idleExpiresAt = session.idleExpiresAt;
            if (now - session.lastActivityAt.getTime() >= touchEveryMs) {
                idleExpiresAt = new Date(now + this.config.session.idleTimeoutMinutes * 60 * 1000);
                await this.repository.touchSession(session.id, idleExpiresAt, new Date(now));
            }
            this.logger.log(
                `Sesion ${this.maskSessionId(session.id)} vence por inactividad en ${this.formatDuration(idleExpiresAt.getTime() - now)} idleExpiresAt=${idleExpiresAt.toISOString()}`
            );
        }

        const user = await this.repository.findActiveUserForRequest(payload.sub);

        if (!user) {
            this.rejectUnauthorized(I18N_KEYS.errors.authentication.unauthorizedUser, 'No pudimos validar tu usuario. Inicia sesion nuevamente.', 'user_not_active', { userId: payload.sub });
        }

        const companyIds = new Set<string>();
        let isGlobalAdmin = false;

        for (const access of user.accesses) {
            if (access.role.code === 'admin' && !access.companyId) isGlobalAdmin = true;
            if (access.companyId) companyIds.add(access.companyId);
        }

        return {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            preferredLanguage: user.preferredLanguage,
            status: user.status,
            emailVerified: Boolean(user.emailVerifiedAt),
            requiresEmailVerification: user.requiresEmailVerification,
            twoFactorEnabled: user.twoFactorEnabled,
            mustChangePassword: user.mustChangePassword,
            isGlobalAdmin,
            companyIds: [...companyIds],
            sessionId: payload.sessionId ?? null,
        };
    }

    private formatDuration(milliseconds: number): string {
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
        return `${minutes}m ${seconds}s`;
    }

    private maskSessionId(sessionId: string): string {
        return `${sessionId.slice(0, 8)}...${sessionId.slice(-4)}`;
    }

    private logUnauthorized(reason: string, message: string, context: { sessionId?: string; userId?: string; expiresAt?: Date; idleExpiresAt?: Date }): void {
        this.logger.warn(
            [
                `401 ${message}`,
                `reason=${reason}`,
                context.sessionId ? `session=${this.maskId(context.sessionId)}` : null,
                context.userId ? `user=${this.maskId(context.userId)}` : null,
                context.expiresAt ? `expiresAt=${context.expiresAt.toISOString()}` : null,
                context.idleExpiresAt ? `idleExpiresAt=${context.idleExpiresAt.toISOString()}` : null,
            ]
                .filter(Boolean)
                .join(' ')
        );
    }

    private rejectUnauthorized(
        key: I18nKey,
        message: string,
        reason: string,
        context: { sessionId?: string; userId?: string; expiresAt?: Date; idleExpiresAt?: Date }
    ): never {
        this.logUnauthorized(reason, message, context);
        throw new I18nUnauthorizedException(key, message, { extra: { reason } });
    }

    private maskId(id: string): string {
        return `${id.slice(0, 8)}...${id.slice(-4)}`;
    }
}
