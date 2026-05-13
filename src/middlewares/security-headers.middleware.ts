import type { NextFunction, Request, Response } from 'express';

export function securityHeadersMiddleware(isProduction: boolean) {
    return (_request: Request, response: Response, next: NextFunction) => {
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('X-Frame-Options', 'DENY');
        response.setHeader('Referrer-Policy', 'no-referrer');
        response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
        response.setHeader('X-DNS-Prefetch-Control', 'off');

        if (isProduction) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

        next();
    };
}
