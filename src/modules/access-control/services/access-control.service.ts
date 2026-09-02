import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { I18N_KEYS, I18nBadRequestException, I18nNotFoundException } from '@/i18n';
import { AuditService } from '@/modules/audit/audit.service';
import { createExcelExport, EXCEL_EXPORT_MAX_ROWS, valueOrDash } from '@/utilities/export/excel-export';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { SUB_COMPANY_SCOPE_KEY, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { AssignRolePermissionsDto, CreatePermissionDto, CreateRoleDto, FindAccessControlDto, UpdatePermissionDto, UpdateRoleDto } from '@/modules/access-control/dto';
import { AccessControlRepository } from '@/modules/access-control/repositories/access-control.repository';
import { PermissionResponse, RoleResponse, RoleWithPermissionsResponse } from '@/modules/access-control/responses';

@Injectable()
export class AccessControlService {
    constructor(
        private readonly repository: AccessControlRepository,
        private readonly audit: AuditService
    ) {}

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
        void this.audit.recordAccess({ action: 'role_created', resourceType: 'Role', resourceId: role.id, after: role });
        return RoleResponse.from(role);
    }

    async findRoles(dto: FindAccessControlDto) {
        const where = this.roleWhere(dto);
        const [data, total] = await Promise.all([this.repository.findRoles(where, dto.skip, dto.actualLimit), this.repository.countRoles(where)]);
        return paginate(
            data.map((role) => RoleResponse.from(role)),
            total,
            dto
        );
    }

    async exportRoles(dto: FindAccessControlDto) {
        const where = this.roleWhere(dto);
        const roles = await this.repository.findRoles(where, 0, EXCEL_EXPORT_MAX_ROWS);
        void this.audit.recordAccess({ action: 'roles_exported', resourceType: 'Role', metadata: { rows: roles.length, search: dto.search, format: dto.format ?? 'xlsx' } });

        return createExcelExport(
            'roles.xlsx',
            'Roles',
            [
                { header: 'ID', value: (role) => role.id },
                { header: 'Codigo', value: (role) => role.code },
                { header: 'Nombre', value: (role) => role.name },
                { header: 'Descripcion', value: (role) => valueOrDash(role.description) },
            ],
            roles,
            dto.format
        );
    }

    async findRole(id: string) {
        const role = await this.repository.findRoleById(id);
        return role ? RoleResponse.from(role) : null;
    }

    async updateRole(id: string, dto: UpdateRoleDto) {
        const role = await this.repository.updateRole(id, dto);
        if (!role) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'No encontramos el registro solicitado.');

        void this.audit.recordAccess({ action: 'role_updated', resourceType: 'Role', resourceId: role.id, metadata: dto, after: role });
        return RoleResponse.from(role);
    }

    async deleteRole(id: string) {
        const result = await this.repository.deleteRole(id);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'No encontramos el registro solicitado.');

        void this.audit.recordAccess({ action: 'role_deleted', resourceType: 'Role', resourceId: id });
        return { id, deleted: true };
    }

    async assignRolePermissions(roleId: string, dto: AssignRolePermissionsDto) {
        await this.assertPermissionsActive(dto.permissionIds);

        const role = await this.repository.syncRolePermissions(roleId, dto.permissionIds);
        if (!role) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'No encontramos el registro solicitado.');

        void this.audit.recordAccess({ action: 'role_permissions_updated', resourceType: 'Role', resourceId: roleId, metadata: { permissionIds: dto.permissionIds } });
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
        void this.audit.recordAccess({ action: 'permission_created', resourceType: 'Permission', resourceId: permission.id, after: permission });
        return PermissionResponse.from(permission);
    }

    async findPermissions(dto: FindAccessControlDto) {
        const where = this.permissionWhere(dto);
        const [data, total] = await Promise.all([this.repository.findPermissions(where, dto.skip, dto.actualLimit), this.repository.countPermissions(where)]);
        return paginate(
            data.map((permission) => PermissionResponse.from(permission)),
            total,
            dto
        );
    }

    async exportPermissions(dto: FindAccessControlDto) {
        const where = this.permissionWhere(dto);
        const permissions = await this.repository.findPermissions(where, 0, EXCEL_EXPORT_MAX_ROWS);
        void this.audit.recordAccess({ action: 'permissions_exported', resourceType: 'Permission', metadata: { rows: permissions.length, search: dto.search, format: dto.format ?? 'xlsx' } });

        return createExcelExport(
            'permisos.xlsx',
            'Permisos',
            [
                { header: 'ID', value: (permission) => permission.id },
                { header: 'Codigo', value: (permission) => permission.code },
                { header: 'Nombre', value: (permission) => valueOrDash(permission.name) },
                { header: 'Descripcion', value: (permission) => valueOrDash(permission.description) },
            ],
            permissions,
            dto.format
        );
    }

    async findPermission(id: string) {
        const permission = await this.repository.findPermissionById(id);
        return permission ? PermissionResponse.from(permission) : null;
    }

    async updatePermission(id: string, dto: UpdatePermissionDto) {
        const permission = await this.repository.updatePermission(id, dto);
        if (!permission) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'No encontramos el registro solicitado.');

        void this.audit.recordAccess({ action: 'permission_updated', resourceType: 'Permission', resourceId: permission.id, metadata: dto, after: permission });
        return PermissionResponse.from(permission);
    }

    async deletePermission(id: string) {
        const result = await this.repository.deletePermission(id);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'No encontramos el registro solicitado.');

        void this.audit.recordAccess({ action: 'permission_deleted', resourceType: 'Permission', resourceId: id });
        return { id, deleted: true };
    }

    private async assertPermissionsActive(permissionIds: string[]): Promise<void> {
        const uniquePermissionIds = [...new Set(permissionIds)];
        if (uniquePermissionIds.length === 0) return;

        const activePermissions = await this.repository.countActivePermissions(uniquePermissionIds);
        if (activePermissions !== uniquePermissionIds.length) throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Algunos datos relacionados no son validos.');
    }

    private roleWhere(dto: FindAccessControlDto): Prisma.RoleWhereInput {
        return {
            ...(dto.search
                ? {
                      OR: [
                          { code: { contains: dto.search, mode: 'insensitive' } },
                          { name: { contains: dto.search, mode: 'insensitive' } },
                          { description: { contains: dto.search, mode: 'insensitive' } },
                      ],
                  }
                : {}),
        };
    }

    private permissionWhere(dto: FindAccessControlDto): Prisma.PermissionWhereInput {
        return {
            ...(dto.search
                ? {
                      OR: [
                          { code: { contains: dto.search, mode: 'insensitive' } },
                          { name: { contains: dto.search, mode: 'insensitive' } },
                          { description: { contains: dto.search, mode: 'insensitive' } },
                      ],
                  }
                : {}),
        };
    }
}
