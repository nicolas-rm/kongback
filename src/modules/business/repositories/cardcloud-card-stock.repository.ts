import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CardcloudCardStockRepository {
    constructor(private readonly prisma: PrismaService) {}

    create(data: Prisma.CardcloudCardStockUncheckedCreateInput) {
        return this.prisma.cardcloudCardStock.create({ data, select: this.select() });
    }

    findMany(where: Prisma.CardcloudCardStockWhereInput, skip: number, take?: number) {
        return this.prisma.cardcloudCardStock.findMany({ where, skip, take, orderBy: { externalId: 'asc' }, select: this.select() });
    }

    count(where: Prisma.CardcloudCardStockWhereInput): Promise<number> {
        return this.prisma.cardcloudCardStock.count({ where });
    }

    findById(id: string, companyId?: string) {
        return this.prisma.cardcloudCardStock.findFirst({ where: this.scopeWhere(id, companyId), select: this.select() });
    }

    update(id: string, data: Prisma.CardcloudCardStockUncheckedUpdateInput, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.cardcloudCardStock.updateMany({ where: this.scopeWhere(id, companyId), data });
            if (result.count === 0) return null;
            return tx.cardcloudCardStock.findFirst({ where: this.scopeWhere(id, companyId), select: this.select() });
        });
    }

    deactivate(id: string, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.cardcloudCardStock.updateMany({ where: this.scopeWhere(id, companyId), data: { providerStatus: Status.inactive } });
            if (result.count === 0) return null;
            return tx.cardcloudCardStock.findFirst({ where: this.scopeWhere(id, companyId), select: this.select() });
        });
    }

    private scopeWhere(id: string, companyId?: string): Prisma.CardcloudCardStockWhereInput {
        return {
            id,
            ...(companyId ? { companyId } : {}),
        };
    }

    private select(): Prisma.CardcloudCardStockSelect {
        return {
            id: true,
            companyId: true,
            externalId: true,
            assignedCardId: true,
            maskedPan: true,
            clientId: true,
            balance: true,
            providerStatus: true,
            syncedAt: true,
            assignedCard: { select: this.cardSummarySelect() },
        };
    }

    private cardSummarySelect(): Prisma.CardSelect {
        return {
            id: true,
            externalId: true,
            assignmentMode: true,
        };
    }
}
