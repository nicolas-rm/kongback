import { Injectable } from '@nestjs/common';
import { paginate } from '@/utilities/pagination/pagination.dto';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { notFound } from '@/modules/business/business.helpers';
import { AUDIT_EVENT_SOURCES, type AuditEventSource, FindAuditEventsDto } from '@/modules/audit/dto/find-audit-events.dto';
import { AuditEventsRepository } from '@/modules/audit/repositories/audit-events.repository';
import type { AuditEventListItem } from '@/modules/audit/responses/audit-event.response';

@Injectable()
export class AuditEventsService {
    constructor(private readonly repository: AuditEventsRepository) {}

    async findAll(dto: FindAuditEventsDto, scope?: CompanyScope) {
        const sources = dto.source ? [dto.source] : [...AUDIT_EVENT_SOURCES];
        return this.findAcrossSources(sources, dto, scope);
    }

    async findBySource(source: AuditEventSource, dto: FindAuditEventsDto, scope?: CompanyScope) {
        return this.findAcrossSources([source], dto, scope);
    }

    async findTransfers(dto: FindAuditEventsDto, scope?: CompanyScope) {
        return this.findAcrossSources(['cardcloud'], Object.assign(dto, { resourceType: 'CardcloudTransfer' }), scope);
    }

    async findCardAssignments(dto: FindAuditEventsDto, scope?: CompanyScope) {
        return this.findAcrossSources(['card', 'cardcloud'], Object.assign(dto, { action: dto.action ?? 'assign' }), scope);
    }

    private async findAcrossSources(sources: AuditEventSource[], dto: FindAuditEventsDto, scope?: CompanyScope) {
        const queryScope = this.resolveScope(dto, scope);
        const total = (await Promise.all(sources.map((source) => this.repository.count(source, dto, queryScope)))).reduce((sum, count) => sum + count, 0);
        const take = dto.skip + (dto.actualLimit ?? 10);
        const buckets = await Promise.all(sources.map((source) => this.repository.findMany(source, dto, queryScope, take)));
        const data = buckets
            .flat()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(dto.skip, dto.skip + (dto.actualLimit ?? 10));

        return paginate(data, total, dto);
    }

    async findOne(source: AuditEventSource, id: string, scope?: CompanyScope) {
        const event = await this.repository.findOne(source, id, this.resolveScope({}, scope));
        if (!event) throw notFound();
        return event;
    }

    summarize(events: AuditEventListItem[]) {
        const summary = new Map<string, number>();
        for (const event of events) {
            const key = `${event.source}:${event.result}`;
            summary.set(key, (summary.get(key) ?? 0) + 1);
        }
        return [...summary.entries()].map(([key, count]) => {
            const [source, result] = key.split(':');
            return { source, result, count };
        });
    }

    private resolveScope(dto: Pick<FindAuditEventsDto, 'companyId'>, scope?: CompanyScope): { companyId?: string; empty?: boolean } {
        if (scope?.companyId) {
            return dto.companyId && dto.companyId !== scope.companyId ? { empty: true } : { companyId: scope.companyId };
        }
        return dto.companyId ? { companyId: dto.companyId } : {};
    }
}
