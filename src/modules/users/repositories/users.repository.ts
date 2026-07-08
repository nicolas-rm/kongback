import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { buildActiveUserAccessWhere } from '@/utilities/authentication/active-user-access-filter';
import { SUB_COMPANY_SCOPE_KEY, type CompanyScope } from '@/utilities/tenancy/company-scope';

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

    findById(id: string, scope?: CompanyScope) {
        return this.prisma.user.findFirst({
            where: {
                id,
                ...this.userCompanyScope(scope),
            },
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
            select: { id: true, userId: true, roleId: true, companyId: true, scopeKey: true, scopeId: true },
        });
    }

    countActiveRoles(ids: string[]): Promise<number> {
        return this.prisma.role.count({ where: { id: { in: ids } } });
    }

    countActiveCompanies(ids: string[]): Promise<number> {
        return this.prisma.company.count({
            where: {
                status: 'active',
                id: { in: ids },
            },
        });
    }

    countActiveSubCompanyScopes(scopes: Array<{ companyId: string; subCompanyId: string }>): Promise<number> {
        return this.prisma.subCompany.count({
            where: {
                OR: scopes.map((scope) => ({
                    id: scope.subCompanyId,
                    companyId: scope.companyId,
                    status: 'active',
                })),
            },
        });
    }

    replaceAccess(userId: string, data: Prisma.UserAccessUncheckedCreateInput[], scope?: CompanyScope) {
        return this.prisma.$transaction(async (tx) => {
            await tx.userAccess.deleteMany({ where: this.accessScopeWhere(userId, scope) });

            if (data.length > 0) {
                await tx.userAccess.createMany({ data });
            }

            return tx.userAccess.findMany({
                where: this.accessScopeWhere(userId, scope),
                orderBy: { assignedAt: 'desc' },
                select: this.accessSelect(),
            });
        });
    }

    listAccess(userId: string, scope?: CompanyScope) {
        return this.prisma.userAccess.findMany({
            where: this.accessScopeWhere(userId, scope),
            orderBy: { assignedAt: 'desc' },
            select: this.accessSelect(),
        });
    }

    findPermissionCodes(userId: string, scope?: CompanyScope) {
        return this.prisma.rolePermission.findMany({
            where: {
                role: { accesses: { some: this.permissionAccessScopeWhere(userId, scope) } },
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

    removeAccess(userId: string, id: string, scope?: CompanyScope) {
        return this.prisma.userAccess.deleteMany({ where: { id, ...this.accessScopeWhere(userId, scope) } });
    }

    private userCompanyScope(scope?: CompanyScope): Prisma.UserWhereInput {
        if (!scope?.companyId) return {};
        if (scope.subCompanyIds) {
            return { accesses: { some: { companyId: scope.companyId, scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: { in: scope.subCompanyIds }, company: { status: 'active' } } } };
        }
        return { accesses: { some: { companyId: scope.companyId, company: { status: 'active' } } } };
    }

    private accessScopeWhere(userId: string, scope?: CompanyScope): Prisma.UserAccessWhereInput {
        if (!scope?.companyId) return buildActiveUserAccessWhere({ userId });
        if (scope.subCompanyIds) return { userId, companyId: scope.companyId, scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: { in: scope.subCompanyIds }, company: { status: 'active' } };
        return { userId, companyId: scope.companyId, company: { status: 'active' } };
    }

    private permissionAccessScopeWhere(userId: string, scope?: CompanyScope): Prisma.UserAccessWhereInput {
        if (!scope?.companyId) return buildActiveUserAccessWhere({ userId });
        if (!scope.subCompanyIds) return buildActiveUserAccessWhere({ userId }, scope.companyId);

        return buildActiveUserAccessWhere(
            {
                userId,
                OR: [
                    { companyId: null },
                    { companyId: scope.companyId, scopeKey: null, scopeId: null },
                    { companyId: scope.companyId, scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: { in: scope.subCompanyIds } },
                ],
            },
            scope.companyId
        );
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
            companyId: true,
            scopeKey: true,
            scopeId: true,
            role: { select: { id: true, code: true, name: true } },
        };
    }
}
