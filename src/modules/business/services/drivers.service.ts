import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { assertActive, notFound, textSearch, toAddressData } from '@/modules/business/business.helpers';
import { CreateDriverDto, FindDriversDto, UpdateDriverDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { DriversRepository } from '@/modules/business/repositories/drivers.repository';

@Injectable()
export class DriversService {
    constructor(
        private readonly repository: DriversRepository,
        private readonly relations: BusinessRelationsRepository
    ) {}

    async create(organizationId: string, dto: CreateDriverDto, companyId?: string) {
        await assertActive([
            { ids: [dto.subCompanyId], count: (ids) => this.relations.countActiveSubCompanies(ids, organizationId, companyId) },
            { ids: [dto.userId], count: (ids) => this.relations.countActiveUsers(ids) },
        ]);
        return this.repository.create(
            {
                subCompanyId: dto.subCompanyId,
                userId: dto.userId ?? null,
                name: dto.name,
                externalReference: dto.externalReference ?? null,
                status: dto.status ?? Status.active,
            },
            toAddressData(dto.address)
        );
    }

    async findAll(organizationId: string, dto: FindDriversDto, companyId?: string) {
        const where: Prisma.DriverWhereInput = {
            subCompanyId: dto.subCompanyId,
            subCompany: { company: { organizationId, ...(companyId ? { id: companyId } : {}) } },
            userId: dto.userId,
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.DriverWhereInput>(dto.search, ['name', 'externalReference']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(organizationId: string, id: string, companyId?: string) {
        const driver = await this.repository.findById(id, organizationId, companyId);
        if (!driver) throw notFound();
        return driver;
    }

    async update(organizationId: string, id: string, dto: UpdateDriverDto, companyId?: string) {
        await assertActive([{ ids: [dto.userId], count: (ids) => this.relations.countActiveUsers(ids) }]);
        const driver = await this.repository.update(
            id,
            organizationId,
            {
                userId: dto.userId,
                name: dto.name,
                externalReference: dto.externalReference,
                status: dto.status,
            },
            toAddressData(dto.address),
            companyId
        );
        if (!driver) throw notFound();
        return driver;
    }

    async deactivate(organizationId: string, id: string, companyId?: string) {
        const driver = await this.repository.deactivate(id, organizationId, companyId);
        if (!driver) throw notFound();
        return { id: driver.id, status: driver.status };
    }
}
