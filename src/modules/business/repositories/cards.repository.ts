import { Injectable } from '@nestjs/common';
import { CardAssignmentMode, Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { subCompanyScopeWhere, type CompanyScope } from '@/utilities/tenancy/company-scope';

@Injectable()
export class CardsRepository {
    constructor(private readonly prisma: PrismaService) {}

    create(data: Prisma.CardUncheckedCreateInput) {
        return this.prisma.card.create({ data, select: this.select() });
    }

    syncExternalCardsToSubCompany(subCompanyId: string, externalIds: string[]) {
        const uniqueExternalIds = [...new Set(externalIds.map((externalId) => externalId.trim()).filter(Boolean))];

        return this.prisma.$transaction(async (tx) => {
            const cards: Array<Awaited<ReturnType<CardsRepository['create']>>> = [];
            let created = 0;
            let updated = 0;
            let unchanged = 0;

            for (const externalId of uniqueExternalIds) {
                const existing = await tx.card.findUnique({
                    where: { externalId },
                    select: { id: true, subCompanyId: true },
                });

                let cardId: string;
                if (existing) {
                    cardId = existing.id;
                    if (existing.subCompanyId === subCompanyId) {
                        unchanged++;
                    } else {
                        await tx.card.update({
                            where: { id: existing.id },
                            data: {
                                subCompanyId,
                                vehicleId: null,
                                assignmentMode: CardAssignmentMode.unassigned,
                                assignedAt: null,
                            },
                            select: { id: true },
                        });
                        updated++;
                    }
                } else {
                    const card = await tx.card.create({
                        data: {
                            subCompanyId,
                            externalId,
                            assignmentMode: CardAssignmentMode.unassigned,
                            status: Status.active,
                            assignedAt: null,
                        },
                        select: { id: true },
                    });
                    cardId = card.id;
                    created++;
                }

                await tx.cardcloud.updateMany({
                    where: { assignedCardId: cardId, externalId: { not: externalId } },
                    data: { assignedCardId: null },
                });
                await tx.cardcloud.updateMany({
                    where: { externalId },
                    data: { subCompanyId, assignedCardId: cardId },
                });

                const card = await tx.card.findFirst({ where: { id: cardId }, select: this.select() });
                if (card) cards.push(card);
            }

            return {
                requested: externalIds.length,
                unique: uniqueExternalIds.length,
                created,
                updated,
                unchanged,
                cards,
            };
        });
    }

    findAssignableStockForSubCompanyAssignment(scope?: CompanyScope) {
        return this.prisma.cardcloud.findMany({
            where: this.assignableStockWhere(scope),
            orderBy: [{ clientId: 'asc' }, { externalId: 'asc' }],
            select: this.assignableStockSelect(),
        });
    }

    findAssignableStockByClientIdsForSubCompanyAssignment(clientIds: string[], scope?: CompanyScope) {
        const uniqueClientIds = [...new Set(clientIds.map((clientId) => clientId.trim()).filter(Boolean))];
        if (uniqueClientIds.length === 0) return Promise.resolve([]);

        return this.prisma.cardcloud.findMany({
            where: {
                AND: [this.assignableStockWhere(scope), { clientId: { in: uniqueClientIds } }],
            },
            select: this.assignableStockSelect(),
        });
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

    findAssignedStockByClientId(clientId: string, scope?: CompanyScope) {
        return this.prisma.cardcloud.findMany({
            where: {
                clientId,
                assignedCardId: { not: null },
                assignedCard: {
                    is: {
                        subCompany: subCompanyScopeWhere(scope),
                    },
                },
            },
            take: 2,
            select: {
                externalId: true,
                clientId: true,
                maskedPan: true,
                assignedCard: {
                    select: {
                        id: true,
                        subCompanyId: true,
                        vehicleId: true,
                        assignmentMode: true,
                        status: true,
                    },
                },
            },
        });
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
            stock: { select: this.stockSummarySelect() },
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

    private stockSummarySelect(): Prisma.CardcloudSelect {
        return {
            id: true,
            externalId: true,
            subCompanyId: true,
            assignedCardId: true,
            maskedPan: true,
            clientId: true,
            balance: true,
            providerStatus: true,
        };
    }

    private assignableStockWhere(_scope?: CompanyScope): Prisma.CardcloudWhereInput {
        return {
            AND: [{ subCompanyId: null }, { assignedCardId: null }, { clientId: { not: null } }, { clientId: { not: '' } }],
        };
    }

    private assignableStockSelect(): Prisma.CardcloudSelect {
        return {
            id: true,
            externalId: true,
            subCompanyId: true,
            maskedPan: true,
            clientId: true,
            providerStatus: true,
            subCompany: { select: this.subCompanySummarySelect() },
        };
    }
}
