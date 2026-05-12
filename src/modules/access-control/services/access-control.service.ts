import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { AssignRolePermissionsDto, CreatePermissionDto, CreateRoleDto, FindAccessControlDto, UpdatePermissionDto, UpdateRoleDto } from '@/modules/access-control/dto';
import { AccessControlRepository } from '@/modules/access-control/repositories/access-control.repository';
import { PermissionResponse, RoleResponse, RoleWithPermissionsResponse } from '@/modules/access-control/responses';

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

    async createRole(dto: CreateRoleDto) {
        const role = await this.repository.createRole(dto);
        return RoleResponse.from(role);
    }

    async findRoles(dto: FindAccessControlDto) {
        const where: Prisma.RoleWhereInput = {
            deletedAt: null,
            ...(dto.search ? { OR: [{ code: { contains: dto.search, mode: 'insensitive' } }, { name: { contains: dto.search, mode: 'insensitive' } }] } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findRoles(where, dto.skip, dto.actualLimit), this.repository.countRoles(where)]);
        return paginate(
            data.map((role) => RoleResponse.from(role)),
            total,
            dto
        );
    }

    async findRole(id: string) {
        const role = await this.repository.findRoleById(id);
        return role ? RoleResponse.from(role) : null;
    }

    async updateRole(id: string, dto: UpdateRoleDto) {
        const role = await this.repository.updateRole(id, dto);
        return RoleResponse.from(role);
    }

    async deleteRole(id: string) {
        await this.repository.softDeleteRole(id);
        return { id, deleted: true };
    }

    async assignRolePermissions(roleId: string, dto: AssignRolePermissionsDto) {
        const role = await this.repository.syncRolePermissions(roleId, dto.permissionIds);
        if (!role) return null;

        return RoleWithPermissionsResponse.from(role);
    }

    async findRolePermissions(roleId: string) {
        const permissions = await this.repository.findRolePermissions(roleId);
        return permissions.map((entry) => PermissionResponse.from(entry.permission));
    }

    async createPermission(dto: CreatePermissionDto) {
        const permission = await this.repository.createPermission(dto);
        return PermissionResponse.from(permission);
    }

    async findPermissions(dto: FindAccessControlDto) {
        const where: Prisma.PermissionWhereInput = {
            deletedAt: null,
            ...(dto.search ? { OR: [{ code: { contains: dto.search, mode: 'insensitive' } }, { name: { contains: dto.search, mode: 'insensitive' } }] } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findPermissions(where, dto.skip, dto.actualLimit), this.repository.countPermissions(where)]);
        return paginate(
            data.map((permission) => PermissionResponse.from(permission)),
            total,
            dto
        );
    }

    async findPermission(id: string) {
        const permission = await this.repository.findPermissionById(id);
        return permission ? PermissionResponse.from(permission) : null;
    }

    async updatePermission(id: string, dto: UpdatePermissionDto) {
        const permission = await this.repository.updatePermission(id, dto);
        return PermissionResponse.from(permission);
    }

    async deletePermission(id: string) {
        await this.repository.softDeletePermission(id);
        return { id, deleted: true };
    }
}
