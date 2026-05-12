import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { activeRecordWhere } from '@/utilities/prisma/soft-delete';

@Injectable()
export class UsersRepository {
    constructor(protected readonly prisma: PrismaService) {}

    create(data: Prisma.UserUncheckedCreateInput) {
        return this.prisma.user.create({
            data,
            select: this.defaultSelect(),
        });
    }

    findMany(where: Prisma.UserWhereInput, skip: number, take?: number) {
        return this.prisma.user.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: this.defaultSelect(),
        });
    }

    count(where: Prisma.UserWhereInput): Promise<number> {
        return this.prisma.user.count({ where });
    }

    findById(id: string) {
        return this.prisma.user.findFirst({
            where: activeRecordWhere({ id }),
            select: this.defaultSelect(),
        });
    }

    update(id: string, data: Prisma.UserUncheckedUpdateInput) {
        return this.prisma.user.update({
            where: { id },
            data,
            select: this.defaultSelect(),
        });
    }

    updatePassword(id: string, passwordHash: string, mustChangePassword: boolean) {
        return this.prisma.user.update({
            where: { id },
            data: { passwordHash, mustChangePassword },
            select: { id: true },
        });
    }

    resetTwoFactor(id: string) {
        return this.prisma.$transaction(async (tx) => {
            await tx.twoFactorRecoveryCode.deleteMany({ where: { userId: id } });
            await tx.user.update({
                where: { id },
                data: {
                    twoFactorEnabled: false,
                    twoFactorSecret: null,
                    twoFactorPendingSecret: null,
                    twoFactorPendingCreatedAt: null,
                    twoFactorConfirmedAt: null,
                },
                select: { id: true },
            });
        });
    }

    softDelete(id: string) {
        return this.prisma.user.update({
            where: { id },
            data: { deletedAt: new Date(), status: 'inactive' },
            select: { id: true },
        });
    }

    assignAccess(data: Prisma.UserAccessUncheckedCreateInput) {
        return this.prisma.userAccess.create({
            data,
            select: { id: true, userId: true, roleId: true, organizationId: true, scopeKey: true, scopeId: true, assignedAt: true },
        });
    }

    replaceAccess(userId: string, data: Prisma.UserAccessUncheckedCreateInput[]) {
        return this.prisma.$transaction(async (tx) => {
            await tx.userAccess.updateMany({
                where: { userId, deletedAt: null },
                data: { deletedAt: new Date() },
            });

            if (data.length > 0) {
                await tx.userAccess.createMany({ data });
            }

            return tx.userAccess.findMany({
                where: { userId, deletedAt: null },
                orderBy: { assignedAt: 'desc' },
                select: this.accessSelect(),
            });
        });
    }

    listAccess(userId: string) {
        return this.prisma.userAccess.findMany({
            where: { userId, deletedAt: null },
            orderBy: { assignedAt: 'desc' },
            select: this.accessSelect(),
        });
    }

    findPermissionCodes(userId: string) {
        return this.prisma.rolePermission.findMany({
            where: {
                permission: { deletedAt: null },
                role: {
                    deletedAt: null,
                    accesses: {
                        some: {
                            userId,
                            deletedAt: null,
                        },
                    },
                },
            },
            distinct: ['permissionId'],
            orderBy: { permission: { code: 'asc' } },
            select: {
                permission: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        description: true,
                    },
                },
            },
        });
    }

    findCredentialRecipient(id: string) {
        return this.prisma.user.findFirst({
            where: activeRecordWhere({ id }),
            select: { id: true, username: true, email: true },
        });
    }

    removeAccess(userId: string, id: string) {
        return this.prisma.userAccess.update({
            where: { id, userId },
            data: { deletedAt: new Date() },
            select: { id: true },
        });
    }

    private defaultSelect(): Prisma.UserSelect {
        return {
            id: true,
            username: true,
            email: true,
            fullName: true,
            status: true,
            mustChangePassword: true,
            emailVerifiedAt: true,
            twoFactorEnabled: true,
            createdAt: true,
            updatedAt: true,
        };
    }

    private accessSelect(): Prisma.UserAccessSelect {
        return {
            id: true,
            organizationId: true,
            scopeKey: true,
            scopeId: true,
            assignedAt: true,
            role: { select: { id: true, code: true, name: true } },
        };
    }
}
