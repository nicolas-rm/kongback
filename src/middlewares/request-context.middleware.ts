import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('RequestContextMiddleware');
const MAX_LOG_FIELD_LENGTH = 1_500;
const SENSITIVE_KEY_PATTERN = /authorization|cookie|password|token|secret|totp|otp|recovery|hash|cvv|nip|pan|cardNumber/i;

export function requestContextMiddleware(request: Request, response: Response, next: NextFunction): void {
    const startedAt = Date.now();
    const requestId = request.header('x-request-id') ?? randomUUID();

    response.setHeader('X-Request-Id', requestId);
    response.on('finish', () => {
        const durationMs = Date.now() - startedAt;
        const payloadFields = formatRequestPayloadFields(request);
        const requestFields = [`origin=${request.get('origin') ?? 'none'}`, `hasCookie=${request.get('cookie') ? 'true' : 'false'}`];
        const details = [formatIndentedFields(requestFields), formatIndentedFields(payloadFields)].filter(Boolean);

        logger.log([[`[${request.method}]`, request.originalUrl, response.statusCode, `${durationMs}ms`, `requestId=${requestId}`].join(' '), ...details].join('\n'));
    });

    next();
}

function formatIndentedFields(fields: string[]): string {
    return fields.length > 0 ? `  ${fields.join(' ')}` : '';
}

function formatRequestPayloadFields(request: Request): string[] {
    const includeEmptyFields = request.originalUrl.startsWith('/api/authentication');

    return [
        formatLogField('query', request.query, includeEmptyFields),
        formatLogField('body', request.body, includeEmptyFields),
        formatLogField('cookies', request.cookies, includeEmptyFields),
    ].filter(Boolean);
}

function formatLogField(name: string, value: unknown, includeEmpty = false): string {
    if (!hasLoggableValue(value)) {
        return includeEmpty ? `${name}={}` : '';
    }

    return `${name}=${stringifyLogValue(sanitizeLogValue(value))}`;
}

function hasLoggableValue(value: unknown): boolean {
    if (value === null || typeof value === 'undefined') {
        return false;
    }

    if (typeof value === 'string') {
        return value.length > 0;
    }

    if (Array.isArray(value)) {
        return value.length > 0;
    }

    if (typeof value === 'object') {
        return Object.keys(value).length > 0;
    }

    return true;
}

function sanitizeLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
    if (typeof value === 'string') {
        return truncateValue(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean' || value === null || typeof value === 'undefined') {
        return value;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Buffer.isBuffer(value)) {
        return `[buffer:${value.length}]`;
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeLogValue(item, seen));
    }

    if (typeof value === 'object') {
        if (seen.has(value)) {
            return '[circular]';
        }

        seen.add(value);

        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeLogValue(item, seen)]));
    }

    return String(value);
}

function stringifyLogValue(value: unknown): string {
    try {
        return truncateValue(JSON.stringify(value));
    } catch {
        return '[unserializable]';
    }
}

function truncateValue(value: string): string {
    return value.length > MAX_LOG_FIELD_LENGTH ? `${value.slice(0, MAX_LOG_FIELD_LENGTH)}...` : value;
}
