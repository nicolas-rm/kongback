import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export const CARDHOLDER_USER_SELECT = {
    id: true,
    username: true,
    email: true,
    fullName: true,
    status: true,
    accesses: {
        select: {
            id: true,
            companyId: true,
            scopeKey: true,
            scopeId: true,
            role: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                    permissions: {
                        select: {
                            permission: {
                                select: {
                                    code: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    driver: {
        select: {
            id: true,
            subCompanyId: true,
            userId: true,
            name: true,
            externalReference: true,
            status: true,
            subCompany: {
                select: {
                    id: true,
                    companyId: true,
                    key: true,
                    cardcloudSubaccountId: true,
                    name: true,
                    status: true,
                },
            },
            vehicles: {
                select: {
                    id: true,
                    subCompanyId: true,
                    plates: true,
                    economicNumber: true,
                    status: true,
                    card: {
                        select: {
                            id: true,
                            externalId: true,
                            status: true,
                            stock: {
                                select: {
                                    id: true,
                                    maskedPan: true,
                                    clientId: true,
                                    providerStatus: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    },
} satisfies Prisma.UserSelect;

export type CardholderUserRecord = Prisma.UserGetPayload<{ select: typeof CARDHOLDER_USER_SELECT }>;

@Injectable()
export class CardholdersRepository {
    constructor(private readonly prisma: PrismaService) {}

    findMany(where: Prisma.UserWhereInput, skip: number, take?: number): Promise<CardholderUserRecord[]> {
        return this.prisma.user.findMany({
            where,
            skip,
            take,
            orderBy: { fullName: 'asc' },
            select: CARDHOLDER_USER_SELECT,
        });
    }

    count(where: Prisma.UserWhereInput): Promise<number> {
        return this.prisma.user.count({ where });
    }
}
