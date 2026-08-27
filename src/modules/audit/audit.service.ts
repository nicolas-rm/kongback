import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditContextService, type AuditRequest } from '@/modules/audit/audit-context.service';

type AuditResult = 'success' | 'failure' | 'denied';
type AuditInput = {
    action: string;
    result?: AuditResult;
    actorUserId?: string | null;
    actorUsername?: string | null;
    companyId?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    statusCode?: number | null;
    reason?: string | null;
    externalPath?: string | null;
    metadata?: unknown;
    before?: unknown;
    after?: unknown;
};

const MAX_STRING_LENGTH = 1_500;
const SENSITIVE_KEY_PATTERN = /authorization|cookie|password|token|secret|totp|otp|recovery|hash|cvv|nip|pan|cardNumber|card_number|access_token|refresh_token/i;

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly context: AuditContextService
    ) {}

    async recordRequest(statusCode: number, durationMs: number): Promise<void> {
        const current = this.context.current;
        if (!current) return;

        const request = current.request;
        await this.safeWrite(() =>
            this.prisma.requestLog.create({
                data: {
                    requestId: current.requestId,
                    actorUserId: request.user?.id ?? null,
                    companyId: request.companyId ?? null,
                    method: request.method,
                    path: request.originalUrl,
                    statusCode,
                    durationMs,
                    origin: request.get('origin') ?? null,
                    ipAddress: this.resolveIpAddress(request),
                    userAgent: request.get('user-agent') ?? null,
                    hasCookie: Boolean(request.get('cookie')),
                    query: this.toJson(request.query),
                    body: this.toJson(request.body),
                    cookies: this.toJson(request.cookies),
                },
            })
        );
        await this.recordRouteAudit(request, statusCode, durationMs);
    }

    recordSecurity(input: AuditInput): Promise<void> {
        const base = this.baseInput(input);
        return this.safeWrite(() =>
            this.prisma.securityAuditLog.create({
                data: {
                    ...base,
                    action: input.action,
                    result: input.result ?? 'success',
                },
            })
        );
    }

    recordAccess(input: AuditInput): Promise<void> {
        const base = this.baseInput(input);
        return this.safeWrite(() =>
            this.prisma.accessAuditLog.create({
                data: {
                    ...base,
                    action: input.action,
                    result: input.result ?? 'success',
                    resourceType: input.resourceType ?? null,
                    resourceId: input.resourceId ?? null,
                    beforeData: this.toJson(input.before),
                    afterData: this.toJson(input.after),
                },
            })
        );
    }

    recordBusiness(input: AuditInput): Promise<void> {
        const base = this.baseInput(input);
        return this.safeWrite(() =>
            this.prisma.businessAuditLog.create({
                data: {
                    ...base,
                    action: input.action,
                    result: input.result ?? 'success',
                    resourceType: input.resourceType ?? null,
                    resourceId: input.resourceId ?? null,
                    beforeData: this.toJson(input.before),
                    afterData: this.toJson(input.after),
                },
            })
        );
    }

    recordCard(input: AuditInput): Promise<void> {
        const base = this.baseInput(input);
        return this.safeWrite(() =>
            this.prisma.cardAuditLog.create({
                data: {
                    ...base,
                    action: input.action,
                    result: input.result ?? 'success',
                    resourceType: input.resourceType ?? null,
                    resourceId: input.resourceId ?? null,
                    beforeData: this.toJson(input.before),
                    afterData: this.toJson(input.after),
                },
            })
        );
    }

    recordCardcloud(input: AuditInput): Promise<void> {
        const base = this.baseInput(input);
        return this.safeWrite(() =>
            this.prisma.cardcloudAuditLog.create({
                data: {
                    ...base,
                    action: input.action,
                    result: input.result ?? 'success',
                    resourceType: input.resourceType ?? null,
                    resourceId: input.resourceId ?? null,
                    externalPath: input.externalPath ?? null,
                    beforeData: this.toJson(input.before),
                    afterData: this.toJson(input.after),
                },
            })
        );
    }

    private baseInput(input: AuditInput) {
        const current = this.context.current;
        const request = current?.request;
        const user = request?.user;
        const scope = request?.companyScope;

        return {
            requestId: current?.requestId ?? null,
            actorUserId: input.actorUserId ?? user?.id ?? null,
            actorUsername: input.actorUsername ?? user?.username ?? null,
            companyId: input.companyId ?? request?.companyId ?? scope?.companyId ?? null,
            scopeKey: scope?.subCompanyIds ? 'subCompanyId' : null,
            scopeId: scope?.subCompanyIds?.length === 1 ? scope.subCompanyIds[0] : null,
            statusCode: input.statusCode ?? null,
            ipAddress: request ? this.resolveIpAddress(request) : null,
            userAgent: request?.get('user-agent') ?? null,
            reason: input.reason ?? null,
            metadata: this.toJson(input.metadata),
        };
    }

    private async safeWrite<T>(operation: () => Promise<T>): Promise<void> {
        try {
            await operation();
        } catch (error) {
            this.logger.warn(`No se pudo guardar auditoria: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private resolveIpAddress(request: Request): string | null {
        const forwardedFor = request.get('x-forwarded-for')?.split(',')[0]?.trim();
        return forwardedFor || request.ip || null;
    }

    private toJson(value: unknown): Prisma.InputJsonValue | undefined {
        const sanitized = this.sanitize(value);
        if (sanitized === undefined) return undefined;
        return sanitized as Prisma.InputJsonValue;
    }

    private sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
        if (value === undefined) return undefined;
        if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
        if (typeof value === 'string') return this.truncate(value);
        if (value instanceof Date) return value.toISOString();
        if (Buffer.isBuffer(value)) return `[buffer:${value.length}]`;

        if (Array.isArray(value)) {
            return value.map((item) => this.sanitize(item, seen)).filter((item) => item !== undefined);
        }

        if (typeof value === 'object') {
            if (seen.has(value)) return '[circular]';
            seen.add(value);

            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : this.sanitize(item, seen)]));
        }

        return this.truncate(String(value));
    }

    private truncate(value: string): string {
        return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;
    }

    private async recordRouteAudit(request: AuditRequest, statusCode: number, durationMs: number): Promise<void> {
        const category = this.resolveRouteCategory(request.originalUrl);
        if (!category) return;

        const input: AuditInput = {
            action: this.resolveRouteAction(request.method, request.originalUrl),
            result: statusCode < 400 ? 'success' : statusCode === 401 || statusCode === 403 ? 'denied' : 'failure',
            statusCode,
            reason: statusCode >= 400 ? 'request_finished_with_error_status' : null,
            metadata: {
                method: request.method,
                path: request.originalUrl,
                durationMs,
            },
        };

        if (category === 'security') return this.recordSecurity(input);
        if (category === 'access') return this.recordAccess(input);
        if (category === 'business') return this.recordBusiness(input);
        if (category === 'card') return this.recordCard(input);
        if (category === 'cardcloud') return this.recordCardcloud(input);
    }

    private resolveRouteCategory(path: string): 'security' | 'access' | 'business' | 'card' | 'cardcloud' | null {
        const normalized = this.normalizePath(path);

        if (normalized.startsWith('/api/authentication')) return 'security';
        if (normalized.startsWith('/api/users') || normalized.startsWith('/api/roles') || normalized.startsWith('/api/permissions')) return 'access';
        if (normalized.startsWith('/api/cardcloud') || normalized.startsWith('/api/cardcloud-stock')) return 'cardcloud';
        if (normalized.startsWith('/api/cards') || normalized.startsWith('/api/cardholder') || normalized.startsWith('/api/cardholders')) return 'card';
        if (
            normalized.startsWith('/api/companies') ||
            normalized.startsWith('/api/sub-companies') ||
            normalized.startsWith('/api/drivers') ||
            normalized.startsWith('/api/vehicles') ||
            normalized.startsWith('/api/fuels') ||
            normalized.startsWith('/api/stations') ||
            normalized.startsWith('/api/station-fuels') ||
            normalized.startsWith('/api/documents') ||
            normalized.startsWith('/api/notifications') ||
            normalized.startsWith('/api/me/notifications')
        ) {
            return 'business';
        }

        return null;
    }

    private resolveRouteAction(method: string, path: string): string {
        const withoutQuery = this.normalizePath(path).split('?')[0] ?? path;
        const route = withoutQuery
            .replace(/^\/api\/?/, '')
            .split('/')
            .filter(Boolean)
            .map((segment) => (this.looksLikeId(segment) ? 'id' : segment))
            .join('_')
            .replace(/[^a-zA-Z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '');

        return `${method.toLowerCase()}_${route || 'root'}`;
    }

    private normalizePath(path: string): string {
        return path.toLowerCase();
    }

    private looksLikeId(value: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) || /^[0-9a-f]{24,}$/i.test(value);
    }
}
