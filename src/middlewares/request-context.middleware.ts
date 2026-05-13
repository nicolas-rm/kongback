import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestContextMiddleware(request: Request, response: Response, next: NextFunction): void {
    const startedAt = Date.now();
    const requestId = request.header('x-request-id') ?? randomUUID();

    response.setHeader('X-Request-Id', requestId);
    response.on('finish', () => {
        const durationMs = Date.now() - startedAt;
        console.log(`${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms requestId=${requestId}`);
    });

    next();
}
