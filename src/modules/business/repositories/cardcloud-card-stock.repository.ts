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

    findById(id: string) {
        return this.prisma.cardcloudCardStock.findUnique({ where: { id }, select: this.select() });
    }

    update(id: string, data: Prisma.CardcloudCardStockUncheckedUpdateInput) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.cardcloudCardStock.updateMany({ where: { id }, data });
            if (result.count === 0) return null;
            return tx.cardcloudCardStock.findUnique({ where: { id }, select: this.select() });
        });
    }

    deactivate(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.cardcloudCardStock.updateMany({ where: { id }, data: { providerStatus: Status.inactive } });
            if (result.count === 0) return null;
            return tx.cardcloudCardStock.findUnique({ where: { id }, select: this.select() });
        });
    }

    private select(): Prisma.CardcloudCardStockSelect {
        return {
            id: true,
            externalId: true,
            assignedCardId: true,
            maskedPan: true,
            clientId: true,
            balance: true,
            providerStatus: true,
            syncedAt: true,
        };
    }
}
