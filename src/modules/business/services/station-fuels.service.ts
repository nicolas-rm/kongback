import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { assertActive, notFound } from '@/modules/business/business.helpers';
import { CreateStationFuelDto, FindStationFuelsDto, UpdateStationFuelDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { StationFuelsRepository } from '@/modules/business/repositories/station-fuels.repository';

@Injectable()
export class StationFuelsService {
    constructor(
        private readonly repository: StationFuelsRepository,
        private readonly relations: BusinessRelationsRepository
    ) {}

    async create(dto: CreateStationFuelDto) {
        await assertActive([
            { ids: [dto.stationId], count: (ids) => this.relations.countActiveStations(ids) },
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
        ]);

        return this.repository.create({
            stationId: dto.stationId,
            fuelId: dto.fuelId,
            status: dto.status ?? Status.active,
        });
    }

    async findAll(dto: FindStationFuelsDto) {
        const where: Prisma.StationFuelWhereInput = {
            stationId: dto.stationId,
            fuelId: dto.fuelId,
            status: dto.status,
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string) {
        const stationFuel = await this.repository.findById(id);
        if (!stationFuel) throw notFound();
        return stationFuel;
    }

    async update(id: string, dto: UpdateStationFuelDto) {
        const stationFuel = await this.repository.update(id, {
            status: dto.status,
        });
        if (!stationFuel) throw notFound();
        return stationFuel;
    }

    async deactivate(id: string) {
        const stationFuel = await this.repository.deactivate(id);
        if (!stationFuel) throw notFound();
        return { id: stationFuel.id, status: stationFuel.status };
    }
}
