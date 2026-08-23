import type { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AuditContextService, type AuditRequest } from '@/modules/audit/audit-context.service';
import { AuditService } from '@/modules/audit/audit.service';

export function auditRequestMiddleware(audit: AuditService, auditContext: AuditContextService) {
    return (request: AuditRequest, response: Response, next: NextFunction): void => {
        const startedAt = Date.now();
        const requestId = request.header('x-request-id') ?? response.getHeader('X-Request-Id')?.toString() ?? randomUUID();

        auditContext.run({ request, requestId, startedAt }, () => {
            response.on('finish', () => {
                void audit.recordRequest(response.statusCode, Date.now() - startedAt);
            });
            next();
        });
    };
}
