import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { scopedSubCompanyIdFilter, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { createExcelExport, EXCEL_EXPORT_MAX_ROWS, valueOrDash } from '@/utilities/export/excel-export';
import { notFound } from '@/modules/business/business.helpers';
import { AUDIT_EVENT_SOURCES, type AuditEventSource, FindAuditEventsDto } from '@/modules/audit/dto/find-audit-events.dto';
import { AuditEventsRepository, type AuditRequestRouteLookup } from '@/modules/audit/repositories/audit-events.repository';
import type {
    AuditActorSummary,
    AuditCompanySummary,
    AuditEventDetail,
    AuditEventListItem,
    AuditEventSeverity,
    AuditResourceSummary,
    AuditRouteSummary,
    AuditScopeSummary,
    AuditSubCompanySummary,
} from '@/modules/audit/responses/audit-event.response';

type AuditEnrichmentLookups = {
    actors: Map<string, AuditActorSummary>;
    companies: Map<string, AuditCompanySummary>;
    subCompanies: Map<string, AuditSubCompanySummary>;
    resources: Map<string, AuditResourceSummary>;
    requestRoutes: Map<string, AuditRequestRouteLookup>;
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
    User: 'Usuario',
    Cardholder: 'Tarjetahabiente',
    Role: 'Rol',
    Permission: 'Permiso',
    UserAccess: 'Acceso de usuario',
    Company: 'Compania',
    SubCompany: 'Subcompania',
    Driver: 'Conductor',
    Fuel: 'Combustible',
    Vehicle: 'Vehiculo',
    Card: 'Tarjeta',
    Station: 'Estacion',
    StationFuel: 'Combustible de estacion',
    Document: 'Documento',
    Notification: 'Notificacion',
    Session: 'Sesion',
    TrustedDevice: 'Dispositivo confiable',
    CardcloudAccount: 'Cuenta Cardcloud',
    CardcloudCard: 'Tarjeta Cardcloud',
    CardcloudCardMovement: 'Movimiento de tarjeta Cardcloud',
    CardcloudStock: 'Stock Cardcloud',
    CardcloudSubaccount: 'Subcuenta Cardcloud',
    CardcloudTransfer: 'Transferencia Cardcloud',
};

const RESOURCE_MODULE_LABELS: Record<string, string> = {
    User: 'Usuarios',
    Cardholder: 'Tarjetahabientes',
    Role: 'Roles',
    Permission: 'Permisos',
    UserAccess: 'Usuarios',
    Company: 'Companias',
    SubCompany: 'Subcompanias',
    Driver: 'Conductores',
    Fuel: 'Combustibles',
    Vehicle: 'Vehiculos',
    Card: 'Tarjetas',
    Station: 'Estaciones',
    StationFuel: 'Combustibles de estacion',
    Document: 'Documentos',
    Notification: 'Notificaciones',
    Session: 'Sesiones',
    TrustedDevice: 'Dispositivos confiables',
    CardcloudAccount: 'Cardcloud',
    CardcloudCard: 'Cardcloud',
    CardcloudCardMovement: 'Cardcloud',
    CardcloudStock: 'Stock Cardcloud',
    CardcloudSubaccount: 'Subcuentas Cardcloud',
    CardcloudTransfer: 'Transferencias Cardcloud',
};

const ROUTE_MODULES: Array<{ prefix: string; label: string }> = [
    { prefix: '/api/authentication', label: 'Autenticacion' },
    { prefix: '/api/audit', label: 'Auditoria' },
    { prefix: '/api/cardcloud-stock', label: 'Stock Cardcloud' },
    { prefix: '/api/cardcloud', label: 'Cardcloud' },
    { prefix: '/api/cardholders', label: 'Tarjetahabientes' },
    { prefix: '/api/cardholder', label: 'Portal tarjetahabiente' },
    { prefix: '/api/cards', label: 'Tarjetas' },
    { prefix: '/api/users', label: 'Usuarios' },
    { prefix: '/api/roles', label: 'Roles' },
    { prefix: '/api/permissions', label: 'Permisos' },
    { prefix: '/api/companies', label: 'Companias' },
    { prefix: '/api/sub-companies', label: 'Subcompanias' },
    { prefix: '/api/drivers', label: 'Conductores' },
    { prefix: '/api/vehicles', label: 'Vehiculos' },
    { prefix: '/api/fuels', label: 'Combustibles' },
    { prefix: '/api/station-fuels', label: 'Combustibles de estacion' },
    { prefix: '/api/stations', label: 'Estaciones' },
    { prefix: '/api/documents', label: 'Documentos' },
    { prefix: '/api/me/notifications', label: 'Notificaciones' },
    { prefix: '/api/notifications', label: 'Notificaciones' },
];

const ACTION_LABELS: Record<string, string> = {
    login_failed: 'Inicio de sesion fallido',
    login_success: 'Inicio de sesion exitoso',
    login_trusted_device_success: 'Inicio de sesion con dispositivo confiable',
    login_two_factor_required: 'Segundo factor requerido',
    two_factor_login_failed: 'Validacion 2FA fallida',
    two_factor_login_success: 'Validacion 2FA exitosa',
    logout: 'Cierre de sesion',
    logout_all: 'Cierre de todas las sesiones',
    csrf_rejected: 'Solicitud CSRF rechazada',
    insufficient_permissions: 'Permisos insuficientes',
    insufficient_roles: 'Roles insuficientes',
    invalid_company_header: 'Compania invalida en encabezado',
    company_denied: 'Acceso a compania denegado',
    company_scope_denied: 'Alcance de compania denegado',
    must_change_password_required: 'Cambio de contrasena requerido',
    refresh_token_missing: 'Refresh token faltante',
    refresh_token_invalid: 'Refresh token invalido',
    refresh_token_reused: 'Refresh token reutilizado',
    refresh_token_used: 'Refresh token usado',
    password_changed: 'Contrasena actualizada',
    password_reset_completed: 'Restablecimiento de contrasena completado',
    trusted_device_created: 'Dispositivo confiable creado',
    trusted_device_login_failed: 'Inicio con dispositivo confiable fallido',
    trusted_device_revoked: 'Dispositivo confiable revocado',
    notifications_socket_connected: 'Socket de notificaciones conectado',
    notifications_socket_disconnected: 'Socket de notificaciones desconectado',
    notifications_socket_unauthorized: 'Socket de notificaciones no autorizado',
};

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
        const events = await this.enrichEvents(await this.collectAcrossSources([source], dto, scope, EXCEL_EXPORT_MAX_ROWS, 0));
        return this.createAuditExport(`auditoria-${this.sourceSlug(source)}.xlsx`, this.sourceTitle(source), events, dto);
    }

    async findTransfers(dto: FindAuditEventsDto, scope?: CompanyScope) {
        return this.findAcrossSources(['cardcloud'], this.withFilters(dto, { action: dto.action ?? 'cardcloud_transfer' }), scope);
    }

    async findTransfer(id: string, scope?: CompanyScope) {
        const event = await this.findOne('cardcloud', id, scope);
        if (event.resourceType !== 'CardcloudTransfer' && !this.isTransferAction(event.action)) throw notFound();
        return event;
    }

    async exportTransfers(dto: FindAuditEventsDto, scope?: CompanyScope) {
        const query = this.withFilters(dto, { action: dto.action ?? 'cardcloud_transfer' });
        const events = await this.enrichEvents(await this.collectAcrossSources(['cardcloud'], query, scope, EXCEL_EXPORT_MAX_ROWS, 0));
        return this.createAuditExport('auditoria-transferencias.xlsx', 'Transferencias', events, query);
    }

    async findCardAssignments(dto: FindAuditEventsDto, scope?: CompanyScope) {
        return this.findAcrossSources(['card', 'cardcloud'], this.withFilters(dto, { action: dto.action ?? 'assign' }), scope);
    }

    async findCardAssignment(source: 'card' | 'cardcloud', id: string, scope?: CompanyScope) {
        const event = await this.findOne(source, id, scope);
        if (!this.isAssignmentAction(event.action)) throw notFound();
        return event;
    }

    async exportCardAssignments(dto: FindAuditEventsDto, scope?: CompanyScope) {
        const query = this.withFilters(dto, { action: dto.action ?? 'assign' });
        const events = await this.enrichEvents(await this.collectAcrossSources(['card', 'cardcloud'], query, scope, EXCEL_EXPORT_MAX_ROWS, 0));
        return this.createAuditExport('auditoria-asignaciones-tarjetas.xlsx', 'Asignaciones', events, query);
    }

    private async findAcrossSources(sources: AuditEventSource[], dto: FindAuditEventsDto, scope?: CompanyScope) {
        const queryScope = this.resolveScope(dto, scope);
        const total = (await Promise.all(sources.map((source) => this.repository.count(source, dto, queryScope)))).reduce((sum, count) => sum + count, 0);
        const data = await this.enrichEvents(await this.collectAcrossSources(sources, dto, scope, dto.actualLimit));

        return paginate(data, total, dto);
    }

    async findOne(source: AuditEventSource, id: string, scope?: CompanyScope) {
        const event = await this.repository.findOne(source, id, this.resolveScope({}, scope));
        if (!event) throw notFound();
        const [enriched] = await this.enrichEvents([event]);
        return enriched;
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

    private async collectAcrossSources(sources: AuditEventSource[], dto: FindAuditEventsDto, scope: CompanyScope | undefined, limit?: number, skip = dto.skip) {
        const queryScope = this.resolveScope(dto, scope);
        const take = limit === undefined ? undefined : skip + limit;
        const buckets = await Promise.all(sources.map((source) => this.repository.findMany(source, dto, queryScope, take)));
        const sorted = buckets.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return limit === undefined ? sorted.slice(skip) : sorted.slice(skip, skip + limit);
    }

    private async enrichEvents<T extends AuditEventListItem>(events: T[]): Promise<T[]> {
        if (events.length === 0) return events;

        const resourceIds = this.collectResourceIds(events);
        const requestIds = this.unique(events.map((event) => event.requestId));
        const actorIds = this.unique(events.map((event) => event.actorUserId));
        const companyIds = this.unique(events.map((event) => event.companyId));
        const subCompanyIds = this.unique(events.filter((event) => event.scopeKey === 'subCompanyId').map((event) => event.scopeId));

        const [actors, companies, subCompanies, resources, requestRoutes] = await Promise.all([
            this.repository.findActorSummaries(actorIds),
            this.repository.findCompanySummaries(companyIds),
            this.repository.findSubCompanySummaries(subCompanyIds),
            this.repository.findResourceSummaries(resourceIds),
            this.repository.findRequestRouteLookups(requestIds),
        ]);

        const lookups: AuditEnrichmentLookups = { actors, companies, subCompanies, resources, requestRoutes };
        return events.map((event) => this.enrichEvent(event, lookups));
    }

    private enrichEvent<T extends AuditEventListItem>(event: T, lookups: AuditEnrichmentLookups): T {
        const actor = this.actorSummary(event, lookups.actors);
        const company = event.companyId ? (lookups.companies.get(event.companyId) ?? null) : null;
        const scope = this.scopeSummary(event, company, lookups.subCompanies);
        const resource = this.resourceSummary(event, lookups.resources);
        const route = this.routeSummary(event, lookups.requestRoutes);
        const actionLabel = ACTION_LABELS[event.action] ?? `${route.module} - ${route.operation}`;
        const changedFields = this.changedFields(event);

        return {
            ...event,
            actor,
            company,
            scope,
            resource,
            route,
            module: route.module,
            operation: route.operation,
            actionLabel,
            label: this.eventLabel(actionLabel, actor, resource, route),
            severity: this.severity(event),
            ...(changedFields ? { changedFields } : {}),
        };
    }

    private createAuditExport(filename: string, sheetName: string, events: AuditEventListItem[], dto: FindAuditEventsDto) {
        return createExcelExport(
            filename,
            sheetName,
            [
                { header: 'ID', value: (event) => event.id },
                { header: 'Resumen', value: (event) => valueOrDash(event.label) },
                { header: 'Fuente', value: (event) => this.sourceTitle(event.source) },
                { header: 'Modulo', value: (event) => valueOrDash(event.module) },
                { header: 'Operacion', value: (event) => valueOrDash(event.operation) },
                { header: 'Accion visible', value: (event) => valueOrDash(event.actionLabel) },
                { header: 'Severidad', value: (event) => valueOrDash(event.severity) },
                { header: 'Fecha', value: (event) => event.createdAt },
                { header: 'Resultado', value: (event) => event.result },
                { header: 'Accion', value: (event) => event.action },
                { header: 'Metodo', value: (event) => valueOrDash(event.method ?? event.route?.method) },
                { header: 'Ruta', value: (event) => valueOrDash(event.path ?? event.route?.path ?? event.externalPath ?? event.route?.externalPath) },
                { header: 'Ruta normalizada', value: (event) => valueOrDash(event.route?.routePattern) },
                { header: 'Ruta externa', value: (event) => valueOrDash(event.externalPath) },
                { header: 'Codigo HTTP', value: (event) => valueOrDash(event.statusCode ?? event.route?.statusCode) },
                { header: 'Duracion ms', value: (event) => valueOrDash(event.durationMs ?? event.route?.durationMs) },
                { header: 'Usuario ID', value: (event) => valueOrDash(event.actorUserId) },
                { header: 'Usuario', value: (event) => valueOrDash(event.actor?.fullName ?? event.actorUsername) },
                { header: 'Username', value: (event) => valueOrDash(event.actor?.username ?? event.actorUsername) },
                { header: 'Email usuario', value: (event) => valueOrDash(event.actor?.email) },
                { header: 'Empresa ID', value: (event) => valueOrDash(event.companyId) },
                { header: 'Empresa', value: (event) => valueOrDash(event.company ? this.companyLabel(event.company) : null) },
                { header: 'Alcance', value: (event) => valueOrDash(event.scopeKey) },
                { header: 'Alcance ID', value: (event) => valueOrDash(event.scopeId) },
                { header: 'Alcance visible', value: (event) => valueOrDash(event.scope?.label) },
                { header: 'Subcompania', value: (event) => valueOrDash(event.scope?.subCompany ? this.subCompanyLabel(event.scope.subCompany) : null) },
                { header: 'Recurso', value: (event) => valueOrDash(event.resourceType) },
                { header: 'Recurso ID', value: (event) => valueOrDash(event.resourceId) },
                { header: 'Recurso visible', value: (event) => valueOrDash(event.resource?.label) },
                { header: 'Razon', value: (event) => valueOrDash(event.reason) },
                { header: 'Request ID', value: (event) => valueOrDash(event.requestId) },
            ],
            events,
            dto.format
        );
    }

    private actorSummary(event: AuditEventListItem, actors: Map<string, AuditActorSummary>): AuditActorSummary | null {
        if (event.actorUserId) {
            const actor = actors.get(event.actorUserId);
            if (actor) return actor;
        }

        if (!event.actorUserId && !event.actorUsername) return null;

        return {
            id: event.actorUserId,
            username: event.actorUsername ?? null,
            email: null,
            fullName: event.actorUsername ?? null,
        };
    }

    private scopeSummary(event: AuditEventListItem, company: AuditCompanySummary | null, subCompanies: Map<string, AuditSubCompanySummary>): AuditScopeSummary | null {
        if (event.scopeKey === 'subCompanyId') {
            const subCompany = event.scopeId ? (subCompanies.get(event.scopeId) ?? null) : null;
            return {
                key: event.scopeKey,
                id: event.scopeId ?? null,
                label: subCompany ? this.subCompanyLabel(subCompany) : (event.scopeId ?? 'Subcompanias permitidas'),
                subCompany,
            };
        }

        if (event.scopeKey) {
            return {
                key: event.scopeKey,
                id: event.scopeId ?? null,
                label: event.scopeId ? `${event.scopeKey}: ${event.scopeId}` : event.scopeKey,
            };
        }

        if (company) {
            return {
                key: 'companyId',
                id: company.id,
                label: this.companyLabel(company),
            };
        }

        return null;
    }

    private resourceSummary(event: AuditEventListItem, resources: Map<string, AuditResourceSummary>): AuditResourceSummary | null {
        if (!event.resourceType) return null;
        if (event.resourceId) {
            const resource = resources.get(this.resourceKey(event.resourceType, event.resourceId));
            if (resource) return resource;
        }

        return {
            type: event.resourceType,
            id: event.resourceId ?? null,
            label: event.resourceId ? `${this.resourceTypeLabel(event.resourceType)} ${event.resourceId}` : this.resourceTypeLabel(event.resourceType),
        };
    }

    private routeSummary(event: AuditEventListItem, requestRoutes: Map<string, AuditRequestRouteLookup>): AuditRouteSummary {
        const requestRoute = event.requestId ? requestRoutes.get(event.requestId) : undefined;
        const method = event.method ?? requestRoute?.method ?? null;
        const path = event.path ?? requestRoute?.path ?? null;
        const externalPath = event.externalPath ?? null;
        const routePath = path ?? externalPath;
        const module = this.moduleLabel(routePath, event.source, event.resourceType);

        return {
            method,
            path,
            externalPath,
            routePattern: routePath ? this.routePattern(routePath) : null,
            module,
            operation: this.operationLabel(event.action, method),
            statusCode: event.statusCode ?? requestRoute?.statusCode ?? null,
            durationMs: event.durationMs ?? requestRoute?.durationMs ?? null,
        };
    }

    private collectResourceIds(events: AuditEventListItem[]): Map<string, string[]> {
        const ids = new Map<string, string[]>();

        for (const event of events) {
            if (!event.resourceType || !event.resourceId) continue;
            const values = ids.get(event.resourceType) ?? [];
            values.push(event.resourceId);
            ids.set(event.resourceType, values);
        }

        return ids;
    }

    private eventLabel(actionLabel: string, actor: AuditActorSummary | null, resource: AuditResourceSummary | null, route: AuditRouteSummary): string {
        const subject = resource?.label ?? route.routePattern ?? route.externalPath ?? null;
        const actorLabel = this.actorLabel(actor);
        const base = subject ? `${actionLabel} - ${subject}` : actionLabel;
        return actorLabel ? `${base} - ${actorLabel}` : base;
    }

    private severity(event: AuditEventListItem): AuditEventSeverity {
        if (event.result === 'failure') return 'error';
        if (event.result === 'denied') return 'warning';
        if (/sensitive|cvv|nip|password|two_factor|trusted_device|permission|role|access|transfer|block|unblock|csrf/i.test(event.action)) return 'critical';
        return 'info';
    }

    private changedFields(event: AuditEventListItem): string[] | undefined {
        const detail = event as AuditEventDetail;
        if (!this.isRecord(detail.before) || !this.isRecord(detail.after)) return undefined;

        const keys = [...new Set([...Object.keys(detail.before), ...Object.keys(detail.after)])].sort();
        const changed = keys.filter((key) => JSON.stringify(detail.before?.[key]) !== JSON.stringify(detail.after?.[key]));
        return changed.length ? changed : undefined;
    }

    private moduleLabel(path: string | null, source: AuditEventSource, resourceType?: string | null): string {
        if (path) {
            const normalized = this.cleanPath(path).toLowerCase();
            const route = ROUTE_MODULES.find((entry) => normalized === entry.prefix || normalized.startsWith(`${entry.prefix}/`));
            if (route) return route.label;
        }

        if (resourceType && RESOURCE_MODULE_LABELS[resourceType]) return RESOURCE_MODULE_LABELS[resourceType];
        return this.sourceTitle(source);
    }

    private operationLabel(action: string, method?: string | null): string {
        if (/unblock|unblocked/i.test(action)) return 'Desbloqueo';
        if (/block|blocked/i.test(action)) return 'Bloqueo';
        if (/sensitive|cvv/i.test(action)) return 'Consulta sensible';
        if (/nip|password|2fa|two_factor/i.test(action)) return 'Seguridad';
        if (/unassign|unassigned/i.test(action)) return 'Desasignacion';
        if (/assign|assigned/i.test(action)) return 'Asignacion';
        if (/export/i.test(action)) return 'Exportacion';
        if (/download/i.test(action)) return 'Descarga';
        if (/transfer/i.test(action)) return 'Transferencia';
        if (/sync|synced/i.test(action)) return 'Sincronizacion';
        if (/process|processed/i.test(action)) return 'Procesamiento';
        if (/validate|validated/i.test(action)) return 'Validacion';
        if (/revoke|revoked/i.test(action)) return 'Revocacion';
        if (/delete|deleted|deactivate|deactivated/i.test(action)) return 'Baja';
        if (/update|updated|patch_|put_/i.test(action)) return 'Actualizacion';
        if (/create|created|post_/i.test(action)) return 'Creacion';
        if (/consult|consulted|read|list|get_/i.test(action)) return 'Consulta';
        if (/failed|denied|rejected|invalid|insufficient/i.test(action)) return 'Denegacion';

        const normalizedMethod = method?.toUpperCase();
        if (normalizedMethod === 'GET') return 'Consulta';
        if (normalizedMethod === 'POST') return 'Ejecucion';
        if (normalizedMethod === 'PATCH' || normalizedMethod === 'PUT') return 'Actualizacion';
        if (normalizedMethod === 'DELETE') return 'Baja';

        return this.titleCase(action.replace(/_/g, ' '));
    }

    private isAssignmentAction(action: string): boolean {
        return /assign|assigned|unassign|unassigned/i.test(action);
    }

    private isTransferAction(action: string): boolean {
        return /^cardcloud_transfer_/i.test(action);
    }

    private routePattern(path: string): string {
        return this.cleanPath(path)
            .split('/')
            .map((segment) => (this.looksLikeId(segment) ? ':id' : segment))
            .join('/');
    }

    private cleanPath(path: string): string {
        return path.split('?')[0] || path;
    }

    private looksLikeId(value: string): boolean {
        return /^[0-9]+$/.test(value) || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) || /^[0-9a-f]{24,}$/i.test(value);
    }

    private actorLabel(actor: AuditActorSummary | null): string | null {
        return actor?.fullName ?? actor?.username ?? actor?.email ?? null;
    }

    private companyLabel(company: AuditCompanySummary): string {
        return [company.name, company.key].filter(Boolean).join(' - ');
    }

    private subCompanyLabel(subCompany: AuditSubCompanySummary): string {
        return [subCompany.name, subCompany.key].filter(Boolean).join(' - ');
    }

    private resourceTypeLabel(resourceType: string): string {
        return RESOURCE_TYPE_LABELS[resourceType] ?? this.titleCase(resourceType.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' '));
    }

    private resourceKey(type: string, id: string): string {
        return `${type}:${id}`;
    }

    private unique(values: Array<string | null | undefined>): string[] {
        return [...new Set(values.filter((value): value is string => Boolean(value)))];
    }

    private titleCase(value: string): string {
        return value
            .trim()
            .split(/\s+/)
            .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
            .join(' ');
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
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
