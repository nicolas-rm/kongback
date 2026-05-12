import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { AssignRolePermissionsDto, CreatePermissionDto, CreateRoleDto, FindAccessControlDto, UpdatePermissionDto, UpdateRoleDto } from '@/modules/access-control/dto';
import { AccessControlRepository } from '@/modules/access-control/repositories/access-control.repository';

@Injectable()
export class AccessControlService {
    constructor(private readonly repository: AccessControlRepository) {}

    async userHasAnyRole(userId: string, requiredRoles: string[]): Promise<boolean> {
        if (requiredRoles.length === 0) return true;

        const roles = new Set(await this.repository.findUserRoleLabels(userId));
        return requiredRoles.some((role) => roles.has(role));
    }

    async userHasAllPermissions(userId: string, requiredPermissions: string[]): Promise<boolean> {
        if (requiredPermissions.length === 0) return true;

        const permissions = new Set(await this.repository.findUserPermissionCodes(userId));
        return requiredPermissions.every((permission) => permissions.has(permission));
    }

    createRole(dto: CreateRoleDto) {
        return this.repository.createRole(dto);
    }

    async findRoles(dto: FindAccessControlDto) {
        const where: Prisma.RoleWhereInput = {
            deletedAt: null,
            ...(dto.search ? { OR: [{ code: { contains: dto.search, mode: 'insensitive' } }, { name: { contains: dto.search, mode: 'insensitive' } }] } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findRoles(where, dto.skip, dto.actualLimit), this.repository.countRoles(where)]);
        return paginate(data, total, dto);
    }

    findRole(id: string) {
        return this.repository.findRoleById(id);
    }

    updateRole(id: string, dto: UpdateRoleDto) {
        return this.repository.updateRole(id, dto);
    }

    async deleteRole(id: string) {
        await this.repository.softDeleteRole(id);
        return { id, deleted: true };
    }

    async assignRolePermissions(roleId: string, dto: AssignRolePermissionsDto) {
        const role = await this.repository.syncRolePermissions(roleId, dto.permissionIds);
        if (!role) return null;

        return {
            id: role.id,
            code: role.code,
            name: role.name,
            description: role.description,
            permissions: role.permissions.map((entry) => entry.permission),
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
        };
    }

    createPermission(dto: CreatePermissionDto) {
        return this.repository.createPermission(dto);
    }

    async findPermissions(dto: FindAccessControlDto) {
        const where: Prisma.PermissionWhereInput = {
            deletedAt: null,
            ...(dto.search ? { OR: [{ code: { contains: dto.search, mode: 'insensitive' } }, { name: { contains: dto.search, mode: 'insensitive' } }] } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findPermissions(where, dto.skip, dto.actualLimit), this.repository.countPermissions(where)]);
        return paginate(data, total, dto);
    }

    findPermission(id: string) {
        return this.repository.findPermissionById(id);
    }

    updatePermission(id: string, dto: UpdatePermissionDto) {
        return this.repository.updatePermission(id, dto);
    }

    async deletePermission(id: string) {
        await this.repository.softDeletePermission(id);
        return { id, deleted: true };
    }
}
