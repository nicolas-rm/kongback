import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { hasCompanyWideScope, subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { assertActive, invalidRelation, notFound, textSearch, toAddressData } from '@/modules/business/business.helpers';
import { CreateSubCompanyDto, FindSubCompaniesDto, UpdateSubCompanyDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { SubCompaniesRepository } from '@/modules/business/repositories/sub-companies.repository';

@Injectable()
export class SubCompaniesService {
    constructor(
        private readonly repository: SubCompaniesRepository,
        private readonly relations: BusinessRelationsRepository
    ) {}

    async create(dto: CreateSubCompanyDto, scope?: CompanyScope) {
        if (!hasCompanyWideScope(scope)) throw invalidRelation();
        await assertActive([{ ids: [dto.companyId], count: (ids) => this.relations.countActiveCompanies(ids, scope) }]);
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

    async findAll(dto: FindSubCompaniesDto, scope?: CompanyScope) {
        const where: Prisma.SubCompanyWhereInput = {
            AND: [{ ...(dto.companyId ? { companyId: dto.companyId } : {}) }, subCompanyScopeWhere(scope), { ...(dto.status ? { status: dto.status } : {}) }],
            ...(dto.search ? { OR: textSearch<Prisma.SubCompanyWhereInput>(dto.search, ['key', 'externalId', 'name']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string, scope?: CompanyScope) {
        const subCompany = await this.repository.findById(id, scope);
        if (!subCompany) throw notFound();
        return subCompany;
    }

    async update(id: string, dto: UpdateSubCompanyDto, scope?: CompanyScope) {
        const subCompany = await this.repository.update(
            id,
            {
                key: dto.key,
                externalId: dto.externalId,
                name: dto.name,
                status: dto.status,
                isDefault: dto.isDefault,
            },
            toAddressData(dto.address),
            scope
        );
        if (!subCompany) throw notFound();
        return subCompany;
    }

    async deactivate(id: string, scope?: CompanyScope) {
        const subCompany = await this.repository.deactivate(id, scope);
        if (!subCompany) throw notFound();
        return { id: subCompany.id, status: subCompany.status };
    }
}
