import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CardsRepository {
    constructor(private readonly prisma: PrismaService) {}

    create(data: Prisma.CardUncheckedCreateInput) {
        return this.prisma.card.create({ data, select: this.select() });
    }

    findMany(where: Prisma.CardWhereInput, skip: number, take?: number) {
        return this.prisma.card.findMany({ where, skip, take, orderBy: { assignedAt: 'desc' }, select: this.select() });
    }

    count(where: Prisma.CardWhereInput): Promise<number> {
        return this.prisma.card.count({ where });
    }

    findById(id: string) {
        return this.prisma.card.findUnique({ where: { id }, select: this.select() });
    }

    update(id: string, data: Prisma.CardUncheckedUpdateInput) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.card.updateMany({ where: { id }, data });
            if (result.count === 0) return null;
            return tx.card.findUnique({ where: { id }, select: this.select() });
        });
    }

    deactivate(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.card.updateMany({ where: { id }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.card.findUnique({ where: { id }, select: this.select() });
        });
    }

    private select(): Prisma.CardSelect {
        return {
            id: true,
            subCompanyId: true,
            vehicleId: true,
            driverId: true,
            fuelId: true,
            externalId: true,
            assignmentMode: true,
            status: true,
            assignedAt: true,
        };
    }
}
