import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { scopedSubCompanyIdFilter, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { createExcelExport, EXCEL_EXPORT_MAX_ROWS, valueOrDash } from '@/utilities/export/excel-export';
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

    async exportBySource(source: AuditEventSource, dto: FindAuditEventsDto, scope?: CompanyScope) {
        const events = await this.collectAcrossSources([source], dto, scope, EXCEL_EXPORT_MAX_ROWS, 0);
        return this.createAuditExport(`auditoria-${this.sourceSlug(source)}.xlsx`, this.sourceTitle(source), events, dto);
    }

    async findTransfers(dto: FindAuditEventsDto, scope?: CompanyScope) {
        return this.findAcrossSources(['cardcloud'], this.withFilters(dto, { resourceType: 'CardcloudTransfer' }), scope);
    }

    async exportTransfers(dto: FindAuditEventsDto, scope?: CompanyScope) {
        const query = this.withFilters(dto, { resourceType: 'CardcloudTransfer' });
        const events = await this.collectAcrossSources(['cardcloud'], query, scope, EXCEL_EXPORT_MAX_ROWS, 0);
        return this.createAuditExport('auditoria-transferencias.xlsx', 'Transferencias', events, query);
    }

    async findCardAssignments(dto: FindAuditEventsDto, scope?: CompanyScope) {
        return this.findAcrossSources(['card', 'cardcloud'], this.withFilters(dto, { action: dto.action ?? 'assign' }), scope);
    }

    async exportCardAssignments(dto: FindAuditEventsDto, scope?: CompanyScope) {
        const query = this.withFilters(dto, { action: dto.action ?? 'assign' });
        const events = await this.collectAcrossSources(['card', 'cardcloud'], query, scope, EXCEL_EXPORT_MAX_ROWS, 0);
        return this.createAuditExport('auditoria-asignaciones-tarjetas.xlsx', 'Asignaciones', events, query);
    }

    private async findAcrossSources(sources: AuditEventSource[], dto: FindAuditEventsDto, scope?: CompanyScope) {
        const queryScope = this.resolveScope(dto, scope);
        const total = (await Promise.all(sources.map((source) => this.repository.count(source, dto, queryScope)))).reduce((sum, count) => sum + count, 0);
        const data = await this.collectAcrossSources(sources, dto, scope, dto.actualLimit ?? 10);

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

    private async collectAcrossSources(sources: AuditEventSource[], dto: FindAuditEventsDto, scope: CompanyScope | undefined, limit: number, skip = dto.skip) {
        const queryScope = this.resolveScope(dto, scope);
        const take = skip + limit;
        const buckets = await Promise.all(sources.map((source) => this.repository.findMany(source, dto, queryScope, take)));
        return buckets
            .flat()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(skip, skip + limit);
    }

    private createAuditExport(filename: string, sheetName: string, events: AuditEventListItem[], dto: FindAuditEventsDto) {
        return createExcelExport(
            filename,
            sheetName,
            [
                { header: 'ID', value: (event) => event.id },
                { header: 'Fuente', value: (event) => this.sourceTitle(event.source) },
                { header: 'Fecha', value: (event) => event.createdAt },
                { header: 'Resultado', value: (event) => event.result },
                { header: 'Accion', value: (event) => event.action },
                { header: 'Metodo', value: (event) => valueOrDash(event.method) },
                { header: 'Ruta', value: (event) => valueOrDash(event.path ?? event.externalPath) },
                { header: 'Codigo HTTP', value: (event) => valueOrDash(event.statusCode) },
                { header: 'Usuario ID', value: (event) => valueOrDash(event.actorUserId) },
                { header: 'Usuario', value: (event) => valueOrDash(event.actorUsername) },
                { header: 'Empresa ID', value: (event) => valueOrDash(event.companyId) },
                { header: 'Alcance', value: (event) => valueOrDash(event.scopeKey) },
                { header: 'Alcance ID', value: (event) => valueOrDash(event.scopeId) },
                { header: 'Recurso', value: (event) => valueOrDash(event.resourceType) },
                { header: 'Recurso ID', value: (event) => valueOrDash(event.resourceId) },
                { header: 'Razon', value: (event) => valueOrDash(event.reason) },
                { header: 'Request ID', value: (event) => valueOrDash(event.requestId) },
            ],
            events,
            dto.format
        );
    }

    private withFilters(dto: FindAuditEventsDto, filters: Pick<FindAuditEventsDto, 'action' | 'resourceType'>): FindAuditEventsDto {
        return Object.assign(new FindAuditEventsDto(), dto, filters);
    }

    private sourceSlug(source: AuditEventSource): string {
        if (source === 'request') return 'solicitudes';
        if (source === 'security') return 'seguridad';
        if (source === 'access') return 'accesos';
        if (source === 'business') return 'negocio';
        if (source === 'card') return 'tarjetas';
        return 'cardcloud';
    }

    private sourceTitle(source: AuditEventSource): string {
        if (source === 'request') return 'Solicitudes';
        if (source === 'security') return 'Seguridad';
        if (source === 'access') return 'Accesos';
        if (source === 'business') return 'Negocio';
        if (source === 'card') return 'Tarjetas';
        return 'Cardcloud';
    }

    private resolveScope(dto: Pick<FindAuditEventsDto, 'companyId' | 'subCompanyId'>, scope?: CompanyScope): { companyId?: string; subCompanyId?: string | Prisma.StringNullableFilter; empty?: boolean } {
        const subCompanyId = scopedSubCompanyIdFilter(dto.subCompanyId, scope) as string | Prisma.StringNullableFilter | undefined;
        if (scope?.companyId) {
            return dto.companyId && dto.companyId !== scope.companyId ? { empty: true } : { companyId: scope.companyId, ...(subCompanyId ? { subCompanyId } : {}) };
        }
        return { ...(dto.companyId ? { companyId: dto.companyId } : {}), ...(subCompanyId ? { subCompanyId } : {}) };
    }
}
