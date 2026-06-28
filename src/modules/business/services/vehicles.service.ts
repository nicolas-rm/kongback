import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { assertActive, notFound, textSearch } from '@/modules/business/business.helpers';
import { CreateVehicleDto, FindVehiclesDto, UpdateVehicleDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { VehiclesRepository } from '@/modules/business/repositories/vehicles.repository';

@Injectable()
export class VehiclesService {
    constructor(
        private readonly repository: VehiclesRepository,
        private readonly relations: BusinessRelationsRepository
    ) {}

    async create(dto: CreateVehicleDto) {
        await assertActive([
            { ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids) },
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
            { ids: [dto.driverId], count: (ids) => this.relations.countActiveDrivers(ids) },
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

    async findAll(dto: FindVehiclesDto) {
        const where: Prisma.VehicleWhereInput = {
            subCompanyId: dto.subCompanyId,
            fuelId: dto.fuelId,
            driverId: dto.driverId,
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.VehicleWhereInput>(dto.search, ['plates', 'economicNumber', 'model']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string) {
        const vehicle = await this.repository.findById(id);
        if (!vehicle) throw notFound();
        return vehicle;
    }

    async update(id: string, dto: UpdateVehicleDto) {
        await assertActive([
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
            { ids: [dto.driverId], count: (ids) => this.relations.countActiveDrivers(ids) },
        ]);

        const vehicle = await this.repository.update(id, {
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

    async deactivate(id: string) {
        const vehicle = await this.repository.deactivate(id);
        if (!vehicle) throw notFound();
        return { id: vehicle.id, status: vehicle.status };
    }
}
