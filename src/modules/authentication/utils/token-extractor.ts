import type { Request } from 'express';

export function extractAccessTokenFromRequest(request: Request): string | null {
    return getCookieToken(request, 'access_token') ?? getBearerToken(request);
}

export function extractRefreshTokenFromRequest(request: Request): string | undefined {
    return getCookieToken(request, 'refresh_token') ?? undefined;
}

function getCookieToken(request: Request, name: string): string | null {
    const token = (request.cookies as Record<string, string> | undefined)?.[name];
    return token || null;
}

function getBearerToken(request: Request): string | null {
    const authorization = request.get('authorization');
    return authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null;
}
