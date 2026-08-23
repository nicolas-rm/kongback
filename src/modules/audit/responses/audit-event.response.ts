import type { Prisma } from '@prisma/client';
import type { AuditEventResult, AuditEventSource } from '@/modules/audit/dto/find-audit-events.dto';

export type AuditEventListItem = {
    id: string;
    source: AuditEventSource;
    requestId: string | null;
    action: string;
    result: AuditEventResult;
    method?: string | null;
    path?: string | null;
    statusCode: number | null;
    actorUserId: string | null;
    actorUsername?: string | null;
    companyId: string | null;
    scopeKey?: string | null;
    scopeId?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    externalPath?: string | null;
    reason?: string | null;
    durationMs?: number | null;
    createdAt: Date;
};

export type AuditEventDetail = AuditEventListItem & {
    ipAddress?: string | null;
    userAgent?: string | null;
    origin?: string | null;
    hasCookie?: boolean;
    query?: Prisma.JsonValue | null;
    body?: Prisma.JsonValue | null;
    cookies?: Prisma.JsonValue | null;
    metadata?: Prisma.JsonValue | null;
    before?: Prisma.JsonValue | null;
    after?: Prisma.JsonValue | null;
};
