import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { I18N_KEYS, I18nBadRequestException, I18nNotFoundException } from '@/i18n';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { AssignRolePermissionsDto, CreatePermissionDto, CreateRoleDto, FindAccessControlDto, UpdatePermissionDto, UpdateRoleDto } from '@/modules/access-control/dto';
import { AccessControlRepository } from '@/modules/access-control/repositories/access-control.repository';
import { PermissionResponse, RoleResponse, RoleWithPermissionsResponse } from '@/modules/access-control/responses';

@Injectable()
export class AccessControlService {
    constructor(private readonly repository: AccessControlRepository) {}

    async userHasAnyRole(userId: string, requiredRoles: string[], organizationId?: string | null, companyId?: string | null): Promise<boolean> {
        if (requiredRoles.length === 0) return true;

        const roles = new Set(await this.repository.findUserRoleLabels(userId, organizationId, companyId));
        return requiredRoles.some((role) => roles.has(role));
    }

    async userHasAllPermissions(userId: string, requiredPermissions: string[], organizationId?: string | null, companyId?: string | null): Promise<boolean> {
        if (requiredPermissions.length === 0) return true;

        const permissions = new Set(await this.listUserPermissionCodes(userId, organizationId, companyId));
        return requiredPermissions.every((permission) => permissions.has(permission));
    }

    async listUserPermissionCodes(userId: string, organizationId?: string | null, companyId?: string | null): Promise<string[]> {
        const permissions = await this.repository.findUserPermissionCodes(userId, organizationId, companyId);
        return [...new Set(permissions)].sort((left, right) => left.localeCompare(right));
    }

    async organizationIsActive(organizationId: string): Promise<boolean> {
        return (await this.repository.countActiveOrganizations([organizationId])) === 1;
    }

    async companyIsActiveInOrganization(companyId: string, organizationId: string): Promise<boolean> {
        return (await this.repository.countActiveCompanies([companyId], organizationId)) === 1;
    }

    async userHasOrganizationWideAccess(userId: string, organizationId: string): Promise<boolean> {
        return (await this.repository.countUserOrganizationWideAccesses(userId, organizationId)) > 0;
    }

    async userCanAccessCompany(userId: string, organizationId: string, companyId: string): Promise<boolean> {
        return (await this.repository.countUserCompanyAccesses(userId, organizationId, companyId)) > 0;
    }

    async createRole(dto: CreateRoleDto) {
        const role = await this.repository.createRole(dto);
        return RoleResponse.from(role);
    }

    async findRoles(dto: FindAccessControlDto) {
        const where: Prisma.RoleWhereInput = {
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
        if (!role) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'Registro no encontrado');

        return RoleResponse.from(role);
    }

    async deleteRole(id: string) {
        const result = await this.repository.deleteRole(id);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'Registro no encontrado');

        return { id, deleted: true };
    }

    async assignRolePermissions(roleId: string, dto: AssignRolePermissionsDto) {
        await this.assertPermissionsActive(dto.permissionIds);

        const role = await this.repository.syncRolePermissions(roleId, dto.permissionIds);
        if (!role) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'Registro no encontrado');

        return RoleWithPermissionsResponse.from(role);
    }

    async findRolePermissions(roleId: string) {
        const role = await this.repository.findRoleById(roleId);
        if (!role) return null;

        const permissions = await this.repository.findRolePermissions(roleId);
        return permissions.map((entry) => PermissionResponse.from(entry.permission));
    }

    async createPermission(dto: CreatePermissionDto) {
        const permission = await this.repository.createPermission(dto);
        return PermissionResponse.from(permission);
    }

    async findPermissions(dto: FindAccessControlDto) {
        const where: Prisma.PermissionWhereInput = {
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
        if (!permission) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'Registro no encontrado');

        return PermissionResponse.from(permission);
    }

    async deletePermission(id: string) {
        const result = await this.repository.deletePermission(id);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'Registro no encontrado');

        return { id, deleted: true };
    }

    private async assertPermissionsActive(permissionIds: string[]): Promise<void> {
        const uniquePermissionIds = [...new Set(permissionIds)];
        if (uniquePermissionIds.length === 0) return;

        const activePermissions = await this.repository.countActivePermissions(uniquePermissionIds);
        if (activePermissions !== uniquePermissionIds.length) throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
    }
}
