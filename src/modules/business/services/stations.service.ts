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

    async create(dto: CreateStationDto) {
        await assertActive([{ ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids) }]);

        return this.repository.create(
            {
                subCompanyId: dto.subCompanyId,
                stationNumber: dto.stationNumber,
                name: dto.name,
                legalName: dto.legalName ?? null,
                taxId: dto.taxId ?? null,
                sic: dto.sic ?? null,
                lat: dto.lat ?? null,
                lon: dto.lon ?? null,
                commissionPercent: dto.commissionPercent ?? null,
                status: dto.status ?? Status.active,
            },
            toAddressData(dto.address)
        );
    }

    async findAll(dto: FindStationsDto) {
        const where: Prisma.StationWhereInput = {
            subCompanyId: dto.subCompanyId,
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.StationWhereInput>(dto.search, ['stationNumber', 'name', 'legalName', 'taxId', 'sic']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string) {
        const station = await this.repository.findById(id);
        if (!station) throw notFound();
        return station;
    }

    async update(id: string, dto: UpdateStationDto) {
        const station = await this.repository.update(
            id,
            {
                stationNumber: dto.stationNumber,
                name: dto.name,
                legalName: dto.legalName,
                taxId: dto.taxId,
                sic: dto.sic,
                lat: dto.lat,
                lon: dto.lon,
                commissionPercent: dto.commissionPercent,
                status: dto.status,
            },
            toAddressData(dto.address)
        );
        if (!station) throw notFound();
        return station;
    }

    async deactivate(id: string) {
        const station = await this.repository.deactivate(id);
        if (!station) throw notFound();
        return { id: station.id, status: station.status };
    }
}
