import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuditEventResult, AuditEventSource, FindAuditEventsDto } from '@/modules/audit/dto/find-audit-events.dto';
import type { AuditEventDetail, AuditEventListItem } from '@/modules/audit/responses/audit-event.response';

type AuditQueryScope = {
    companyId?: string;
    empty?: boolean;
};

type AuditDateRange = {
    gte?: Date;
    lte?: Date;
};

@Injectable()
export class AuditEventsRepository {
    constructor(private readonly prisma: PrismaService) {}

    async count(source: AuditEventSource, dto: FindAuditEventsDto, scope: AuditQueryScope): Promise<number> {
        if (scope.empty) return 0;
        switch (source) {
            case 'request':
                return this.prisma.requestLog.count({ where: this.requestWhere(dto, scope) });
            case 'security':
                return this.prisma.securityAuditLog.count({ where: this.securityWhere(dto, scope) });
            case 'access':
                return this.prisma.accessAuditLog.count({ where: this.accessWhere(dto, scope) });
            case 'business':
                return this.prisma.businessAuditLog.count({ where: this.businessWhere(dto, scope) });
            case 'card':
                return this.prisma.cardAuditLog.count({ where: this.cardWhere(dto, scope) });
            case 'cardcloud':
                return this.prisma.cardcloudAuditLog.count({ where: this.cardcloudWhere(dto, scope) });
        }
    }

    async findMany(source: AuditEventSource, dto: FindAuditEventsDto, scope: AuditQueryScope, take: number): Promise<AuditEventListItem[]> {
        if (scope.empty) return [];
        switch (source) {
            case 'request':
                return (await this.prisma.requestLog.findMany({ where: this.requestWhere(dto, scope), orderBy: { createdAt: 'desc' }, take })).map((event) => ({
                    id: event.id,
                    source,
                    requestId: event.requestId,
                    action: this.requestAction(event.method, event.path),
                    result: this.requestResult(event.statusCode),
                    method: event.method,
                    path: event.path,
                    statusCode: event.statusCode,
                    actorUserId: event.actorUserId,
                    companyId: event.companyId,
                    durationMs: event.durationMs,
                    createdAt: event.createdAt,
                }));
            case 'security':
                return (await this.prisma.securityAuditLog.findMany({ where: this.securityWhere(dto, scope), orderBy: { createdAt: 'desc' }, take })).map((event) => ({
                    id: event.id,
                    source,
                    requestId: event.requestId,
                    action: event.action,
                    result: this.auditResult(event.result),
                    statusCode: event.statusCode,
                    actorUserId: event.actorUserId,
                    actorUsername: event.actorUsername,
                    companyId: event.companyId,
                    scopeKey: event.scopeKey,
                    scopeId: event.scopeId,
                    resourceType: event.resourceType,
                    resourceId: event.resourceId,
                    reason: event.reason,
                    createdAt: event.createdAt,
                }));
            case 'access':
                return (await this.prisma.accessAuditLog.findMany({ where: this.accessWhere(dto, scope), orderBy: { createdAt: 'desc' }, take })).map((event) => this.mapDomainEvent(source, event));
            case 'business':
                return (await this.prisma.businessAuditLog.findMany({ where: this.businessWhere(dto, scope), orderBy: { createdAt: 'desc' }, take })).map((event) =>
                    this.mapDomainEvent(source, event)
                );
            case 'card':
                return (await this.prisma.cardAuditLog.findMany({ where: this.cardWhere(dto, scope), orderBy: { createdAt: 'desc' }, take })).map((event) => this.mapDomainEvent(source, event));
            case 'cardcloud':
                return (await this.prisma.cardcloudAuditLog.findMany({ where: this.cardcloudWhere(dto, scope), orderBy: { createdAt: 'desc' }, take })).map((event) => ({
                    ...this.mapDomainEvent(source, event),
                    externalPath: event.externalPath,
                }));
        }
    }

