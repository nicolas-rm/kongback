import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { notFound, textSearch, toAddressData } from '@/modules/business/business.helpers';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { CreateCompanyDto, FindStatusRecordsDto, UpdateCompanyDto } from '@/modules/business/dto';
import { CompaniesRepository } from '@/modules/business/repositories/companies.repository';

@Injectable()
export class CompaniesService {
    constructor(private readonly repository: CompaniesRepository) {}

    async create(dto: CreateCompanyDto) {
        return this.repository.create(
            {
                key: dto.key,
                externalId: dto.externalId ?? null,
                name: dto.name,
                tradeName: dto.tradeName ?? null,
                status: dto.status ?? Status.active,
            },
            toAddressData(dto.address)
        );
    }

    async findAll(dto: FindStatusRecordsDto, user: RequestUser) {
        const companyIds = user.isGlobalAdmin ? undefined : await this.repository.findAccessibleCompanyIds(user.id);
        const where: Prisma.CompanyWhereInput = {
            ...(companyIds ? { id: { in: companyIds } } : {}),
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.CompanyWhereInput>(dto.search, ['key', 'externalId', 'name', 'tradeName']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string, user: RequestUser) {
        const company = user.isGlobalAdmin ? await this.repository.findById(id) : await this.repository.findAccessibleById(id, user.id);
        if (!company) throw notFound();
        return company;
    }

    async update(id: string, dto: UpdateCompanyDto) {
        const company = await this.repository.update(
            id,
            {
                key: dto.key,
                externalId: dto.externalId,
                name: dto.name,
                tradeName: dto.tradeName,
                status: dto.status,
            },
            toAddressData(dto.address)
        );
        if (!company) throw notFound();
        return company;
    }

    async deactivate(id: string) {
        const company = await this.repository.deactivate(id);
        if (!company) throw notFound();
        return { id: company.id, status: company.status };
    }
}
