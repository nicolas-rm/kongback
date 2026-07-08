import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { I18N_KEYS, I18nBadRequestException, I18nNotFoundException } from '@/i18n';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { SUB_COMPANY_SCOPE_KEY, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { AssignRolePermissionsDto, CreatePermissionDto, CreateRoleDto, FindAccessControlDto, UpdatePermissionDto, UpdateRoleDto } from '@/modules/access-control/dto';
import { AccessControlRepository } from '@/modules/access-control/repositories/access-control.repository';
import { PermissionResponse, RoleResponse, RoleWithPermissionsResponse } from '@/modules/access-control/responses';

@Injectable()
export class AccessControlService {
    constructor(private readonly repository: AccessControlRepository) {}

    async userHasAnyRole(userId: string, requiredRoles: string[], companyId?: string | null): Promise<boolean> {
        if (requiredRoles.length === 0) return true;

        const roles = new Set(await this.repository.findUserRoleLabels(userId, companyId));
        return requiredRoles.some((role) => roles.has(role));
    }

    async userHasAllPermissions(userId: string, requiredPermissions: string[], companyId?: string | null): Promise<boolean> {
        if (requiredPermissions.length === 0) return true;

        const permissions = new Set(await this.listUserPermissionCodes(userId, companyId));
        return requiredPermissions.every((permission) => permissions.has(permission));
    }

    async listUserPermissionCodes(userId: string, companyId?: string | null): Promise<string[]> {
        const permissions = await this.repository.findUserPermissionCodes(userId, companyId);
        return [...new Set(permissions)].sort((left, right) => left.localeCompare(right));
    }

    async companyIsActive(companyId: string): Promise<boolean> {
        return (await this.repository.countActiveCompanies([companyId])) === 1;
    }

    async userHasGlobalAccess(userId: string): Promise<boolean> {
        return (await this.repository.countUserGlobalAccesses(userId)) > 0;
    }

    async userCanAccessCompany(userId: string, companyId: string): Promise<boolean> {
        return (await this.repository.countUserCompanyAccesses(userId, companyId)) > 0;
    }

    async resolveCompanyScope(userId: string, companyId: string, permissionCodes: string[], roleLabels: string[]): Promise<CompanyScope | null> {
        const accesses = await this.repository.findUserCompanyScopeAccesses(userId, companyId, permissionCodes, roleLabels);
        const hasCompanyWideAccess = accesses.some((access) => !access.companyId || (!access.scopeKey && !access.scopeId));
        if (hasCompanyWideAccess) return { companyId };

        const subCompanyIds = [
            ...new Set(accesses.filter((access) => access.companyId === companyId && access.scopeKey === SUB_COMPANY_SCOPE_KEY && access.scopeId).map((access) => access.scopeId as string)),
        ];
        const activeSubCompanyIds = await this.repository.findActiveSubCompanyScopeIds(companyId, subCompanyIds);
        if (activeSubCompanyIds.length === 0) return null;

        return { companyId, subCompanyIds: activeSubCompanyIds };
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
