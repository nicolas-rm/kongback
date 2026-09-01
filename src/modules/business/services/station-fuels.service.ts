import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { AuditService } from '@/modules/audit/audit.service';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { assertActive, notFound } from '@/modules/business/business.helpers';
import { CreateStationFuelDto, FindStationFuelsDto, UpdateStationFuelDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { StationFuelsRepository } from '@/modules/business/repositories/station-fuels.repository';

@Injectable()
export class StationFuelsService {
    constructor(
        private readonly repository: StationFuelsRepository,
        private readonly relations: BusinessRelationsRepository,
        private readonly audit: AuditService
    ) {}

    async create(dto: CreateStationFuelDto, scope?: CompanyScope) {
        await assertActive([
            { ids: [dto.stationId], count: (ids) => this.relations.countActiveStations(ids, scope) },
            { ids: [dto.fuelId], count: (ids) => this.relations.countActiveFuels(ids) },
        ]);

        const stationFuel = await this.repository.createOrReactivate({
            stationId: dto.stationId,
            fuelId: dto.fuelId,
            status: dto.status ?? Status.active,
        });
        void this.audit.recordBusiness({ action: 'station_fuel_created', resourceType: 'StationFuel', resourceId: stationFuel.id, after: stationFuel });
        return stationFuel;
    }

    async findAll(dto: FindStationFuelsDto, scope?: CompanyScope) {
        const where: Prisma.StationFuelWhereInput = {
            stationId: dto.stationId,
            station: { subCompany: subCompanyScopeWhere(scope) },
            fuelId: dto.fuelId,
            status: dto.status,
            ...(dto.search ? { OR: this.stationFuelSearch(dto.search) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string, scope?: CompanyScope) {
        const stationFuel = await this.repository.findById(id, scope);
        if (!stationFuel) throw notFound();
        return stationFuel;
    }

    async update(id: string, dto: UpdateStationFuelDto, scope?: CompanyScope) {
        const stationFuel = await this.repository.update(
            id,
            {
                status: dto.status,
            },
            scope
        );
        if (!stationFuel) throw notFound();
        void this.audit.recordBusiness({ action: 'station_fuel_updated', resourceType: 'StationFuel', resourceId: stationFuel.id, metadata: dto, after: stationFuel });
        return stationFuel;
    }

    async deactivate(id: string, scope?: CompanyScope) {
        const stationFuel = await this.repository.deactivate(id, scope);
        if (!stationFuel) throw notFound();
        void this.audit.recordBusiness({ action: 'station_fuel_deactivated', resourceType: 'StationFuel', resourceId: stationFuel.id, after: { id: stationFuel.id, status: stationFuel.status } });
        return { id: stationFuel.id, status: stationFuel.status };
    }

    private stationFuelSearch(search: string): Prisma.StationFuelWhereInput[] {
        const contains: Prisma.StringFilter = { contains: search, mode: 'insensitive' };

        return [{ station: { stationNumber: contains } }, { station: { name: contains } }, { fuel: { code: contains } }, { fuel: { name: contains } }];
    }
}
