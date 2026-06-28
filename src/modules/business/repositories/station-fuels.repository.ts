import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class StationFuelsRepository {
    constructor(private readonly prisma: PrismaService) {}

    create(data: Prisma.StationFuelUncheckedCreateInput) {
        return this.prisma.stationFuel.create({ data, select: this.select() });
    }

    findMany(where: Prisma.StationFuelWhereInput, skip: number, take?: number) {
        return this.prisma.stationFuel.findMany({ where, skip, take, orderBy: { stationId: 'asc' }, select: this.select() });
    }

    count(where: Prisma.StationFuelWhereInput): Promise<number> {
        return this.prisma.stationFuel.count({ where });
    }

    findById(id: string) {
        return this.prisma.stationFuel.findUnique({ where: { id }, select: this.select() });
    }

    update(id: string, data: Prisma.StationFuelUncheckedUpdateInput) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.stationFuel.updateMany({ where: { id }, data });
            if (result.count === 0) return null;
            return tx.stationFuel.findUnique({ where: { id }, select: this.select() });
        });
    }

    deactivate(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.stationFuel.updateMany({ where: { id }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.stationFuel.findUnique({ where: { id }, select: this.select() });
        });
    }

    private select(): Prisma.StationFuelSelect {
        return {
            id: true,
            stationId: true,
            fuelId: true,
            status: true,
        };
    }
}
