import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';

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

    findById(id: string, scope?: CompanyScope) {
        return this.prisma.vehicle.findFirst({ where: { id, subCompany: subCompanyScopeWhere(scope) }, select: this.select() });
    }

    update(id: string, data: Prisma.VehicleUncheckedUpdateInput, scope?: CompanyScope) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.vehicle.updateMany({ where: { id, subCompany: subCompanyScopeWhere(scope) }, data });
            if (result.count === 0) return null;
            return tx.vehicle.findFirst({ where: { id, subCompany: subCompanyScopeWhere(scope) }, select: this.select() });
        });
    }

    deactivate(id: string, scope?: CompanyScope) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.vehicle.updateMany({ where: { id, subCompany: subCompanyScopeWhere(scope) }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.vehicle.findFirst({ where: { id, subCompany: subCompanyScopeWhere(scope) }, select: this.select() });
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
            subCompany: { select: this.subCompanySummarySelect() },
            fuel: { select: this.fuelSummarySelect() },
            driver: { select: this.driverSummarySelect() },
        };
    }

    private subCompanySummarySelect(): Prisma.SubCompanySelect {
        return {
            id: true,
            key: true,
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

    private driverSummarySelect(): Prisma.DriverSelect {
        return {
            id: true,
            name: true,
        };
    }
}
