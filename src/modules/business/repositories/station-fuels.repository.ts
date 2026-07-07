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

    findById(id: string, companyId?: string) {
        return this.prisma.stationFuel.findFirst({ where: { id, station: { subCompany: { company: this.companyScope(companyId) } } }, select: this.select() });
    }

    update(id: string, data: Prisma.StationFuelUncheckedUpdateInput, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.stationFuel.updateMany({ where: { id, station: { subCompany: { company: this.companyScope(companyId) } } }, data });
            if (result.count === 0) return null;
            return tx.stationFuel.findFirst({ where: { id, station: { subCompany: { company: this.companyScope(companyId) } } }, select: this.select() });
        });
    }

    deactivate(id: string, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.stationFuel.updateMany({ where: { id, station: { subCompany: { company: this.companyScope(companyId) } } }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.stationFuel.findFirst({ where: { id, station: { subCompany: { company: this.companyScope(companyId) } } }, select: this.select() });
        });
    }

    private companyScope(companyId?: string): Prisma.CompanyWhereInput {
        return {
            ...(companyId ? { id: companyId } : {}),
        };
    }

    private select(): Prisma.StationFuelSelect {
        return {
            id: true,
            stationId: true,
            fuelId: true,
            status: true,
            station: { select: this.stationSummarySelect() },
            fuel: { select: this.fuelSummarySelect() },
        };
    }

    private stationSummarySelect(): Prisma.StationSelect {
        return {
            id: true,
            stationNumber: true,
            name: true,
        };
    }

    private fuelSummarySelect(): Prisma.FuelSelect {
        return {
            id: true,
            code: true,
            name: true,
        };
    }
}
