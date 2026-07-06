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

    findById(id: string, organizationId: string, companyId?: string) {
        return this.prisma.vehicle.findFirst({ where: { id, subCompany: { company: this.companyScope(organizationId, companyId) } }, select: this.select() });
    }

    update(id: string, organizationId: string, data: Prisma.VehicleUncheckedUpdateInput, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.vehicle.updateMany({ where: { id, subCompany: { company: this.companyScope(organizationId, companyId) } }, data });
            if (result.count === 0) return null;
            return tx.vehicle.findFirst({ where: { id, subCompany: { company: this.companyScope(organizationId, companyId) } }, select: this.select() });
        });
    }

    deactivate(id: string, organizationId: string, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.vehicle.updateMany({ where: { id, subCompany: { company: this.companyScope(organizationId, companyId) } }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.vehicle.findFirst({ where: { id, subCompany: { company: this.companyScope(organizationId, companyId) } }, select: this.select() });
        });
    }

    private companyScope(organizationId: string, companyId?: string): Prisma.CompanyWhereInput {
        return {
            organizationId,
            ...(companyId ? { id: companyId } : {}),
        };
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
