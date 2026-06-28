import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class FuelsRepository {
    constructor(private readonly prisma: PrismaService) {}

    create(data: Prisma.FuelUncheckedCreateInput) {
        return this.prisma.fuel.create({ data, select: this.select() });
    }

    findMany(where: Prisma.FuelWhereInput, skip: number, take?: number) {
        return this.prisma.fuel.findMany({ where, skip, take, orderBy: { name: 'asc' }, select: this.select() });
    }

    count(where: Prisma.FuelWhereInput): Promise<number> {
        return this.prisma.fuel.count({ where });
    }

    findById(id: string) {
        return this.prisma.fuel.findUnique({ where: { id }, select: this.select() });
    }

    update(id: string, data: Prisma.FuelUncheckedUpdateInput) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.fuel.updateMany({ where: { id }, data });
            if (result.count === 0) return null;
            return tx.fuel.findUnique({ where: { id }, select: this.select() });
        });
    }

    deactivate(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.fuel.updateMany({ where: { id }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.fuel.findUnique({ where: { id }, select: this.select() });
        });
    }

    private select(): Prisma.FuelSelect {
        return {
            id: true,
            code: true,
            name: true,
            status: true,
        };
    }
}
