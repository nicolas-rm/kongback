import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { buildActiveUserAccessWhere } from '@/utilities/authentication/active-user-access-filter';

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
            where: { id },
            select: this.defaultSelect(),
        });
    }

    update(id: string, data: Prisma.UserUncheckedUpdateManyInput) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.user.updateMany({
                where: { id },
                data,
            });
            if (result.count === 0) return null;

            return tx.user.findFirst({
                where: { id },
                select: this.defaultSelect(),
            });
        });
    }

    updatePassword(id: string, passwordHash: string, mustChangePassword: boolean) {
        return this.prisma.user.updateMany({
            where: { id },
            data: { passwordHash, mustChangePassword },
        });
    }

    resetTwoFactor(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.user.updateMany({
                where: { id },
                data: {
                    twoFactorEnabled: false,
                    twoFactorSecret: null,
                    twoFactorPendingSecret: null,
                    twoFactorPendingCreatedAt: null,
                    twoFactorConfirmedAt: null,
                },
            });
            if (result.count === 0) return null;

            await tx.twoFactorRecoveryCode.deleteMany({ where: { userId: id } });
            return { id };
        });
    }

    delete(id: string) {
        return this.prisma.user.deleteMany({ where: { id } });
    }

    assignAccess(data: Prisma.UserAccessUncheckedCreateInput) {
        return this.prisma.userAccess.create({
            data,
            select: { id: true, userId: true, roleId: true, organizationId: true, scopeKey: true, scopeId: true },
        });
    }

    countActiveRoles(ids: string[]): Promise<number> {
        return this.prisma.role.count({ where: { id: { in: ids } } });
    }

    countActiveOrganizations(ids: string[]): Promise<number> {
        return this.prisma.organization.count({ where: { id: { in: ids }, status: 'active' } });
    }

    replaceAccess(userId: string, data: Prisma.UserAccessUncheckedCreateInput[]) {
        return this.prisma.$transaction(async (tx) => {
            await tx.userAccess.deleteMany({ where: { userId } });

            if (data.length > 0) {
                await tx.userAccess.createMany({ data });
            }

            return tx.userAccess.findMany({
                where: buildActiveUserAccessWhere({ userId }),
                orderBy: { assignedAt: 'desc' },
                select: this.accessSelect(),
            });
        });
    }

    listAccess(userId: string) {
        return this.prisma.userAccess.findMany({
            where: buildActiveUserAccessWhere({ userId }),
            orderBy: { assignedAt: 'desc' },
            select: this.accessSelect(),
        });
    }

    findPermissionCodes(userId: string) {
        return this.prisma.rolePermission.findMany({
            where: {
                role: {
                    accesses: { some: buildActiveUserAccessWhere({ userId }) },
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
            where: { id },
            select: { id: true, username: true, email: true, preferredLanguage: true },
        });
    }

    removeAccess(userId: string, id: string) {
        return this.prisma.userAccess.deleteMany({ where: { id, userId } });
    }

    private defaultSelect(): Prisma.UserSelect {
        return {
            id: true,
            username: true,
            email: true,
            fullName: true,
            preferredLanguage: true,
            status: true,
            mustChangePassword: true,
            emailVerifiedAt: true,
            twoFactorEnabled: true,
        };
    }

    private accessSelect(): Prisma.UserAccessSelect {
        return {
            id: true,
            organizationId: true,
            scopeKey: true,
            scopeId: true,
            role: { select: { id: true, code: true, name: true } },
        };
    }
}
