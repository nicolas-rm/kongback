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

    async create(organizationId: string, dto: CreateStationFuelDto, companyId?: string) {
        await assertActive([
            { ids: [dto.stationId], count: (ids) => this.relations.countActiveStations(ids, organizationId, companyId) },
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
        ]);

        return this.repository.create({
            stationId: dto.stationId,
            fuelId: dto.fuelId,
            status: dto.status ?? Status.active,
        });
    }

    async findAll(organizationId: string, dto: FindStationFuelsDto, companyId?: string) {
        const where: Prisma.StationFuelWhereInput = {
            stationId: dto.stationId,
            station: { subCompany: { company: { organizationId, ...(companyId ? { id: companyId } : {}) } } },
            fuelId: dto.fuelId,
            status: dto.status,
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(organizationId: string, id: string, companyId?: string) {
        const stationFuel = await this.repository.findById(id, organizationId, companyId);
        if (!stationFuel) throw notFound();
        return stationFuel;
    }

    async update(organizationId: string, id: string, dto: UpdateStationFuelDto, companyId?: string) {
        const stationFuel = await this.repository.update(
            id,
            organizationId,
            {
                status: dto.status,
            },
            companyId
        );
        if (!stationFuel) throw notFound();
        return stationFuel;
    }

    async deactivate(organizationId: string, id: string, companyId?: string) {
        const stationFuel = await this.repository.deactivate(id, organizationId, companyId);
        if (!stationFuel) throw notFound();
        return { id: stationFuel.id, status: stationFuel.status };
    }
}
