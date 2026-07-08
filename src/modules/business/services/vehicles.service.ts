import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { scopedSubCompanyIdFilter, subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { assertActive, invalidRelation, notFound, textSearch } from '@/modules/business/business.helpers';
import { CreateVehicleDto, FindVehiclesDto, SetVehicleDriverDto, UpdateVehicleDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { VehiclesRepository } from '@/modules/business/repositories/vehicles.repository';

@Injectable()
export class VehiclesService {
    constructor(
        private readonly repository: VehiclesRepository,
        private readonly relations: BusinessRelationsRepository
    ) {}

    async create(dto: CreateVehicleDto, scope?: CompanyScope) {
        await assertActive([
            { ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids, scope) },
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
            { ids: [dto.driverId], count: (ids) => this.relations.countActiveDriversBySubCompany(ids, dto.subCompanyId, scope) },
        ]);

        return this.repository.create({
            subCompanyId: dto.subCompanyId,
            fuelId: dto.fuelId,
            driverId: dto.driverId ?? null,
            plates: dto.plates,
            economicNumber: dto.economicNumber ?? null,
            model: dto.model ?? null,
            year: dto.year ?? null,
            odometerControl: dto.odometerControl ?? false,
            odometerInitial: dto.odometerInitial ?? null,
            status: dto.status ?? Status.active,
        });
    }

    async findAll(dto: FindVehiclesDto, scope?: CompanyScope) {
        const where: Prisma.VehicleWhereInput = {
            subCompanyId: scopedSubCompanyIdFilter(dto.subCompanyId, scope),
            subCompany: subCompanyScopeWhere(scope),
            fuelId: dto.fuelId,
            driverId: dto.driverId,
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.VehicleWhereInput>(dto.search, ['plates', 'economicNumber', 'model']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string, scope?: CompanyScope) {
        const vehicle = await this.repository.findById(id, scope);
        if (!vehicle) throw notFound();
        return vehicle;
    }

    async update(id: string, dto: UpdateVehicleDto, scope?: CompanyScope) {
        const current = dto.driverId ? await this.repository.findById(id, scope) : null;
        if (dto.driverId && !current) throw notFound();

        await assertActive([
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
            { ids: [dto.driverId], count: (ids) => this.relations.countActiveDriversBySubCompany(ids, current?.subCompanyId ?? '', scope) },
        ]);

        const vehicle = await this.repository.update(
            id,
            {
                fuelId: dto.fuelId,
                driverId: dto.driverId,
                plates: dto.plates,
                economicNumber: dto.economicNumber,
                model: dto.model,
                year: dto.year,
                odometerControl: dto.odometerControl,
                odometerInitial: dto.odometerInitial,
                status: dto.status,
            },
            scope
        );
        if (!vehicle) throw notFound();
        return vehicle;
    }

    async setDriver(id: string, dto: SetVehicleDriverDto, scope?: CompanyScope) {
        const current = await this.repository.findById(id, scope);
        if (!current) throw notFound();
        if (current.status !== Status.active) throw invalidRelation();

        await assertActive([{ ids: [dto.driverId], count: (ids) => this.relations.countActiveDriversBySubCompany(ids, current.subCompanyId, scope) }]);

        const vehicle = await this.repository.update(id, { driverId: dto.driverId }, scope);
        if (!vehicle) throw notFound();
        return { id: vehicle.id, driverId: vehicle.driverId };
    }

    async deactivate(id: string, scope?: CompanyScope) {
        const vehicle = await this.repository.deactivate(id, scope);
        if (!vehicle) throw notFound();
        return { id: vehicle.id, status: vehicle.status };
    }
}
