import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { assertActive, notFound, textSearch } from '@/modules/business/business.helpers';
import { CreateCardcloudCardStockDto, FindCardcloudCardStockDto, UpdateCardcloudCardStockDto } from '@/modules/business/dto';
import { BusinessRelationsRepository } from '@/modules/business/repositories/business-relations.repository';
import { CardcloudCardStockRepository } from '@/modules/business/repositories/cardcloud-card-stock.repository';

@Injectable()
export class CardcloudCardStockService {
    constructor(
        private readonly repository: CardcloudCardStockRepository,
        private readonly relations: BusinessRelationsRepository
    ) {}

    async create(dto: CreateCardcloudCardStockDto) {
        await assertActive([{ ids: [dto.assignedCardId], count: (ids) => this.relations.countActiveCards(ids) }]);

        return this.repository.create({
            externalId: dto.externalId,
            assignedCardId: dto.assignedCardId ?? null,
            maskedPan: dto.maskedPan ?? null,
            brand: dto.brand ?? null,
            clientId: dto.clientId ?? null,
            clabe: dto.clabe ?? null,
            balance: dto.balance ?? null,
            providerStatus: dto.providerStatus ?? Status.active,
            syncedAt: dto.syncedAt ?? null,
        });
    }

    async findAll(dto: FindCardcloudCardStockDto) {
        const where: Prisma.CardcloudCardStockWhereInput = {
            assignedCardId: dto.assignedCardId,
            providerStatus: dto.status,
            ...(dto.search ? { OR: textSearch<Prisma.CardcloudCardStockWhereInput>(dto.search, ['externalId', 'maskedPan', 'brand', 'clientId', 'clabe']) } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    async findOne(id: string) {
        const stock = await this.repository.findById(id);
        if (!stock) throw notFound();
        return stock;
    }

    async update(id: string, dto: UpdateCardcloudCardStockDto) {
        await assertActive([{ ids: [dto.assignedCardId], count: (ids) => this.relations.countActiveCards(ids) }]);

        const stock = await this.repository.update(id, {
            assignedCardId: dto.assignedCardId,
            maskedPan: dto.maskedPan,
            brand: dto.brand,
            clientId: dto.clientId,
            clabe: dto.clabe,
            balance: dto.balance,
            providerStatus: dto.providerStatus,
            syncedAt: dto.syncedAt,
        });
        if (!stock) throw notFound();
        return stock;
    }

    async deactivate(id: string) {
        const stock = await this.repository.deactivate(id);
        if (!stock) throw notFound();
        return { id: stock.id, status: stock.providerStatus };
    }
}