    async findOne(source: AuditEventSource, id: string, scope: AuditQueryScope): Promise<AuditEventDetail | null> {
        if (scope.empty) return null;
        switch (source) {
            case 'request': {
                const event = await this.prisma.requestLog.findFirst({ where: { id, ...this.companyWhere(scope) } });
                if (!event) return null;
                return {
                    id: event.id,
                    source,
                    requestId: event.requestId,
                    action: this.requestAction(event.method, event.path),
                    result: this.requestResult(event.statusCode),
                    method: event.method,
                    path: event.path,
                    statusCode: event.statusCode,
                    actorUserId: event.actorUserId,
                    companyId: event.companyId,
                    durationMs: event.durationMs,
                    origin: event.origin,
                    ipAddress: event.ipAddress,
                    userAgent: event.userAgent,
                    hasCookie: event.hasCookie,
                    query: event.query,
                    body: event.body,
                    cookies: event.cookies,
                    createdAt: event.createdAt,
                };
            }
            case 'security': {
                const event = await this.prisma.securityAuditLog.findFirst({ where: { id, ...this.companyWhere(scope) } });
                return event
                    ? {
                          ...this.mapSecurityDetail(source, event),
                          metadata: event.metadata,
                      }
                    : null;
            }
            case 'access': {
                const event = await this.prisma.accessAuditLog.findFirst({ where: { id, ...this.companyWhere(scope) } });
                return event ? this.mapDomainDetail(source, event) : null;
            }
            case 'business': {
                const event = await this.prisma.businessAuditLog.findFirst({ where: { id, ...this.companyWhere(scope) } });
                return event ? this.mapDomainDetail(source, event) : null;
            }
            case 'card': {
                const event = await this.prisma.cardAuditLog.findFirst({ where: { id, ...this.companyWhere(scope) } });
                return event ? this.mapDomainDetail(source, event) : null;
            }
            case 'cardcloud': {
                const event = await this.prisma.cardcloudAuditLog.findFirst({ where: { id, ...this.companyWhere(scope) } });
                return event
                    ? {
                          ...this.mapDomainDetail(source, event),
                          externalPath: event.externalPath,
                      }
                    : null;
            }
        }
    }

    private requestWhere(dto: FindAuditEventsDto, scope: AuditQueryScope): Prisma.RequestLogWhereInput {
        if (dto.action || dto.resourceType || dto.resourceId) return { id: '__never__' };
        return {
            ...this.companyWhere(scope),
            actorUserId: dto.actorUserId,
            requestId: dto.requestId,
            method: dto.method ? { equals: dto.method, mode: Prisma.QueryMode.insensitive } : undefined,
            path: dto.path ? { contains: dto.path, mode: Prisma.QueryMode.insensitive } : undefined,
            statusCode: this.requestStatusWhere(dto.result),
            createdAt: this.dateWhere(dto),
            ...(dto.search
                ? {
                      OR: [
                          { requestId: { contains: dto.search, mode: Prisma.QueryMode.insensitive } },
                          { method: { contains: dto.search, mode: Prisma.QueryMode.insensitive } },
                          { path: { contains: dto.search, mode: Prisma.QueryMode.insensitive } },
                      ],
                  }
                : {}),
        };
    }

    private securityWhere(dto: FindAuditEventsDto, scope: AuditQueryScope): Prisma.SecurityAuditLogWhereInput {
        if (dto.method || dto.path) return { id: '__never__' };
        return {
            ...this.sharedAuditWhere(dto, scope),
            resourceType: this.contains(dto.resourceType),
            resourceId: dto.resourceId,
            ...(dto.search
                ? {
                      OR: [
                          { action: { contains: dto.search, mode: Prisma.QueryMode.insensitive } },
                          { actorUsername: { contains: dto.search, mode: Prisma.QueryMode.insensitive } },
                          { reason: { contains: dto.search, mode: Prisma.QueryMode.insensitive } },
                          { requestId: { contains: dto.search, mode: Prisma.QueryMode.insensitive } },
                          { resourceType: { contains: dto.search, mode: Prisma.QueryMode.insensitive } },
                          { resourceId: { contains: dto.search, mode: Prisma.QueryMode.insensitive } },
                      ],
                  }
                : {}),
        };
    }

    private accessWhere(dto: FindAuditEventsDto, scope: AuditQueryScope): Prisma.AccessAuditLogWhereInput {
        if (dto.method || dto.path) return { id: '__never__' };
        return {
            ...this.sharedAuditWhere(dto, scope),
            resourceType: this.contains(dto.resourceType),
            resourceId: dto.resourceId,
            ...(dto.search ? { OR: this.domainSearch(dto.search) } : {}),
        };
    }

    private businessWhere(dto: FindAuditEventsDto, scope: AuditQueryScope): Prisma.BusinessAuditLogWhereInput {
        if (dto.method || dto.path) return { id: '__never__' };
        return {
            ...this.sharedAuditWhere(dto, scope),
            resourceType: this.contains(dto.resourceType),
            resourceId: dto.resourceId,
            ...(dto.search ? { OR: this.domainSearch(dto.search) } : {}),
        };
    }

    private cardWhere(dto: FindAuditEventsDto, scope: AuditQueryScope): Prisma.CardAuditLogWhereInput {
        if (dto.method || dto.path) return { id: '__never__' };
        return {
            ...this.sharedAuditWhere(dto, scope),
            resourceType: this.contains(dto.resourceType),
            resourceId: dto.resourceId,
            ...(dto.search ? { OR: this.domainSearch(dto.search) } : {}),
        };
    }

