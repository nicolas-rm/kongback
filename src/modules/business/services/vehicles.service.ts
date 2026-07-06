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

    async create(organizationId: string, dto: CreateVehicleDto) {
        await assertActive([
            { ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids, organizationId) },
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
            { ids: [dto.driverId], count: (ids) => this.relations.countActiveDriversBySubCompany(ids, dto.subCompanyId, organizationId) },
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

    async findAll(organizationId: string, dto: FindVehiclesDto) {
        const where: Prisma.VehicleWhereInput = {
            subCompanyId: dto.subCompanyId,
            subCompany: { company: { organizationId } },
            fuelId: dto.fuelId,
            driverId: dto.driverId,
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.VehicleWhereInput>(dto.search, ['plates', 'economicNumber', 'model']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(organizationId: string, id: string) {
        const vehicle = await this.repository.findById(id, organizationId);
        if (!vehicle) throw notFound();
        return vehicle;
    }

    async update(organizationId: string, id: string, dto: UpdateVehicleDto) {
        const current = dto.driverId ? await this.repository.findById(id, organizationId) : null;
        if (dto.driverId && !current) throw notFound();

        await assertActive([
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
            { ids: [dto.driverId], count: (ids) => this.relations.countActiveDriversBySubCompany(ids, current?.subCompanyId ?? '', organizationId) },
        ]);

        const vehicle = await this.repository.update(id, organizationId, {
            fuelId: dto.fuelId,
            driverId: dto.driverId,
            plates: dto.plates,
            economicNumber: dto.economicNumber,
            model: dto.model,
            year: dto.year,
            odometerControl: dto.odometerControl,
            odometerInitial: dto.odometerInitial,
            status: dto.status,
        });
        if (!vehicle) throw notFound();
        return vehicle;
    }

    async setDriver(organizationId: string, id: string, dto: SetVehicleDriverDto) {
        const current = await this.repository.findById(id, organizationId);
        if (!current) throw notFound();
        if (current.status !== Status.active) throw invalidRelation();

        await assertActive([{ ids: [dto.driverId], count: (ids) => this.relations.countActiveDriversBySubCompany(ids, current.subCompanyId, organizationId) }]);

        const vehicle = await this.repository.update(id, organizationId, { driverId: dto.driverId });
        if (!vehicle) throw notFound();
        return { id: vehicle.id, driverId: vehicle.driverId };
    }

    async deactivate(organizationId: string, id: string) {
        const vehicle = await this.repository.deactivate(id, organizationId);
        if (!vehicle) throw notFound();
        return { id: vehicle.id, status: vehicle.status };
    }
}
