import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { assertActive, notFound, textSearch, toAddressData } from '@/modules/business/business.helpers';
import { CreateSubCompanyDto, FindSubCompaniesDto, UpdateSubCompanyDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { SubCompaniesRepository } from '@/modules/business/repositories/sub-companies.repository';

@Injectable()
export class SubCompaniesService {
    constructor(
        private readonly repository: SubCompaniesRepository,
        private readonly relations: BusinessRelationsRepository
    ) {}

    async create(organizationId: string, dto: CreateSubCompanyDto, companyId?: string) {
        await assertActive([{ ids: [dto.companyId], count: (ids) => this.relations.countActiveCompanies(ids, organizationId, companyId) }]);
        return this.repository.create(
            {
                companyId: dto.companyId,
                key: dto.key,
                externalId: dto.externalId ?? null,
                name: dto.name,
                status: dto.status ?? Status.active,
                isDefault: dto.isDefault ?? false,
            },
            toAddressData(dto.address)
        );
    }

    async findAll(organizationId: string, dto: FindSubCompaniesDto, companyId?: string) {
        const where: Prisma.SubCompanyWhereInput = {
            companyId: dto.companyId,
            company: { organizationId, ...(companyId ? { id: companyId } : {}) },
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.SubCompanyWhereInput>(dto.search, ['key', 'externalId', 'name']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(organizationId: string, id: string, companyId?: string) {
        const subCompany = await this.repository.findById(id, organizationId, companyId);
        if (!subCompany) throw notFound();
        return subCompany;
    }

    async update(organizationId: string, id: string, dto: UpdateSubCompanyDto, companyId?: string) {
        const subCompany = await this.repository.update(
            id,
            organizationId,
            {
                key: dto.key,
                externalId: dto.externalId,
                name: dto.name,
                status: dto.status,
                isDefault: dto.isDefault,
            },
            toAddressData(dto.address),
            companyId
        );
        if (!subCompany) throw notFound();
        return subCompany;
    }

    async deactivate(organizationId: string, id: string, companyId?: string) {
        const subCompany = await this.repository.deactivate(id, organizationId, companyId);
        if (!subCompany) throw notFound();
        return { id: subCompany.id, status: subCompany.status };
    }
}
