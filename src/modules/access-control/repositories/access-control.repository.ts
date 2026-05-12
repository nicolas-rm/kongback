import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { buildActiveUserAccessWhere } from '@/utilities/authentication/active-user-access-filter';

@Injectable()
export class AccessControlRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findUserRoleLabels(userId: string): Promise<string[]> {
        const accesses = await this.prisma.userAccess.findMany({
            where: buildActiveUserAccessWhere({ userId }),
            select: { role: { select: { code: true, name: true } } },
        });

        return accesses.flatMap((entry) => [entry.role.code, entry.role.name]);
    }

    async findUserPermissionCodes(userId: string): Promise<string[]> {
        const rolePermissions = await this.prisma.rolePermission.findMany({
            where: {
                permission: { deletedAt: null },
                role: {
                    deletedAt: null,
                    accesses: { some: buildActiveUserAccessWhere({ userId }) },
                },
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
        return this.prisma.role.findFirst({ where: { id, deletedAt: null }, select: this.roleSelect() });
    }

    updateRole(id: string, data: Prisma.RoleUncheckedUpdateInput) {
        return this.prisma.role.update({ where: { id }, data, select: this.roleSelect() });
    }

    softDeleteRole(id: string) {
        return this.prisma.role.update({ where: { id }, data: { deletedAt: new Date() }, select: { id: true } });
    }

    syncRolePermissions(roleId: string, permissionIds: string[]) {
        return this.prisma.$transaction(async (tx) => {
            await tx.rolePermission.deleteMany({ where: { roleId } });
            if (permissionIds.length > 0) {
                await tx.rolePermission.createMany({
                    data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
                    skipDuplicates: true,
                });
            }
            return tx.role.findUnique({
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

    createPermission(data: Prisma.PermissionUncheckedCreateInput) {
        return this.prisma.permission.create({ data, select: this.permissionSelect() });
    }

    findPermissions(where: Prisma.PermissionWhereInput, skip: number, take?: number) {
        return this.prisma.permission.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: this.permissionSelect() });
    }

    countPermissions(where: Prisma.PermissionWhereInput): Promise<number> {
        return this.prisma.permission.count({ where });
    }

    findPermissionById(id: string) {
        return this.prisma.permission.findFirst({ where: { id, deletedAt: null }, select: this.permissionSelect() });
    }

    updatePermission(id: string, data: Prisma.PermissionUncheckedUpdateInput) {
        return this.prisma.permission.update({ where: { id }, data, select: this.permissionSelect() });
    }

    softDeletePermission(id: string) {
        return this.prisma.permission.update({ where: { id }, data: { deletedAt: new Date() }, select: { id: true } });
    }

    private roleSelect(): Prisma.RoleSelect {
        return {
            id: true,
            code: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
        };
    }

    private permissionSelect(): Prisma.PermissionSelect {
        return {
            id: true,
            code: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
        };
    }
}
