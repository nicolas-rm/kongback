import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { AuditService } from '@/modules/audit/audit.service';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { scopedSubCompanyIdFilter, subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
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
        const where: Prisma.DriverWhereInput = {
            subCompanyId: scopedSubCompanyIdFilter(dto.subCompanyId, scope),
            subCompany: subCompanyScopeWhere(scope),
            userId: dto.userId,
            status: dto.status,
            ...(dto.search ? { OR: this.driverSearch(dto.search) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string, scope?: CompanyScope) {
        const driver = await this.repository.findById(id, scope);
        if (!driver) throw notFound();
        return driver;
    }

    async findVehicles(id: string, dto: FindStatusRecordsDto, scope?: CompanyScope) {
        const driver = await this.repository.findById(id, scope);
        if (!driver) throw notFound();

        const where: Prisma.VehicleWhereInput = {
            driverId: id,
            subCompany: subCompanyScopeWhere(scope),
            status: dto.status,
            ...(dto.search ? { OR: this.vehicleSearch(dto.search) } : {}),
        };
        const [data, total] = await Promise.all([this.vehicles.findMany(where, dto.skip, dto.actualLimit), this.vehicles.count(where)]);
        return paginate(data, total, dto);
    }

    async update(id: string, dto: UpdateDriverDto, scope?: CompanyScope) {
        await assertActive([{ ids: [dto.userId], count: (ids) => this.relations.countActiveUsers(ids) }]);
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
}
