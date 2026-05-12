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

    deleteRole(id: string) {
        return this.repository.softDeleteRole(id);
    }

    assignRolePermissions(roleId: string, dto: AssignRolePermissionsDto) {
        return this.repository.syncRolePermissions(roleId, dto.permissionIds);
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

    deletePermission(id: string) {
        return this.repository.softDeletePermission(id);
    }
}
