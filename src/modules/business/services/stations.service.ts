import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { assertActive, notFound, textSearch, toAddressData } from '@/modules/business/business.helpers';
import { CreateStationDto, FindStationsDto, UpdateStationDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { StationsRepository } from '@/modules/business/repositories/stations.repository';

@Injectable()
export class StationsService {
    constructor(
        private readonly repository: StationsRepository,
        private readonly relations: BusinessRelationsRepository
    ) {}

    async create(organizationId: string, dto: CreateStationDto) {
        await assertActive([{ ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids, organizationId) }]);

        return this.repository.create(
            {
                subCompanyId: dto.subCompanyId,
                stationNumber: dto.stationNumber,
                name: dto.name,
                lat: dto.lat ?? null,
                lon: dto.lon ?? null,
                status: dto.status ?? Status.active,
            },
            toAddressData(dto.address)
        );
    }

    async findAll(organizationId: string, dto: FindStationsDto) {
        const where: Prisma.StationWhereInput = {
            subCompanyId: dto.subCompanyId,
            subCompany: { company: { organizationId } },
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.StationWhereInput>(dto.search, ['stationNumber', 'name']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(organizationId: string, id: string) {
        const station = await this.repository.findById(id, organizationId);
        if (!station) throw notFound();
        return station;
    }

    async update(organizationId: string, id: string, dto: UpdateStationDto) {
        const station = await this.repository.update(
            id,
            organizationId,
            {
                stationNumber: dto.stationNumber,
                name: dto.name,
                lat: dto.lat,
                lon: dto.lon,
                status: dto.status,
            },
            toAddressData(dto.address)
        );
        if (!station) throw notFound();
        return station;
    }

    async deactivate(organizationId: string, id: string) {
        const station = await this.repository.deactivate(id, organizationId);
        if (!station) throw notFound();
        return { id: station.id, status: station.status };
    }
}
