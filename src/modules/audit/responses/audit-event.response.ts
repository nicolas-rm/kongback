import type { Prisma } from '@prisma/client';
import type { AuditEventResult, AuditEventSource } from '@/modules/audit/dto/find-audit-events.dto';

export type AuditActorSummary = {
    id: string | null;
    username: string | null;
    email: string | null;
    fullName: string | null;
};

export type AuditCompanySummary = {
    id: string;
    key: string;
    name: string;
    tradeName: string | null;
};

export type AuditSubCompanySummary = {
    id: string;
    key: string;
    name: string;
    companyId: string;
};

export type AuditScopeSummary = {
    key: string;
    id: string | null;
    label: string;
    subCompany?: AuditSubCompanySummary | null;
};

export type AuditResourceSummaryData = Record<string, string | number | boolean | null>;

export type AuditResourceSummary = {
    type: string;
    id: string | null;
    label: string;
    data?: AuditResourceSummaryData;
};

export type AuditRouteSummary = {
    method: string | null;
    path: string | null;
    externalPath?: string | null;
    routePattern: string | null;
    module: string;
    operation: string;
    statusCode?: number | null;
    durationMs?: number | null;
};

export type AuditEventSeverity = 'info' | 'warning' | 'error' | 'critical';

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
    actor?: AuditActorSummary | null;
    company?: AuditCompanySummary | null;
    scope?: AuditScopeSummary | null;
    resource?: AuditResourceSummary | null;
    route?: AuditRouteSummary | null;
    module?: string;
    operation?: string;
    actionLabel?: string;
    label?: string;
    severity?: AuditEventSeverity;
    changedFields?: string[];
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
