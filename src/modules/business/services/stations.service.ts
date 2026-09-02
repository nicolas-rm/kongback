import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { AuditService } from '@/modules/audit/audit.service';
import { createExcelExport, EXCEL_EXPORT_MAX_ROWS, formatStatus, valueOrDash } from '@/utilities/export/excel-export';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { scopedSubCompanyIdFilter, subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { assertActive, notFound, toAddressData } from '@/modules/business/business.helpers';
import { CreateStationDto, FindStationsDto, UpdateStationDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { StationsRepository } from '@/modules/business/repositories/stations.repository';

@Injectable()
export class StationsService {
    constructor(
        private readonly repository: StationsRepository,
        private readonly relations: BusinessRelationsRepository,
        private readonly audit: AuditService
    ) {}

    async create(dto: CreateStationDto, scope?: CompanyScope) {
        await assertActive([{ ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids, scope) }]);

        const station = await this.repository.create(
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
        void this.audit.recordBusiness({ action: 'station_created', resourceType: 'Station', resourceId: station.id, after: station });
        return station;
    }

    async findAll(dto: FindStationsDto, scope?: CompanyScope) {
        const where = this.buildWhere(dto, scope);
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async exportList(dto: FindStationsDto, scope?: CompanyScope) {
        const where = this.buildWhere(dto, scope);
        const stations = await this.repository.findMany(where, 0, EXCEL_EXPORT_MAX_ROWS);
        void this.audit.recordBusiness({
            action: 'stations_exported',
            resourceType: 'Station',
            metadata: { rows: stations.length, subCompanyId: dto.subCompanyId, status: dto.status, search: dto.search, format: dto.format ?? 'xlsx' },
        });

        return createExcelExport(
            'estaciones.xlsx',
            'Estaciones',
            [
                { header: 'ID', value: (station) => station.id },
                { header: 'Numero estacion', value: (station) => station.stationNumber },
                { header: 'Nombre', value: (station) => station.name },
                { header: 'Subcompania', value: (station) => `${station.subCompany.key} - ${station.subCompany.name}` },
                { header: 'Latitud', value: (station) => valueOrDash(station.lat) },
                { header: 'Longitud', value: (station) => valueOrDash(station.lon) },
                { header: 'Estado', value: (station) => formatStatus(station.status) },
            ],
            stations,
            dto.format
        );
    }

    async findOne(id: string, scope?: CompanyScope) {
        const station = await this.repository.findById(id, scope);
        if (!station) throw notFound();
        return station;
    }

    async update(id: string, dto: UpdateStationDto, scope?: CompanyScope) {
        const station = await this.repository.update(
            id,
            {
                stationNumber: dto.stationNumber,
                name: dto.name,
                lat: dto.lat,
                lon: dto.lon,
                status: dto.status,
            },
            toAddressData(dto.address),
            scope
        );
        if (!station) throw notFound();
        void this.audit.recordBusiness({ action: 'station_updated', resourceType: 'Station', resourceId: station.id, metadata: dto, after: station });
        return station;
    }

    async deactivate(id: string, scope?: CompanyScope) {
        const station = await this.repository.deactivate(id, scope);
        if (!station) throw notFound();
        void this.audit.recordBusiness({ action: 'station_deactivated', resourceType: 'Station', resourceId: station.id, after: { id: station.id, status: station.status } });
        return { id: station.id, status: station.status };
    }

    private buildWhere(dto: FindStationsDto, scope?: CompanyScope): Prisma.StationWhereInput {
        return {
            subCompanyId: scopedSubCompanyIdFilter(dto.subCompanyId, scope),
            subCompany: subCompanyScopeWhere(scope),
            status: dto.status,
            ...(dto.search ? { OR: this.stationSearch(dto.search) } : {}),
        };
    }

    private stationSearch(search: string): Prisma.StationWhereInput[] {
        const contains: Prisma.StringFilter = { contains: search, mode: 'insensitive' };

        return [{ stationNumber: contains }, { name: contains }, { subCompany: { key: contains } }, { subCompany: { name: contains } }];
    }
}
