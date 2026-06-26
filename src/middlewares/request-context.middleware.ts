import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('RequestContext');

export function requestContextMiddleware(request: Request, response: Response, next: NextFunction): void {
    const startedAt = Date.now();
    const requestId = request.header('x-request-id') ?? randomUUID();

    response.setHeader('X-Request-Id', requestId);
    response.on('finish', () => {
        const durationMs = Date.now() - startedAt;
        logger.log(`${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms requestId=${requestId}`);
    });

    next();
}
