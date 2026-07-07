import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { buildActiveUserAccessWhere } from '@/utilities/authentication/active-user-access-filter';

@Injectable()
export class AccessControlRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findUserRoleLabels(userId: string, companyId?: string | null): Promise<string[]> {
        const accesses = await this.prisma.userAccess.findMany({
            where: buildActiveUserAccessWhere({ userId }, companyId),
            select: { role: { select: { code: true, name: true } } },
        });

        return accesses.flatMap((entry) => [entry.role.code, entry.role.name]);
    }

    async findUserPermissionCodes(userId: string, companyId?: string | null): Promise<string[]> {
        const rolePermissions = await this.prisma.rolePermission.findMany({
            where: {
                role: { accesses: { some: buildActiveUserAccessWhere({ userId }, companyId) } },
            },
            select: { permission: { select: { code: true } } },
        });

        return rolePermissions.map((entry) => entry.permission.code);
    }

    createRole(data: Prisma.RoleUncheckedCreateInput) {
        return this.prisma.role.create({ data, select: this.roleSelect() });
    }

    findRoles(where: Prisma.RoleWhereInput, skip: number, take?: number) {
        return this.prisma.role.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: this.roleSelect() });
    }

    countRoles(where: Prisma.RoleWhereInput): Promise<number> {
        return this.prisma.role.count({ where });
    }

    findRoleById(id: string) {
        return this.prisma.role.findFirst({ where: { id }, select: this.roleSelect() });
    }

    updateRole(id: string, data: Prisma.RoleUncheckedUpdateManyInput) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.role.updateMany({ where: { id }, data });
            if (result.count === 0) return null;

            return tx.role.findFirst({ where: { id }, select: this.roleSelect() });
        });
    }

    deleteRole(id: string) {
        return this.prisma.role.deleteMany({ where: { id } });
    }

    syncRolePermissions(roleId: string, permissionIds: string[]) {
        return this.prisma.$transaction(async (tx) => {
            const activeRole = await tx.role.findFirst({ where: { id: roleId }, select: { id: true } });
            if (!activeRole) return null;

            await tx.rolePermission.deleteMany({ where: { roleId } });
            if (permissionIds.length > 0) {
                await tx.rolePermission.createMany({
                    data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
                    skipDuplicates: true,
                });
            }
            return tx.role.findFirst({
                where: { id: roleId },
                select: {
                    ...this.roleSelect(),
                    permissions: {
                        select: {
                            permission: { select: this.permissionSelect() },
                        },
                    },
                },
            });
        });
    }

    findRolePermissions(roleId: string) {
        return this.prisma.rolePermission.findMany({
            where: {
                roleId,
            },
            orderBy: { permission: { code: 'asc' } },
            select: {
                permission: { select: this.permissionSelect() },
            },
        });
    }

    createPermission(data: Prisma.PermissionUncheckedCreateInput) {
        return this.prisma.permission.create({ data, select: this.permissionSelect() });
    }

    countActivePermissions(ids: string[]): Promise<number> {
        return this.prisma.permission.count({ where: { id: { in: ids } } });
    }

    countActiveCompanies(ids: string[]): Promise<number> {
        return this.prisma.company.count({ where: { id: { in: ids }, status: 'active' } });
    }

    countUserGlobalAccesses(userId: string): Promise<number> {
        return this.prisma.userAccess.count({
            where: buildActiveUserAccessWhere({ userId }, null),
        });
    }

    countUserCompanyAccesses(userId: string, companyId: string): Promise<number> {
        return this.prisma.userAccess.count({
            where: buildActiveUserAccessWhere({ userId }, companyId),
        });
    }

    findPermissions(where: Prisma.PermissionWhereInput, skip: number, take?: number) {
        return this.prisma.permission.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: this.permissionSelect() });
    }

    countPermissions(where: Prisma.PermissionWhereInput): Promise<number> {
        return this.prisma.permission.count({ where });
    }

    findPermissionById(id: string) {
        return this.prisma.permission.findFirst({ where: { id }, select: this.permissionSelect() });
    }

    updatePermission(id: string, data: Prisma.PermissionUncheckedUpdateManyInput) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.permission.updateMany({ where: { id }, data });
            if (result.count === 0) return null;

            return tx.permission.findFirst({ where: { id }, select: this.permissionSelect() });
        });
    }

    deletePermission(id: string) {
        return this.prisma.permission.deleteMany({ where: { id } });
    }

    private roleSelect(): Prisma.RoleSelect {
        return {
            id: true,
            code: true,
            name: true,
            description: true,
        };
    }

    private permissionSelect(): Prisma.PermissionSelect {
        return {
            id: true,
            code: true,
            name: true,
            description: true,
        };
    }
}
