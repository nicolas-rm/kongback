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

    findById(id: string, organizationId: string, companyId?: string) {
        return this.prisma.card.findFirst({ where: { id, subCompany: { company: this.companyScope(organizationId, companyId) } }, select: this.select() });
    }

    update(id: string, organizationId: string, data: Prisma.CardUncheckedUpdateInput, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.card.updateMany({ where: { id, subCompany: { company: this.companyScope(organizationId, companyId) } }, data });
            if (result.count === 0) return null;
            return tx.card.findFirst({ where: { id, subCompany: { company: this.companyScope(organizationId, companyId) } }, select: this.select() });
        });
    }

    deactivate(id: string, organizationId: string, companyId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.card.updateMany({ where: { id, subCompany: { company: this.companyScope(organizationId, companyId) } }, data: { status: Status.inactive } });
            if (result.count === 0) return null;
            return tx.card.findFirst({ where: { id, subCompany: { company: this.companyScope(organizationId, companyId) } }, select: this.select() });
        });
    }

    private companyScope(organizationId: string, companyId?: string): Prisma.CompanyWhereInput {
        return {
            organizationId,
            ...(companyId ? { id: companyId } : {}),
        };
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
