import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { I18N_KEYS, I18nBadRequestException } from '@/i18n';
import { AuditService } from '@/modules/audit/audit.service';
import { createExcelExport, EXCEL_EXPORT_MAX_ROWS, formatStatus, valueOrDash } from '@/utilities/export/excel-export';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { isAdministrativePermissionForCardholder, isCardholderPermissionCode, isCardholderRoleCode } from '@/utilities/authentication/cardholder-access-policy';
import { scopedSubCompanyIdFilter, SUB_COMPANY_SCOPE_KEY, subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { assertActive, notFound, toAddressData } from '@/modules/business/business.helpers';
import { CreateDriverDto, FindDriversDto, FindStatusRecordsDto, UpdateDriverDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { DriversRepository } from '@/modules/business/repositories/drivers.repository';
import { VehiclesRepository } from '@/modules/business/repositories/vehicles.repository';

@Injectable()
export class DriversService {
    constructor(
        private readonly repository: DriversRepository,
        private readonly relations: BusinessRelationsRepository,
        private readonly vehicles: VehiclesRepository,
        private readonly audit: AuditService
    ) {}

    async create(dto: CreateDriverDto, scope?: CompanyScope) {
        await assertActive([
            { ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids, scope) },
            { ids: [dto.userId], count: (ids) => this.relations.countActiveUsers(ids) },
        ]);
        await this.assertAssignedUserIsCardholder(dto.userId, dto.subCompanyId);
        const driver = await this.repository.create(
            {
                subCompanyId: dto.subCompanyId,
                userId: dto.userId ?? null,
                name: dto.name,
                externalReference: dto.externalReference ?? null,
                status: dto.status ?? Status.active,
            },
            toAddressData(dto.address)
        );
        void this.audit.recordBusiness({ action: 'driver_created', resourceType: 'Driver', resourceId: driver.id, after: driver });
        return driver;
    }

    async findAll(dto: FindDriversDto, scope?: CompanyScope) {
        const where = this.buildWhere(dto, scope);
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async exportList(dto: FindDriversDto, scope?: CompanyScope) {
        const where = this.buildWhere(dto, scope);
        const drivers = await this.repository.findMany(where, 0, EXCEL_EXPORT_MAX_ROWS);
        void this.audit.recordBusiness({
            action: 'drivers_exported',
            resourceType: 'Driver',
            metadata: { rows: drivers.length, subCompanyId: dto.subCompanyId, userId: dto.userId, status: dto.status, search: dto.search, format: dto.format ?? 'xlsx' },
        });

        return createExcelExport(
            'conductores.xlsx',
            'Conductores',
            [
                { header: 'ID', value: (driver) => driver.id },
                { header: 'Nombre', value: (driver) => driver.name },
                { header: 'Referencia externa', value: (driver) => valueOrDash(driver.externalReference) },
                { header: 'Usuario', value: (driver) => (driver.user ? `${driver.user.username} - ${driver.user.fullName}` : '-') },
                { header: 'Subcompania', value: (driver) => `${driver.subCompany.key} - ${driver.subCompany.name}` },
                { header: 'Estado', value: (driver) => formatStatus(driver.status) },
            ],
            drivers,
            dto.format
        );
    }

    async findOne(id: string, scope?: CompanyScope) {
        const driver = await this.repository.findById(id, scope);
        if (!driver) throw notFound();
        return driver;
    }

    async findVehicles(id: string, dto: FindStatusRecordsDto, scope?: CompanyScope) {
        await this.assertDriverExists(id, scope);
        const where = this.buildVehiclesWhere(id, dto, scope);
        const [data, total] = await Promise.all([this.vehicles.findMany(where, dto.skip, dto.actualLimit), this.vehicles.count(where)]);
        return paginate(data, total, dto);
    }

    async exportVehicles(id: string, dto: FindStatusRecordsDto, scope?: CompanyScope) {
        await this.assertDriverExists(id, scope);
        const where = this.buildVehiclesWhere(id, dto, scope);
        const vehicles = await this.vehicles.findMany(where, 0, EXCEL_EXPORT_MAX_ROWS);
        void this.audit.recordBusiness({
            action: 'driver_vehicles_exported',
            resourceType: 'Driver',
            resourceId: id,
            metadata: { rows: vehicles.length, status: dto.status, search: dto.search, format: dto.format ?? 'xlsx' },
        });

        return createExcelExport(
            'vehiculos-del-conductor.xlsx',
            'Vehiculos del conductor',
            [
                { header: 'ID', value: (vehicle) => vehicle.id },
                { header: 'Placas', value: (vehicle) => vehicle.plates },
                { header: 'Numero economico', value: (vehicle) => valueOrDash(vehicle.economicNumber) },
                { header: 'Modelo', value: (vehicle) => valueOrDash(vehicle.model) },
                { header: 'Ano', value: (vehicle) => valueOrDash(vehicle.year) },
                { header: 'Combustible', value: (vehicle) => `${vehicle.fuel.code} - ${vehicle.fuel.name}` },
                { header: 'Control de odometro', value: (vehicle) => (vehicle.odometerControl ? 'Si' : 'No') },
                { header: 'Odometro inicial', value: (vehicle) => valueOrDash(vehicle.odometerInitial) },
                { header: 'Subcompania', value: (vehicle) => `${vehicle.subCompany.key} - ${vehicle.subCompany.name}` },
                { header: 'Estado', value: (vehicle) => formatStatus(vehicle.status) },
            ],
            vehicles,
            dto.format
        );
    }

    async update(id: string, dto: UpdateDriverDto, scope?: CompanyScope) {
        await assertActive([{ ids: [dto.userId], count: (ids) => this.relations.countActiveUsers(ids) }]);
        if (dto.userId) {
            const currentDriver = await this.repository.findById(id, scope);
            if (!currentDriver) throw notFound();
            await this.assertAssignedUserIsCardholder(dto.userId, currentDriver.subCompanyId);
        }
        const driver = await this.repository.update(
            id,
            {
                userId: dto.userId,
                name: dto.name,
                externalReference: dto.externalReference,
                status: dto.status,
            },
            toAddressData(dto.address),
            scope
        );
        if (!driver) throw notFound();
        void this.audit.recordBusiness({ action: 'driver_updated', resourceType: 'Driver', resourceId: driver.id, metadata: dto, after: driver });
        return driver;
    }

    async deactivate(id: string, scope?: CompanyScope) {
        const driver = await this.repository.deactivate(id, scope);
        if (!driver) throw notFound();
        void this.audit.recordBusiness({ action: 'driver_deactivated', resourceType: 'Driver', resourceId: driver.id, after: { id: driver.id, status: driver.status } });
        return { id: driver.id, status: driver.status };
    }

    private driverSearch(search: string): Prisma.DriverWhereInput[] {
        const contains: Prisma.StringFilter = { contains: search, mode: 'insensitive' };

        return [
            { name: contains },
            { externalReference: contains },
            { subCompany: { key: contains } },
            { subCompany: { name: contains } },
            { user: { is: { username: contains } } },
            { user: { is: { fullName: contains } } },
        ];
    }

    private buildWhere(dto: FindDriversDto, scope?: CompanyScope): Prisma.DriverWhereInput {
        return {
            subCompanyId: scopedSubCompanyIdFilter(dto.subCompanyId, scope),
            subCompany: subCompanyScopeWhere(scope),
            userId: dto.userId,
            status: dto.status,
            ...(dto.search ? { OR: this.driverSearch(dto.search) } : {}),
        };
    }

    private vehicleSearch(search: string): Prisma.VehicleWhereInput[] {
        const contains: Prisma.StringFilter = { contains: search, mode: 'insensitive' };

        return [
            { plates: contains },
            { economicNumber: contains },
            { model: contains },
            { subCompany: { key: contains } },
            { subCompany: { name: contains } },
            { fuel: { code: contains } },
            { fuel: { name: contains } },
            { driver: { is: { name: contains } } },
        ];
    }

    private buildVehiclesWhere(driverId: string, dto: FindStatusRecordsDto, scope?: CompanyScope): Prisma.VehicleWhereInput {
        return {
            driverId,
            subCompany: subCompanyScopeWhere(scope),
            status: dto.status,
            ...(dto.search ? { OR: this.vehicleSearch(dto.search) } : {}),
        };
    }

    private async assertDriverExists(id: string, scope?: CompanyScope): Promise<void> {
        const driver = await this.repository.findById(id, scope);
        if (!driver) throw notFound();
    }

    private async assertAssignedUserIsCardholder(userId: string | null | undefined, subCompanyId: string): Promise<void> {
        if (!userId) return;

        const accesses = await this.relations.findActiveUserAccessProfiles(userId);
        if (accesses.length === 0) {
            throw new I18nBadRequestException(I18N_KEYS.errors.users.cardholderRequired, 'El usuario asignado al conductor debe tener solo perfil de tarjetahabiente.');
        }

        const profiles = accesses.map((access) => {
            const permissionCodes = access.role.permissions.map((entry) => entry.permission.code);
            const hasCardholderPermissions = permissionCodes.some(isCardholderPermissionCode);
            const hasAdministrativePermissions = permissionCodes.some(isAdministrativePermissionForCardholder);

            return {
                companyId: access.companyId,
                scopeKey: access.scopeKey,
                scopeId: access.scopeId,
                isCardholderRole: isCardholderRoleCode(access.role.code) || hasCardholderPermissions,
                hasAdministrativePermissions,
            };
        });

        if (profiles.some((profile) => !profile.isCardholderRole)) {
            throw new I18nBadRequestException(I18N_KEYS.errors.users.cardholderRequired, 'El usuario asignado al conductor debe tener solo perfil de tarjetahabiente.');
        }

        if (profiles.some((profile) => profile.hasAdministrativePermissions)) {
            throw new I18nBadRequestException(I18N_KEYS.errors.users.cardholderAdministrativePermissions, 'El perfil de tarjetahabiente no puede mezclarse con permisos administrativos.');
        }

        const hasMismatch = profiles.some((access) => !access.companyId || access.scopeKey !== SUB_COMPANY_SCOPE_KEY || access.scopeId !== subCompanyId);
        if (hasMismatch) {
            throw new I18nBadRequestException(I18N_KEYS.errors.users.cardholderDriverSubCompanyMismatch, 'El alcance del tarjetahabiente debe coincidir con la subcompania de su conductor activo.');
        }
    }
}
