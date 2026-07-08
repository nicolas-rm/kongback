import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';

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

    findById(id: string, scope?: CompanyScope) {
        return this.prisma.card.findFirst({ where: { id, subCompany: subCompanyScopeWhere(scope) }, select: this.select() });
    }

    update(id: string, data: Prisma.CardUncheckedUpdateInput, scope?: CompanyScope) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.card.updateMany({ where: { id, subCompany: subCompanyScopeWhere(scope) }, data });
            if (result.count === 0) return null;
            return tx.card.findFirst({ where: { id, subCompany: subCompanyScopeWhere(scope) }, select: this.select() });
        });
    }

    deactivate(id: string, scope?: CompanyScope) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.card.updateMany({ where: { id, subCompany: subCompanyScopeWhere(scope) }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.card.findFirst({ where: { id, subCompany: subCompanyScopeWhere(scope) }, select: this.select() });
        });
    }

    private select(): Prisma.CardSelect {
        return {
            id: true,
            subCompanyId: true,
            vehicleId: true,
            designFuelId: true,
            externalId: true,
            assignmentMode: true,
            status: true,
            assignedAt: true,
            subCompany: { select: this.subCompanySummarySelect() },
            vehicle: { select: this.vehicleSummarySelect() },
            designFuel: { select: this.fuelSummarySelect() },
        };
    }

    private subCompanySummarySelect(): Prisma.SubCompanySelect {
        return {
            id: true,
            key: true,
            name: true,
        };
    }

    private vehicleSummarySelect(): Prisma.VehicleSelect {
        return {
            id: true,
            plates: true,
            economicNumber: true,
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
