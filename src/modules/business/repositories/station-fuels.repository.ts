import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';

@Injectable()
export class StationFuelsRepository {
    constructor(private readonly prisma: PrismaService) {}

    createOrReactivate(data: Prisma.StationFuelUncheckedCreateInput) {
        const status = data.status ?? Status.active;
        return this.prisma.stationFuel.upsert({
            where: { stationId_fuelId: { stationId: data.stationId, fuelId: data.fuelId } },
            create: { ...data, status },
            update: { status },
            select: this.select(),
        });
    }

    findMany(where: Prisma.StationFuelWhereInput, skip: number, take?: number) {
        return this.prisma.stationFuel.findMany({ where, skip, take, orderBy: { stationId: 'asc' }, select: this.select() });
    }

    count(where: Prisma.StationFuelWhereInput): Promise<number> {
        return this.prisma.stationFuel.count({ where });
    }

    findById(id: string, scope?: CompanyScope) {
        return this.prisma.stationFuel.findFirst({ where: { id, station: { subCompany: subCompanyScopeWhere(scope) } }, select: this.select() });
    }

    update(id: string, data: Prisma.StationFuelUncheckedUpdateInput, scope?: CompanyScope) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.stationFuel.updateMany({ where: { id, station: { subCompany: subCompanyScopeWhere(scope) } }, data });
            if (result.count === 0) return null;
            return tx.stationFuel.findFirst({ where: { id, station: { subCompany: subCompanyScopeWhere(scope) } }, select: this.select() });
        });
    }

    deactivate(id: string, scope?: CompanyScope) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.stationFuel.updateMany({ where: { id, station: { subCompany: subCompanyScopeWhere(scope) } }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.stationFuel.findFirst({ where: { id, station: { subCompany: subCompanyScopeWhere(scope) } }, select: this.select() });
        });
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
