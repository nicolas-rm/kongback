import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class VehiclesRepository {
    constructor(private readonly prisma: PrismaService) {}

    create(data: Prisma.VehicleUncheckedCreateInput) {
        return this.prisma.vehicle.create({ data, select: this.select() });
    }

    findMany(where: Prisma.VehicleWhereInput, skip: number, take?: number) {
        return this.prisma.vehicle.findMany({ where, skip, take, orderBy: { plates: 'asc' }, select: this.select() });
    }

    count(where: Prisma.VehicleWhereInput): Promise<number> {
        return this.prisma.vehicle.count({ where });
    }

    findById(id: string) {
        return this.prisma.vehicle.findUnique({ where: { id }, select: this.select() });
    }

    update(id: string, data: Prisma.VehicleUncheckedUpdateInput) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.vehicle.updateMany({ where: { id }, data });
            if (result.count === 0) return null;
            return tx.vehicle.findUnique({ where: { id }, select: this.select() });
        });
    }

    deactivate(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.vehicle.updateMany({ where: { id }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.vehicle.findUnique({ where: { id }, select: this.select() });
        });
    }

    private select(): Prisma.VehicleSelect {
        return {
            id: true,
            subCompanyId: true,
            fuelId: true,
            driverId: true,
            plates: true,
            economicNumber: true,
            model: true,
            year: true,
            odometerControl: true,
            odometerInitial: true,
            status: true,
        };
    }
}
