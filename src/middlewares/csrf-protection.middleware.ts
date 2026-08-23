import { HttpStatus } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '@/errors/error-codes';
import { buildErrorResponse } from '@/errors/error-response';
import type { AuditService } from '@/modules/audit/audit.service';

type CsrfProtectionOptions = {
    allowedOrigins: string[];
    audit?: AuditService;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtectionMiddleware(options: CsrfProtectionOptions) {
    const allowedOrigins = new Set(options.allowedOrigins.map(normalizeOrigin).filter((origin): origin is string => Boolean(origin)));

    return (request: Request, response: Response, next: NextFunction): void => {
        if (SAFE_METHODS.has(request.method)) return next();
        if (!usesCookieAuthentication(request)) return next();

        const requestOrigin = resolveRequestOrigin(request);
        if (requestOrigin && allowedOrigins.has(requestOrigin)) return next();

        void options.audit?.recordSecurity({
            action: 'csrf_rejected',
            result: 'denied',
            statusCode: HttpStatus.FORBIDDEN,
            reason: 'origin_not_allowed',
            metadata: {
                origin: request.get('origin') ?? null,
                referer: request.get('referer') ?? null,
                method: request.method,
                path: request.originalUrl,
            },
        });

        response.status(HttpStatus.FORBIDDEN).json(
            buildErrorResponse({
                statusCode: HttpStatus.FORBIDDEN,
                code: ERROR_CODES.FORBIDDEN,
                message: 'No pudimos validar la seguridad de la solicitud. Recarga la pagina e intenta nuevamente.',
                path: request.originalUrl,
            })
        );
    };
}

function usesCookieAuthentication(request: Request): boolean {
    const accessToken = (request.cookies as Record<string, string> | undefined)?.access_token;
    const authorization = request.get('authorization');
    return Boolean(accessToken) && !authorization?.startsWith('Bearer ');
}

function resolveRequestOrigin(request: Request): string | null {
    return normalizeOrigin(request.get('origin')) ?? normalizeOrigin(request.get('referer'));
}

function normalizeOrigin(value: string | undefined): string | null {
    if (!value) return null;

    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}