    private cardcloudWhere(dto: FindAuditEventsDto, scope: AuditQueryScope): Prisma.CardcloudAuditLogWhereInput {
        if (dto.method || dto.path) return { id: '__never__' };
        return {
            ...this.sharedAuditWhere(dto, scope),
            resourceType: this.contains(dto.resourceType),
            resourceId: dto.resourceId,
            externalPath: dto.path ? { contains: dto.path, mode: Prisma.QueryMode.insensitive } : undefined,
            ...(dto.search ? { OR: [...this.domainSearch(dto.search), { externalPath: { contains: dto.search, mode: Prisma.QueryMode.insensitive } }] } : {}),
        };
    }

    private sharedAuditWhere(dto: FindAuditEventsDto, scope: AuditQueryScope) {
        return {
            ...this.companyWhere(scope),
            action: this.containsRequired(dto.action),
            result: dto.result,
            actorUserId: dto.actorUserId,
            requestId: dto.requestId,
            createdAt: this.dateWhere(dto),
        };
    }

    private companyWhere(scope: AuditQueryScope): { companyId?: string } {
        return scope.companyId ? { companyId: scope.companyId } : {};
    }

    private dateWhere(dto: FindAuditEventsDto): AuditDateRange | undefined {
        const where: AuditDateRange = {};
        if (dto.from) where.gte = new Date(dto.from);
        if (dto.to) where.lte = new Date(dto.to);
        return where.gte || where.lte ? where : undefined;
    }

    private requestStatusWhere(result?: AuditEventResult): Prisma.IntFilter | undefined {
        if (result === 'success') return { lt: 400 };
        if (result === 'denied') return { in: [401, 403] };
        if (result === 'failure') return { gte: 400, notIn: [401, 403] };
        return undefined;
    }

    private containsRequired(value?: string): Prisma.StringFilter | undefined {
        return value ? { contains: value, mode: Prisma.QueryMode.insensitive } : undefined;
    }

    private contains(value?: string): Prisma.StringNullableFilter | undefined {
        return value ? { contains: value, mode: Prisma.QueryMode.insensitive } : undefined;
    }

    private domainSearch(search: string) {
        return [
            { action: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { actorUsername: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { reason: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { requestId: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { resourceType: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { resourceId: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ];
    }

    private requestAction(method: string, path: string): string {
        return `${method.toUpperCase()} ${path}`;
    }

    private requestResult(statusCode: number): AuditEventResult {
        if (statusCode < 400) return 'success';
        return statusCode === 401 || statusCode === 403 ? 'denied' : 'failure';
    }

    private auditResult(value: string): AuditEventResult {
        return value === 'denied' || value === 'failure' ? value : 'success';
    }

    private mapDomainEvent(source: Exclude<AuditEventSource, 'request' | 'security'>, event: DomainAuditEvent): AuditEventListItem {
        return {
            id: event.id,
            source,
            requestId: event.requestId,
            action: event.action,
            result: this.auditResult(event.result),
            statusCode: event.statusCode,
            actorUserId: event.actorUserId,
            actorUsername: event.actorUsername,
            companyId: event.companyId,
            scopeKey: event.scopeKey,
            scopeId: event.scopeId,
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            reason: event.reason,
            createdAt: event.createdAt,
        };
    }

    private mapSecurityDetail(source: 'security', event: SecurityAuditEvent): AuditEventDetail {
        return {
            id: event.id,
            source,
            requestId: event.requestId,
            action: event.action,
            result: this.auditResult(event.result),
            statusCode: event.statusCode,
            actorUserId: event.actorUserId,
            actorUsername: event.actorUsername,
            companyId: event.companyId,
            scopeKey: event.scopeKey,
            scopeId: event.scopeId,
            resourceType: event.resourceType,
            resourceId: event.resourceId,
            reason: event.reason,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            createdAt: event.createdAt,
        };
    }

    private mapDomainDetail(source: Exclude<AuditEventSource, 'request' | 'security'>, event: DomainAuditEvent): AuditEventDetail {
        return {
            ...this.mapDomainEvent(source, event),
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            metadata: event.metadata,
            before: event.beforeData,
            after: event.afterData,
        };
    }
}

type SecurityAuditEvent = Awaited<ReturnType<PrismaService['securityAuditLog']['findFirst']>> & NonNullable<unknown>;
type DomainAuditEvent =
    | (Awaited<ReturnType<PrismaService['accessAuditLog']['findFirst']>> & NonNullable<unknown>)
    | (Awaited<ReturnType<PrismaService['businessAuditLog']['findFirst']>> & NonNullable<unknown>)
    | (Awaited<ReturnType<PrismaService['cardAuditLog']['findFirst']>> & NonNullable<unknown>)
    | (Awaited<ReturnType<PrismaService['cardcloudAuditLog']['findFirst']>> & NonNullable<unknown>);
