import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { ORGANIZATION_CONTEXT_REQUIRED_KEY, type OrganizationRequest } from '@/decorators/organization-context.decorator';
import { PERMISSIONS_KEY } from '@/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '@/decorators/public.decorator';
import { ROLES_KEY } from '@/decorators/roles.decorator';
import { I18N_KEYS, I18nBadRequestException, I18nForbiddenException } from '@/i18n';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { assertOrganizationAccess } from '@/utilities/tenancy/tenant-scope';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly accessControl: AccessControlService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
        if (isPublic) return true;

        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]) ?? [];
        const requiresOrganization = this.reflector.getAllAndOverride<boolean>(ORGANIZATION_CONTEXT_REQUIRED_KEY, [context.getHandler(), context.getClass()]) ?? false;

        const request = context.switchToHttp().getRequest<OrganizationRequest & { user?: RequestUser }>();
        const user = request.user;
        if (!user?.id) throw new I18nForbiddenException(I18N_KEYS.errors.authorization.unauthorized, 'Usuario no autorizado');

        const organizationId = requiresOrganization ? await this.resolveOrganizationId(request, user) : undefined;
        if (requiredPermissions.length === 0 && requiredRoles.length === 0) return true;

        if (requiredRoles.length > 0) {
            const hasRole = await this.accessControl.userHasAnyRole(user.id, requiredRoles, organizationId);
            if (!hasRole) {
                throw new I18nForbiddenException(I18N_KEYS.errors.authorization.insufficientPermissions, 'Permisos insuficientes');
            }
        }

        if (requiredPermissions.length > 0) {
            const hasPermissions = await this.accessControl.userHasAllPermissions(user.id, requiredPermissions, organizationId);
            if (!hasPermissions) {
                throw new I18nForbiddenException(I18N_KEYS.errors.authorization.insufficientPermissions, 'Permisos insuficientes');
            }
        }

        return true;
    }

    private async resolveOrganizationId(request: Request, user: RequestUser): Promise<string> {
        const organizationId = request.get('x-organization-id')?.trim();
        if (!organizationId || !isUUID(organizationId, '4')) {
            throw new I18nBadRequestException(I18N_KEYS.errors.validation.invalidData, 'X-Organization-Id requerido');
        }

        assertOrganizationAccess(user, organizationId);
        if (!(await this.accessControl.organizationIsActive(organizationId))) {
            throw new I18nForbiddenException(I18N_KEYS.errors.authorization.organizationDenied, 'Acceso denegado a esta organizacion');
        }

        (request as OrganizationRequest).organizationId = organizationId;
        await this.resolveCompanyId(request, organizationId);
        return organizationId;
    }

    private async resolveCompanyId(request: Request, organizationId: string): Promise<void> {
        const companyId = request.get('x-company-id')?.trim();
        if (!companyId) return;

        if (!isUUID(companyId, '4')) {
            throw new I18nBadRequestException(I18N_KEYS.errors.validation.invalidData, 'X-Company-Id invalido');
        }

        if (!(await this.accessControl.companyIsActiveInOrganization(companyId, organizationId))) {
            throw new I18nForbiddenException(I18N_KEYS.errors.authorization.organizationDenied, 'Acceso denegado a esta compania');
        }

        (request as OrganizationRequest).companyId = companyId;
    }
}
