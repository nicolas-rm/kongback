import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { AuditEventResult, AuditEventSource, FindAuditEventsDto } from '@/modules/audit/dto/find-audit-events.dto';
import type {
    AuditActorSummary,
    AuditCompanySummary,
    AuditEventDetail,
    AuditEventListItem,
    AuditResourceSummary,
    AuditResourceSummaryData,
    AuditSubCompanySummary,
} from '@/modules/audit/responses/audit-event.response';

type AuditQueryScope = {
    companyId?: string;
    subCompanyId?: string | Prisma.StringNullableFilter;
    empty?: boolean;
};

type AuditDateRange = {
    gte?: Date;
    lte?: Date;
};

type ResourceDataInput = Record<string, string | number | boolean | null | undefined>;

export type AuditRequestRouteLookup = {
    requestId: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
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

    async findMany(source: AuditEventSource, dto: FindAuditEventsDto, scope: AuditQueryScope, take?: number): Promise<AuditEventListItem[]> {
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
                if (scope.subCompanyId) return null;
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
                const event = await this.prisma.securityAuditLog.findFirst({ where: { id, ...this.companyWhere(scope), ...this.subCompanyWhere(scope) } });
                return event
                    ? {
                          ...this.mapSecurityDetail(source, event),
                          metadata: event.metadata,
                      }
                    : null;
            }
            case 'access': {
                const event = await this.prisma.accessAuditLog.findFirst({ where: { id, ...this.companyWhere(scope), ...this.subCompanyWhere(scope) } });
                return event ? this.mapDomainDetail(source, event) : null;
            }
            case 'business': {
                const event = await this.prisma.businessAuditLog.findFirst({ where: { id, ...this.companyWhere(scope), ...this.subCompanyWhere(scope) } });
                return event ? this.mapDomainDetail(source, event) : null;
            }
            case 'card': {
                const event = await this.prisma.cardAuditLog.findFirst({ where: { id, ...this.companyWhere(scope), ...this.subCompanyWhere(scope) } });
                return event ? this.mapDomainDetail(source, event) : null;
            }
            case 'cardcloud': {
                const event = await this.prisma.cardcloudAuditLog.findFirst({ where: { id, ...this.companyWhere(scope), ...this.subCompanyWhere(scope) } });
                return event
                    ? {
                          ...this.mapDomainDetail(source, event),
                          externalPath: event.externalPath,
                      }
                    : null;
            }
        }
    }

    async findActorSummaries(ids: string[]): Promise<Map<string, AuditActorSummary>> {
        const userIds = this.unique(ids);
        if (userIds.length === 0) return new Map();

        const users = await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, email: true, fullName: true },
        });

        return new Map(users.map((user) => [user.id, user]));
    }

    async findCompanySummaries(ids: string[]): Promise<Map<string, AuditCompanySummary>> {
        const companyIds = this.unique(ids);
        if (companyIds.length === 0) return new Map();

        const companies = await this.prisma.company.findMany({
            where: { id: { in: companyIds } },
            select: { id: true, key: true, name: true, tradeName: true },
        });

        return new Map(companies.map((company) => [company.id, company]));
    }

    async findSubCompanySummaries(ids: string[]): Promise<Map<string, AuditSubCompanySummary>> {
        const subCompanyIds = this.unique(ids);
        if (subCompanyIds.length === 0) return new Map();

        const subCompanies = await this.prisma.subCompany.findMany({
            where: { id: { in: subCompanyIds } },
            select: { id: true, key: true, name: true, companyId: true },
        });

        return new Map(subCompanies.map((subCompany) => [subCompany.id, subCompany]));
    }

    async findRequestRouteLookups(requestIds: string[]): Promise<Map<string, AuditRequestRouteLookup>> {
        const ids = this.unique(requestIds);
        if (ids.length === 0) return new Map();

        const requests = await this.prisma.requestLog.findMany({
            where: { requestId: { in: ids } },
            orderBy: { createdAt: 'desc' },
            select: { requestId: true, method: true, path: true, statusCode: true, durationMs: true },
        });

        const byRequestId = new Map<string, AuditRequestRouteLookup>();
        for (const request of requests) {
            if (!byRequestId.has(request.requestId)) byRequestId.set(request.requestId, request);
        }

        return byRequestId;
    }

    async findResourceSummaries(resources: Map<string, string[]>): Promise<Map<string, AuditResourceSummary>> {
        const summaries = new Map<string, AuditResourceSummary>();
        await Promise.all([...resources.entries()].map(([type, ids]) => this.addResourceSummaries(summaries, type, ids)));
        return summaries;
    }

    private async addResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const uniqueIds = this.unique(ids);
        if (uniqueIds.length === 0) return;

        switch (type) {
            case 'User':
            case 'Cardholder':
                await this.addUserResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'Role':
                await this.addRoleResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'Permission':
                await this.addPermissionResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'UserAccess':
                await this.addUserAccessResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'Company':
                await this.addCompanyResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'SubCompany':
                await this.addSubCompanyResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'Driver':
                await this.addDriverResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'Fuel':
                await this.addFuelResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'Vehicle':
                await this.addVehicleResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'Card':
                await this.addCardResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'Station':
                await this.addStationResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'StationFuel':
                await this.addStationFuelResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'Document':
                await this.addDocumentResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'Notification':
                await this.addNotificationResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'Session':
                await this.addSessionResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'TrustedDevice':
                await this.addTrustedDeviceResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'CardcloudStock':
            case 'CardcloudCard':
            case 'CardcloudCardMovement':
                await this.addCardcloudCardResourceSummaries(summaries, type, uniqueIds);
                return;
            case 'CardcloudSubaccount':
                await this.addCardcloudSubaccountResourceSummaries(summaries, type, uniqueIds);
                return;
            default:
                return;
        }
    }

    private async addUserResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const users = await this.prisma.user.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                username: true,
                email: true,
                fullName: true,
                status: true,
                driver: {
                    select: {
                        id: true,
                        name: true,
                        externalReference: true,
                        subCompany: {
                            select: { id: true, key: true, name: true, companyId: true },
                        },
                    },
                },
            },
        });

        for (const user of users) {
            this.setResourceSummary(summaries, type, user.id, this.joinLabel([user.fullName, user.username]), {
                username: user.username,
                email: user.email,
                status: user.status,
                driverId: user.driver?.id,
                driverName: user.driver?.name,
                driverReference: user.driver?.externalReference,
                subCompanyId: user.driver?.subCompany.id,
                subCompanyName: user.driver?.subCompany.name,
            });
        }
    }

    private async addRoleResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const roles = await this.prisma.role.findMany({
            where: { id: { in: ids } },
            select: { id: true, code: true, name: true, description: true },
        });

        for (const role of roles) {
            this.setResourceSummary(summaries, type, role.id, this.joinLabel([role.name, role.code]), {
                code: role.code,
                description: role.description,
            });
        }
    }

    private async addPermissionResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const permissions = await this.prisma.permission.findMany({
            where: { id: { in: ids } },
            select: { id: true, code: true, name: true, description: true },
        });

        for (const permission of permissions) {
            this.setResourceSummary(summaries, type, permission.id, this.joinLabel([permission.name, permission.code]), {
                code: permission.code,
                description: permission.description,
            });
        }
    }

    private async addUserAccessResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const accesses = await this.prisma.userAccess.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                userId: true,
                roleId: true,
                companyId: true,
                scopeKey: true,
                scopeId: true,
                user: { select: { username: true, fullName: true, email: true } },
                role: { select: { code: true, name: true } },
                company: { select: { key: true, name: true } },
            },
        });

        for (const access of accesses) {
            this.setResourceSummary(summaries, type, access.id, this.joinLabel([access.user.fullName, access.role.name, access.company?.name]), {
                userId: access.userId,
                username: access.user.username,
                email: access.user.email,
                roleId: access.roleId,
                roleCode: access.role.code,
                companyId: access.companyId,
                companyKey: access.company?.key,
                scopeKey: access.scopeKey,
                scopeId: access.scopeId,
            });
        }
    }

    private async addCompanyResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const companies = await this.prisma.company.findMany({
            where: { id: { in: ids } },
            select: { id: true, key: true, name: true, tradeName: true, status: true, externalId: true },
        });

        for (const company of companies) {
            this.setResourceSummary(summaries, type, company.id, this.joinLabel([company.name, company.key]), {
                key: company.key,
                tradeName: company.tradeName,
                status: company.status,
                externalId: company.externalId,
            });
        }
    }

    private async addSubCompanyResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const subCompanies = await this.prisma.subCompany.findMany({
            where: { id: { in: ids } },
            select: { id: true, companyId: true, key: true, name: true, status: true, cardcloudSubaccountId: true, isDefault: true },
        });

        for (const subCompany of subCompanies) {
            this.setResourceSummary(summaries, type, subCompany.id, this.joinLabel([subCompany.name, subCompany.key]), {
                companyId: subCompany.companyId,
                key: subCompany.key,
                status: subCompany.status,
                cardcloudSubaccountId: subCompany.cardcloudSubaccountId,
                isDefault: subCompany.isDefault,
            });
        }
    }

    private async addDriverResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const drivers = await this.prisma.driver.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                name: true,
                externalReference: true,
                status: true,
                subCompanyId: true,
                userId: true,
                subCompany: { select: { key: true, name: true, companyId: true } },
                user: { select: { username: true, email: true } },
            },
        });

        for (const driver of drivers) {
            this.setResourceSummary(summaries, type, driver.id, this.joinLabel([driver.name, driver.externalReference]), {
                externalReference: driver.externalReference,
                status: driver.status,
                subCompanyId: driver.subCompanyId,
                subCompanyName: driver.subCompany.name,
                companyId: driver.subCompany.companyId,
                userId: driver.userId,
                username: driver.user?.username,
                email: driver.user?.email,
            });
        }
    }

    private async addFuelResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const fuels = await this.prisma.fuel.findMany({
            where: { id: { in: ids } },
            select: { id: true, code: true, name: true, status: true },
        });

        for (const fuel of fuels) {
            this.setResourceSummary(summaries, type, fuel.id, this.joinLabel([fuel.name, fuel.code]), {
                code: fuel.code,
                status: fuel.status,
            });
        }
    }

    private async addVehicleResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const vehicles = await this.prisma.vehicle.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                plates: true,
                economicNumber: true,
                model: true,
                year: true,
                status: true,
                subCompanyId: true,
                fuel: { select: { code: true, name: true } },
                driver: { select: { id: true, name: true } },
                subCompany: { select: { key: true, name: true, companyId: true } },
            },
        });

        for (const vehicle of vehicles) {
            this.setResourceSummary(summaries, type, vehicle.id, this.joinLabel([vehicle.economicNumber, vehicle.plates]), {
                plates: vehicle.plates,
                economicNumber: vehicle.economicNumber,
                model: vehicle.model,
                year: vehicle.year,
                status: vehicle.status,
                subCompanyId: vehicle.subCompanyId,
                subCompanyName: vehicle.subCompany.name,
                companyId: vehicle.subCompany.companyId,
                fuel: this.joinLabel([vehicle.fuel.code, vehicle.fuel.name]),
                driverId: vehicle.driver?.id,
                driverName: vehicle.driver?.name,
            });
        }
    }

    private async addCardResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const cards = await this.prisma.card.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                externalId: true,
                assignmentMode: true,
                status: true,
                subCompanyId: true,
                vehicleId: true,
                designFuelId: true,
                assignedAt: true,
                vehicle: { select: { plates: true, economicNumber: true } },
                designFuel: { select: { code: true, name: true } },
                subCompany: { select: { key: true, name: true, companyId: true } },
                stock: { select: { id: true, externalId: true, clientId: true, maskedPan: true, providerStatus: true } },
            },
        });

        for (const card of cards) {
            const primaryLabel = this.firstLabel([card.stock?.clientId, card.stock?.maskedPan, card.externalId, card.vehicle?.economicNumber, card.vehicle?.plates]);
            this.setResourceSummary(summaries, type, card.id, this.joinLabel([primaryLabel, card.vehicle?.plates]), {
                externalId: card.externalId ?? card.stock?.externalId,
                clientId: card.stock?.clientId,
                maskedPan: card.stock?.maskedPan,
                providerStatus: card.stock?.providerStatus,
                status: card.status,
                assignmentMode: card.assignmentMode,
                assignedAt: this.isoDate(card.assignedAt),
                subCompanyId: card.subCompanyId,
                subCompanyName: card.subCompany.name,
                companyId: card.subCompany.companyId,
                vehicleId: card.vehicleId,
                vehiclePlates: card.vehicle?.plates,
                designFuelId: card.designFuelId,
                designFuel: card.designFuel ? this.joinLabel([card.designFuel.code, card.designFuel.name]) : undefined,
            });
        }
    }

    private async addStationResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const stations = await this.prisma.station.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                stationNumber: true,
                name: true,
                status: true,
                subCompanyId: true,
                subCompany: { select: { key: true, name: true, companyId: true } },
            },
        });

        for (const station of stations) {
            this.setResourceSummary(summaries, type, station.id, this.joinLabel([station.name, station.stationNumber]), {
                stationNumber: station.stationNumber,
                status: station.status,
                subCompanyId: station.subCompanyId,
                subCompanyName: station.subCompany.name,
                companyId: station.subCompany.companyId,
            });
        }
    }

    private async addStationFuelResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const stationFuels = await this.prisma.stationFuel.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                status: true,
                stationId: true,
                fuelId: true,
                station: { select: { stationNumber: true, name: true, subCompanyId: true } },
                fuel: { select: { code: true, name: true } },
            },
        });

        for (const stationFuel of stationFuels) {
            this.setResourceSummary(summaries, type, stationFuel.id, this.joinLabel([stationFuel.station.name, stationFuel.fuel.name]), {
                stationId: stationFuel.stationId,
                stationNumber: stationFuel.station.stationNumber,
                fuelId: stationFuel.fuelId,
                fuelCode: stationFuel.fuel.code,
                status: stationFuel.status,
                subCompanyId: stationFuel.station.subCompanyId,
            });
        }
    }

    private async addDocumentResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const documents = await this.prisma.document.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                title: true,
                originalName: true,
                category: true,
                entityType: true,
                entityId: true,
                companyId: true,
                deletedAt: true,
            },
        });

        for (const document of documents) {
            this.setResourceSummary(summaries, type, document.id, this.joinLabel([document.title, document.originalName]), {
                originalName: document.originalName,
                category: document.category,
                entityType: document.entityType,
                entityId: document.entityId,
                companyId: document.companyId,
                deleted: Boolean(document.deletedAt),
            });
        }
    }

    private async addNotificationResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const notifications = await this.prisma.notification.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                title: true,
                type: true,
                isRead: true,
                userId: true,
                user: { select: { username: true, fullName: true, email: true } },
            },
        });

        for (const notification of notifications) {
            this.setResourceSummary(summaries, type, notification.id, notification.title, {
                type: notification.type,
                isRead: notification.isRead,
                userId: notification.userId,
                username: notification.user.username,
                userFullName: notification.user.fullName,
                email: notification.user.email,
            });
        }
    }

    private async addSessionResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const sessions = await this.prisma.session.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                userId: true,
                revokedAt: true,
                lastActivityAt: true,
                expiresAt: true,
                deviceName: true,
                ipAddress: true,
                user: { select: { username: true, fullName: true, email: true } },
            },
        });

        for (const session of sessions) {
            this.setResourceSummary(summaries, type, session.id, this.joinLabel([session.deviceName, session.user.fullName, session.ipAddress]), {
                userId: session.userId,
                username: session.user.username,
                userFullName: session.user.fullName,
                email: session.user.email,
                deviceName: session.deviceName,
                ipAddress: session.ipAddress,
                lastActivityAt: this.isoDate(session.lastActivityAt),
                expiresAt: this.isoDate(session.expiresAt),
                revoked: Boolean(session.revokedAt),
            });
        }
    }

    private async addTrustedDeviceResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const devices = await this.prisma.trustedDevice.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                userId: true,
                deviceName: true,
                platform: true,
                ipAddress: true,
                lastUsedAt: true,
                expiresAt: true,
                revokedAt: true,
                user: { select: { username: true, fullName: true, email: true } },
            },
        });

        for (const device of devices) {
            this.setResourceSummary(summaries, type, device.id, this.joinLabel([device.deviceName, device.platform, device.user.fullName]), {
                userId: device.userId,
                username: device.user.username,
                userFullName: device.user.fullName,
                email: device.user.email,
                deviceName: device.deviceName,
                platform: device.platform,
                ipAddress: device.ipAddress,
                lastUsedAt: this.isoDate(device.lastUsedAt),
                expiresAt: this.isoDate(device.expiresAt),
                revoked: Boolean(device.revokedAt),
            });
        }
    }

    private async addCardcloudCardResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const stock = await this.prisma.cardcloud.findMany({
            where: { OR: [{ id: { in: ids } }, { externalId: { in: ids } }] },
            select: {
                id: true,
                externalId: true,
                clientId: true,
                maskedPan: true,
                providerStatus: true,
                subCompanyId: true,
                assignedCardId: true,
                assignedCard: { select: { id: true, status: true, assignmentMode: true } },
                subCompany: { select: { key: true, name: true, companyId: true } },
            },
        });

        for (const item of stock) {
            const label = this.joinLabel([item.clientId, item.maskedPan, item.externalId]);
            const data: ResourceDataInput = {
                localStockId: item.id,
                externalId: item.externalId,
                clientId: item.clientId,
                maskedPan: item.maskedPan,
                providerStatus: item.providerStatus,
                subCompanyId: item.subCompanyId,
                subCompanyName: item.subCompany?.name,
                companyId: item.subCompany?.companyId,
                assignedCardId: item.assignedCardId,
                assignedCardStatus: item.assignedCard?.status,
                assignedCardMode: item.assignedCard?.assignmentMode,
            };

            if (ids.includes(item.id)) this.setResourceSummary(summaries, type, item.id, label, data);
            if (ids.includes(item.externalId)) this.setResourceSummary(summaries, type, item.externalId, label, data);
        }
    }

    private async addCardcloudSubaccountResourceSummaries(summaries: Map<string, AuditResourceSummary>, type: string, ids: string[]): Promise<void> {
        const subCompanies = await this.prisma.subCompany.findMany({
            where: { OR: [{ id: { in: ids } }, { cardcloudSubaccountId: { in: ids } }] },
            select: { id: true, companyId: true, key: true, name: true, status: true, cardcloudSubaccountId: true },
        });

        for (const subCompany of subCompanies) {
            const label = this.joinLabel([subCompany.name, subCompany.key, subCompany.cardcloudSubaccountId]);
            const data: ResourceDataInput = {
                localSubCompanyId: subCompany.id,
                companyId: subCompany.companyId,
                key: subCompany.key,
                status: subCompany.status,
                cardcloudSubaccountId: subCompany.cardcloudSubaccountId,
            };

            if (ids.includes(subCompany.id)) this.setResourceSummary(summaries, type, subCompany.id, label, data);
            if (subCompany.cardcloudSubaccountId && ids.includes(subCompany.cardcloudSubaccountId)) this.setResourceSummary(summaries, type, subCompany.cardcloudSubaccountId, label, data);
        }
    }

    private setResourceSummary(summaries: Map<string, AuditResourceSummary>, type: string, id: string, label: string, data?: ResourceDataInput): void {
        const compactData = data ? this.compactData(data) : undefined;
        summaries.set(this.resourceKey(type, id), {
            type,
            id,
            label: label || `${type} ${id}`,
            ...(compactData && Object.keys(compactData).length > 0 ? { data: compactData } : {}),
        });
    }

    private compactData(data: ResourceDataInput): AuditResourceSummaryData {
        return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as AuditResourceSummaryData;
    }

    private resourceKey(type: string, id: string): string {
        return `${type}:${id}`;
    }

    private unique(values: Array<string | null | undefined>): string[] {
        return [...new Set(values.filter((value): value is string => Boolean(value)))];
    }

    private joinLabel(values: Array<string | number | null | undefined>): string {
        return values
            .filter((value): value is string | number => value !== null && value !== undefined && String(value).trim().length > 0)
            .map((value) => String(value).trim())
            .join(' - ');
    }

    private firstLabel(values: Array<string | number | null | undefined>): string | undefined {
        const value = values.find((item) => item !== null && item !== undefined && String(item).trim().length > 0);
        return value === undefined || value === null ? undefined : String(value).trim();
    }

    private isoDate(value: Date | null | undefined): string | null | undefined {
        return value ? value.toISOString() : value;
    }

    private requestWhere(dto: FindAuditEventsDto, scope: AuditQueryScope): Prisma.RequestLogWhereInput {
        if (scope.subCompanyId) return { id: '__never__' };
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
        if (dto.method) return { id: '__never__' };
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
            ...this.subCompanyWhere(scope),
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

    private subCompanyWhere(scope: AuditQueryScope): { scopeKey?: string; scopeId?: string | Prisma.StringNullableFilter } {
        return scope.subCompanyId ? { scopeKey: 'subCompanyId', scopeId: scope.subCompanyId } : {};
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
