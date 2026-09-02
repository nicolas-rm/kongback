import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { createExcelExport, EXCEL_EXPORT_MAX_ROWS, formatBoolean, formatStatus, joinValues, valueOrDash } from '@/utilities/export/excel-export';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { SUB_COMPANY_SCOPE_KEY, subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { AuditService } from '@/modules/audit/audit.service';
import { FindCardholdersDto } from '@/modules/cardholders/dto';
import { CardholdersRepository, type CardholderUserRecord } from '@/modules/cardholders/repositories/cardholders.repository';

const CARDHOLDER_PERMISSION_PREFIX = 'cardholder.';

@Injectable()
export class CardholdersService {
    constructor(
        private readonly repository: CardholdersRepository,
        private readonly audit: AuditService
    ) {}

    async findAll(dto: FindCardholdersDto, scope?: CompanyScope) {
        const where = this.buildWhere(dto, scope);
        const [records, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);

        void this.audit.recordCard({
            action: 'cardholders_list_consulted',
            resourceType: 'Cardholder',
            metadata: { total, returned: records.length, subCompanyId: dto.subCompanyId, hasDriver: dto.hasDriver, hasCards: dto.hasCards, status: dto.status },
        });

        return paginate(
            records.map((record) => this.serialize(record, scope)),
            total,
            dto
        );
    }

    async exportList(dto: FindCardholdersDto, scope?: CompanyScope) {
        const where = this.buildWhere(dto, scope);
        const records = await this.repository.findMany(where, 0, EXCEL_EXPORT_MAX_ROWS);
        const cardholders = records.map((record) => this.serialize(record, scope));

        void this.audit.recordCard({
            action: 'cardholders_exported',
            resourceType: 'Cardholder',
            metadata: {
                rows: cardholders.length,
                subCompanyId: dto.subCompanyId,
                hasDriver: dto.hasDriver,
                hasCards: dto.hasCards,
                status: dto.status,
                search: dto.search,
                format: dto.format ?? 'xlsx',
            },
        });

        return createExcelExport(
            'tarjetahabientes.xlsx',
            'Tarjetahabientes',
            [
                { header: 'ID', value: (cardholder) => cardholder.id },
                { header: 'Usuario', value: (cardholder) => cardholder.username },
                { header: 'Email', value: (cardholder) => cardholder.email },
                { header: 'Nombre', value: (cardholder) => cardholder.fullName },
                { header: 'Estado', value: (cardholder) => formatStatus(cardholder.status) },
                { header: 'Operativo', value: (cardholder) => formatBoolean(cardholder.isOperational) },
                { header: 'Conductor', value: (cardholder) => valueOrDash(cardholder.driver?.name) },
                { header: 'Referencia conductor', value: (cardholder) => valueOrDash(cardholder.driver?.externalReference) },
                { header: 'Subcompania conductor', value: (cardholder) => (cardholder.driver ? `${cardholder.driver.subCompany.key} - ${cardholder.driver.subCompany.name}` : '-') },
                { header: 'Vehiculos', value: (cardholder) => joinValues(cardholder.vehicles.map((vehicle) => joinValues([vehicle.plates, vehicle.economicNumber]))) },
                {
                    header: 'Tarjetas',
                    value: (cardholder) =>
                        joinValues(
                            cardholder.vehicles
                                .map((vehicle) => vehicle.card)
                                .filter((card): card is NonNullable<(typeof cardholder.vehicles)[number]['card']> => Boolean(card))
                                .map((card) => card.stock?.clientId ?? card.stock?.maskedPan ?? card.externalId)
                        ),
                },
            ],
            cardholders,
            dto.format
        );
    }

    private buildWhere(dto: FindCardholdersDto, scope?: CompanyScope): Prisma.UserWhereInput {
        const driverScope = this.driverScopeWhere(dto, scope);
        const cardFilter: Prisma.VehicleWhereInput = { subCompany: subCompanyScopeWhere(scope), card: { isNot: null } };
        if (dto.subCompanyId) cardFilter.subCompanyId = dto.subCompanyId;

        const and: Prisma.UserWhereInput[] = [{ accesses: { some: this.cardholderAccessWhere(dto, scope) } }];
        if (dto.status) and.push({ status: dto.status });
        if (dto.hasDriver === true) and.push({ driver: { is: driverScope } });
        if (dto.hasDriver === false) and.push({ OR: [{ driver: null }, { driver: { isNot: driverScope } }] });
        if (dto.hasCards === true) and.push({ driver: { is: { ...driverScope, vehicles: { some: cardFilter } } } });
        if (dto.hasCards === false) and.push({ OR: [{ driver: null }, { driver: { is: { ...driverScope, vehicles: { none: cardFilter } } } }, { driver: { isNot: driverScope } }] });
        if (dto.search) {
            and.push({
                OR: this.cardholderSearch(dto, scope),
            });
        }

        return { AND: and };
    }

    private cardholderAccessWhere(dto: FindCardholdersDto, scope?: CompanyScope): Prisma.UserAccessWhereInput {
        return {
            companyId: scope?.companyId,
            company: { status: Status.active },
            role: {
                permissions: {
                    some: {
                        permission: {
                            code: { startsWith: CARDHOLDER_PERMISSION_PREFIX },
                        },
                    },
                },
            },
            ...(scope?.subCompanyIds ? { scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: { in: scope.subCompanyIds } } : {}),
            ...(dto.subCompanyId ? { scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: dto.subCompanyId } : {}),
        };
    }

    private driverScopeWhere(dto: FindCardholdersDto, scope?: CompanyScope): Prisma.DriverWhereInput {
        return {
            subCompany: subCompanyScopeWhere(scope),
            ...(dto.subCompanyId ? { subCompanyId: dto.subCompanyId } : {}),
        };
    }

    private cardholderSearch(dto: FindCardholdersDto, scope?: CompanyScope): Prisma.UserWhereInput[] {
        const search = dto.search ?? '';
        const contains: Prisma.StringFilter = { contains: search, mode: 'insensitive' };
        const driverScope = this.driverScopeWhere(dto, scope);
        const vehicleScope: Prisma.VehicleWhereInput = {
            subCompany: subCompanyScopeWhere(scope),
            ...(dto.subCompanyId ? { subCompanyId: dto.subCompanyId } : {}),
        };

        return [
            { username: contains },
            { email: contains },
            { fullName: contains },
            { driver: { is: { ...driverScope, name: contains } } },
            { driver: { is: { ...driverScope, externalReference: contains } } },
            { driver: { is: { ...driverScope, subCompany: { ...subCompanyScopeWhere(scope), key: contains } } } },
            { driver: { is: { ...driverScope, subCompany: { ...subCompanyScopeWhere(scope), name: contains } } } },
            { driver: { is: { ...driverScope, vehicles: { some: { ...vehicleScope, plates: contains } } } } },
            { driver: { is: { ...driverScope, vehicles: { some: { ...vehicleScope, economicNumber: contains } } } } },
            { driver: { is: { ...driverScope, vehicles: { some: { ...vehicleScope, card: { is: { externalId: contains } } } } } } },
            { driver: { is: { ...driverScope, vehicles: { some: { ...vehicleScope, card: { is: { stock: { is: { maskedPan: contains } } } } } } } } },
            { driver: { is: { ...driverScope, vehicles: { some: { ...vehicleScope, card: { is: { stock: { is: { clientId: contains } } } } } } } } },
            { driver: { is: { ...driverScope, vehicles: { some: { ...vehicleScope, card: { is: { stock: { is: { providerStatus: contains } } } } } } } } },
        ];
    }

    private serialize(record: CardholderUserRecord, scope?: CompanyScope) {
        const driver = this.isDriverVisible(record.driver, scope) ? record.driver : null;
        const vehicles = driver?.vehicles.filter((vehicle) => this.isSubCompanyVisible(vehicle.subCompanyId, scope)) ?? [];
        const cards = vehicles.map((vehicle) => vehicle.card).filter((card): card is NonNullable<(typeof vehicles)[number]['card']> => Boolean(card));

        return {
            id: record.id,
            username: record.username,
            email: record.email,
            fullName: record.fullName,
            status: record.status,
            isOperational: Boolean(driver && vehicles.length > 0 && cards.length > 0),
            counts: {
                vehicles: vehicles.length,
                cards: cards.length,
            },
            accesses: record.accesses
                .filter((access) => this.isCardholderAccessVisible(access, scope))
                .map((access) => ({
                    id: access.id,
                    companyId: access.companyId,
                    scopeKey: access.scopeKey,
                    scopeId: access.scopeId,
                    role: {
                        id: access.role.id,
                        code: access.role.code,
                        name: access.role.name,
                    },
                })),
            driver: driver
                ? {
                      id: driver.id,
                      subCompanyId: driver.subCompanyId,
                      name: driver.name,
                      externalReference: driver.externalReference,
                      status: driver.status,
                      subCompany: driver.subCompany,
                  }
                : null,
            vehicles: vehicles.map((vehicle) => ({
                id: vehicle.id,
                subCompanyId: vehicle.subCompanyId,
                plates: vehicle.plates,
                economicNumber: vehicle.economicNumber,
                status: vehicle.status,
                card: vehicle.card
                    ? {
                          id: vehicle.card.id,
                          externalId: vehicle.card.externalId,
                          status: vehicle.card.status,
                          stock: vehicle.card.stock,
                      }
                    : null,
            })),
        };
    }

    private isDriverVisible(driver: CardholderUserRecord['driver'], scope?: CompanyScope): driver is NonNullable<CardholderUserRecord['driver']> {
        if (!driver) return false;
        if (scope?.companyId && driver.subCompany.companyId !== scope.companyId) return false;
        return this.isSubCompanyVisible(driver.subCompanyId, scope);
    }

    private isSubCompanyVisible(subCompanyId: string, scope?: CompanyScope): boolean {
        return !scope?.subCompanyIds || scope.subCompanyIds.includes(subCompanyId);
    }

    private isCardholderAccessVisible(access: CardholderUserRecord['accesses'][number], scope?: CompanyScope): boolean {
        const hasCardholderPermission = access.role.permissions.some((entry) => entry.permission.code.startsWith(CARDHOLDER_PERMISSION_PREFIX));
        if (!hasCardholderPermission) return false;
        if (scope?.companyId && access.companyId !== scope.companyId) return false;
        if (!scope?.subCompanyIds) return true;
        return access.scopeKey === SUB_COMPANY_SCOPE_KEY && typeof access.scopeId === 'string' && scope.subCompanyIds.includes(access.scopeId);
    }
}
