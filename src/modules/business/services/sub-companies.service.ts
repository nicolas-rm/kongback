import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { ERROR_CODES } from '@/errors/error-codes';
import { I18N_KEYS, I18nHttpException } from '@/i18n';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { hasCompanyWideScope, subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { invalidRelation, notFound, textSearch, toAddressData } from '@/modules/business/business.helpers';
import { CreateSubCompanyDto, FindSubCompaniesDto, UpdateSubCompanyDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { SubCompaniesRepository } from '@/modules/business/repositories/sub-companies.repository';
import { CardcloudService } from '@/modules/cardcloud/cardcloud.service';

@Injectable()
export class SubCompaniesService {
    private readonly logger = new Logger(SubCompaniesService.name);

    constructor(
        private readonly repository: SubCompaniesRepository,
        private readonly relations: BusinessRelationsRepository,
        private readonly cardcloud: CardcloudService
    ) {}

    async create(dto: CreateSubCompanyDto, scope?: CompanyScope) {
        if (!hasCompanyWideScope(scope)) throw invalidRelation();
        const company = await this.relations.findActiveCompany(dto.companyId, scope);
        if (!company) throw invalidRelation();

        if (await this.repository.existsByCompanyKey(dto.companyId, dto.key, scope)) {
            throw new I18nHttpException(HttpStatus.CONFLICT, I18N_KEYS.prisma.uniqueConstraint, 'El valor de (companyId, key) ya existe', {
                code: ERROR_CODES.UNIQUE_CONSTRAINT,
                args: { fields: 'companyId, key' },
            });
        }

        const cardcloudSubaccountId = await this.createCardcloudSubaccount(company.key, dto.key, dto.name);

        try {
            return await this.repository.create(
                {
                    companyId: dto.companyId,
                    key: dto.key,
                    cardcloudSubaccountId,
                    name: dto.name,
                    status: dto.status ?? Status.active,
                    isDefault: dto.isDefault ?? false,
                },
                toAddressData(dto.address)
            );
        } catch (error) {
            this.logger.error(
                `No se pudo crear SubCompany local despues de crear subcuenta Cardcloud ${cardcloudSubaccountId}`,
                error instanceof Error ? error.stack : undefined
            );
            throw error;
        }
    }

    private async createCardcloudSubaccount(companyKey: string, subCompanyKey: string, name: string): Promise<string> {
        const response = await this.cardcloud.createSubaccount({
            ExternalId: this.buildCardcloudExternalId(companyKey, subCompanyKey),
            Description: name,
        });
        const subaccountId = this.resolveCardcloudSubaccountId(response);
        if (!subaccountId) {
            throw new I18nHttpException(HttpStatus.BAD_GATEWAY, I18N_KEYS.errors.internal.unprocessed, 'Cardcloud no devolvio un identificador de subcuenta valido');
        }

        return subaccountId;
    }

    private buildCardcloudExternalId(companyKey: string, subCompanyKey: string): string {
        return `${companyKey}__${subCompanyKey}`;
    }

    private resolveCardcloudSubaccountId(response: unknown): string | null {
        const direct = this.extractStringField(response, ['subaccount_id', 'uuid', 'id']);
        if (direct) return direct;

        if (!this.isRecord(response)) return null;

        return this.resolveCardcloudSubaccountId(response.data) ?? this.resolveCardcloudSubaccountId(response.subaccount);
    }

    private extractStringField(value: unknown, fields: string[]): string | null {
        if (!this.isRecord(value)) return null;

        for (const field of fields) {
            const fieldValue = value[field];
            if (typeof fieldValue === 'string' && fieldValue.trim()) return fieldValue.trim();
        }

        return null;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    async findAll(dto: FindSubCompaniesDto, scope?: CompanyScope) {
        const where: Prisma.SubCompanyWhereInput = {
            AND: [{ ...(dto.companyId ? { companyId: dto.companyId } : {}) }, subCompanyScopeWhere(scope), { ...(dto.status ? { status: dto.status } : {}) }],
            ...(dto.search ? { OR: textSearch<Prisma.SubCompanyWhereInput>(dto.search, ['key', 'cardcloudSubaccountId', 'name']) } : {}),
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
                cardcloudSubaccountId: dto.cardcloudSubaccountId,
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
