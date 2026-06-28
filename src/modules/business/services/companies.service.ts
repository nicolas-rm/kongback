import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { notFound, textSearch, toAddressData } from '@/modules/business/business.helpers';
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
                phone: dto.phone ?? null,
            },
            toAddressData(dto.address)
        );
    }

    async findAll(dto: FindStatusRecordsDto) {
        const where: Prisma.CompanyWhereInput = {
            status: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.CompanyWhereInput>(dto.search, ['key', 'externalId', 'name', 'tradeName']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string) {
        const company = await this.repository.findById(id);
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
                phone: dto.phone,
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
