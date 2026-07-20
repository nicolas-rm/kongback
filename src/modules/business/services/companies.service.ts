import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { ERROR_CODES } from '@/errors/error-codes';
import { I18N_KEYS, I18nHttpException } from '@/i18n';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { notFound, textSearch, toAddressData } from '@/modules/business/business.helpers';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { CreateCompanyDto, FindStatusRecordsDto, UpdateCompanyDto } from '@/modules/business/dto';
import { CompaniesRepository } from '@/modules/business/repositories/companies.repository';
import { CardcloudService } from '@/modules/cardcloud/cardcloud.service';

@Injectable()
export class CompaniesService {
    private readonly logger = new Logger(CompaniesService.name);

    constructor(
        private readonly repository: CompaniesRepository,
        private readonly cardcloud: CardcloudService
    ) {}

    async create(dto: CreateCompanyDto) {
        await this.assertCreateReferencesAvailable(dto);

        const cardcloudSubaccountId = await this.cardcloud.createSubaccountAndResolveId({
            ExternalId: dto.key,
            Description: dto.tradeName ?? dto.name,
        });

        try {
            return await this.repository.createWithDefaultSubCompany(
                {
                    key: dto.key,
                    externalId: dto.externalId ?? null,
                    name: dto.name,
                    tradeName: dto.tradeName ?? null,
                    status: dto.status ?? Status.active,
                },
                {
                    key: dto.key,
                    cardcloudSubaccountId,
                    name: dto.tradeName ?? dto.name,
                    status: dto.status ?? Status.active,
                    isDefault: true,
                },
                toAddressData(dto.address)
            );
        } catch (error) {
            this.logger.error(
                `No se pudo crear Company local despues de crear subcuenta Cardcloud ${cardcloudSubaccountId}`,
                error instanceof Error ? error.stack : undefined
            );
            throw error;
        }
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

    private async assertCreateReferencesAvailable(dto: CreateCompanyDto): Promise<void> {
        const conflicts = await this.repository.countCreateConflicts(dto.key, dto.externalId);
        if (conflicts === 0) return;

        throw new I18nHttpException(HttpStatus.CONFLICT, I18N_KEYS.prisma.uniqueConstraint, 'El valor de (key, externalId) ya existe', {
            code: ERROR_CODES.UNIQUE_CONSTRAINT,
            args: { fields: 'key, externalId' },
        });
    }
}
