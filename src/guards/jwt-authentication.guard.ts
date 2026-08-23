import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '@/decorators/public.decorator';
import { I18N_KEYS, I18nUnauthorizedException } from '@/i18n';
import { extractAccessTokenFromRequest } from '@/modules/authentication/utils/token-extractor';
import { AuditService } from '@/modules/audit/audit.service';

@Injectable()
export class JwtAuthenticationGuard extends AuthGuard('jwt') {
    constructor(
        private readonly reflector: Reflector,
        private readonly audit: AuditService
    ) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
        if (isPublic) return true;
        return super.canActivate(context);
    }

    handleRequest<TUser = unknown>(err: unknown, user: TUser, info: unknown, context: ExecutionContext): TUser {
        if (user) return user;
        if (err instanceof I18nUnauthorizedException) throw err;

        const request = context.switchToHttp().getRequest<Request>();
        const message = err instanceof Error ? err.message : info instanceof Error ? info.message : 'Tu sesion no es valida. Inicia sesion nuevamente.';
        const reason = this.resolveUnauthorizedReason(message, this.getAccessToken(request));
        void this.audit.recordSecurity({
            action: reason,
            result: 'denied',
            statusCode: 401,
            reason,
            metadata: {
                path: request.originalUrl,
                method: request.method,
            },
        });
        if (reason === 'access_token_expired') {
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.sessionExpired, 'Tu sesion expiro. Inicia sesion nuevamente.', { extra: { reason } });
        }
        throw new I18nUnauthorizedException(I18N_KEYS.errors.authorization.unauthorized, 'Tu sesion no es valida. Inicia sesion nuevamente.', { extra: { reason } });
    }

    private getAccessToken(request: Request): string | null {
        return extractAccessTokenFromRequest(request);
    }

    private resolveUnauthorizedReason(message: string, accessToken: string | null) {
        const normalized = message.toLowerCase();
        if (!accessToken || normalized.includes('no auth token') || normalized.includes('no authentication token')) return 'missing_access_token';
        if (normalized.includes('jwt expired')) return 'access_token_expired';
        return 'access_token_invalid';
    }
}
