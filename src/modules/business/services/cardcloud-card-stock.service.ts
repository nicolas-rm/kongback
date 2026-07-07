import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { assertActive, invalidRelation, notFound, textSearch } from '@/modules/business/business.helpers';
import { CreateCardcloudCardStockDto, FindCardcloudCardStockDto, UpdateCardcloudCardStockDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { CardcloudCardStockRepository } from '@/modules/business/repositories/cardcloud-card-stock.repository';

@Injectable()
export class CardcloudCardStockService {
    constructor(
        private readonly repository: CardcloudCardStockRepository,
        private readonly relations: BusinessRelationsRepository
    ) {}

    async create(organizationId: string, dto: CreateCardcloudCardStockDto, companyId?: string) {
        if (companyId && !dto.assignedCardId) throw invalidRelation();
        await assertActive([{ ids: [dto.assignedCardId], count: (ids) => this.relations.countActiveCards(ids, organizationId, companyId) }]);

        return this.repository.create({
            organizationId,
            externalId: dto.externalId,
            assignedCardId: dto.assignedCardId ?? null,
            maskedPan: dto.maskedPan ?? null,
            clientId: dto.clientId ?? null,
            balance: dto.balance ?? null,
            providerStatus: dto.providerStatus ?? Status.active,
            syncedAt: dto.syncedAt ?? null,
        });
    }

    async findAll(organizationId: string, dto: FindCardcloudCardStockDto, companyId?: string) {
        const where: Prisma.CardcloudCardStockWhereInput = {
            organizationId,
            ...(companyId ? { assignedCard: { subCompany: { companyId } } } : {}),
            assignedCardId: dto.assignedCardId,
            providerStatus: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.CardcloudCardStockWhereInput>(dto.search, ['externalId', 'maskedPan', 'clientId']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(organizationId: string, id: string, companyId?: string) {
        const stock = await this.repository.findById(id, organizationId, companyId);
        if (!stock) throw notFound();
        return stock;
    }

    async update(organizationId: string, id: string, dto: UpdateCardcloudCardStockDto, companyId?: string) {
        if (companyId && dto.assignedCardId === null) throw invalidRelation();
        await assertActive([{ ids: [dto.assignedCardId], count: (ids) => this.relations.countActiveCards(ids, organizationId, companyId) }]);

        const stock = await this.repository.update(
            id,
            organizationId,
            {
                assignedCardId: dto.assignedCardId,
                maskedPan: dto.maskedPan,
                clientId: dto.clientId,
                balance: dto.balance,
                providerStatus: dto.providerStatus,
                syncedAt: dto.syncedAt,
            },
            companyId
        );
        if (!stock) throw notFound();
        return stock;
    }

    async deactivate(organizationId: string, id: string, companyId?: string) {
        const stock = await this.repository.deactivate(id, organizationId, companyId);
        if (!stock) throw notFound();
        return { id: stock.id, status: stock.providerStatus };
    }
}
