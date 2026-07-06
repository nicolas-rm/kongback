import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
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

    async create(organizationId: string, dto: CreateVehicleDto, companyId?: string) {
        await assertActive([
            { ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids, organizationId, companyId) },
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
            { ids: [dto.driverId], count: (ids) => this.relations.countActiveDriversBySubCompany(ids, dto.subCompanyId, organizationId, companyId) },
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

    async findAll(organizationId: string, dto: FindVehiclesDto, companyId?: string) {
        const where: Prisma.VehicleWhereInput = {
            subCompanyId: dto.subCompanyId,
            subCompany: { company: { organizationId, ...(companyId ? { id: companyId } : {}) } },
            fuelId: dto.fuelId,
            driverId: dto.driverId,
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.VehicleWhereInput>(dto.search, ['plates', 'economicNumber', 'model']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(organizationId: string, id: string, companyId?: string) {
        const vehicle = await this.repository.findById(id, organizationId, companyId);
        if (!vehicle) throw notFound();
        return vehicle;
    }

    async update(organizationId: string, id: string, dto: UpdateVehicleDto, companyId?: string) {
        const current = dto.driverId ? await this.repository.findById(id, organizationId, companyId) : null;
        if (dto.driverId && !current) throw notFound();

        await assertActive([
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
            { ids: [dto.driverId], count: (ids) => this.relations.countActiveDriversBySubCompany(ids, current?.subCompanyId ?? '', organizationId, companyId) },
        ]);

        const vehicle = await this.repository.update(
            id,
            organizationId,
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
            companyId
        );
        if (!vehicle) throw notFound();
        return vehicle;
    }

    async setDriver(organizationId: string, id: string, dto: SetVehicleDriverDto, companyId?: string) {
        const current = await this.repository.findById(id, organizationId, companyId);
        if (!current) throw notFound();
        if (current.status !== Status.active) throw invalidRelation();

        await assertActive([{ ids: [dto.driverId], count: (ids) => this.relations.countActiveDriversBySubCompany(ids, current.subCompanyId, organizationId, companyId) }]);

        const vehicle = await this.repository.update(id, organizationId, { driverId: dto.driverId }, companyId);
        if (!vehicle) throw notFound();
        return { id: vehicle.id, driverId: vehicle.driverId };
    }

    async deactivate(organizationId: string, id: string, companyId?: string) {
        const vehicle = await this.repository.deactivate(id, organizationId, companyId);
        if (!vehicle) throw notFound();
        return { id: vehicle.id, status: vehicle.status };
    }
}
