import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { COMPANY_CONTEXT_REQUIRED_KEY, type CompanyRequest } from '@/decorators/company-context.decorator';
import { GLOBAL_ACCESS_REQUIRED_KEY } from '@/decorators/global-access.decorator';
import { PERMISSIONS_KEY } from '@/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '@/decorators/public.decorator';
import { ROLES_KEY } from '@/decorators/roles.decorator';
import { I18N_KEYS, I18nBadRequestException, I18nForbiddenException } from '@/i18n';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

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
        const requiresCompany = this.reflector.getAllAndOverride<boolean>(COMPANY_CONTEXT_REQUIRED_KEY, [context.getHandler(), context.getClass()]) ?? false;
        const requiresGlobalAccess = this.reflector.getAllAndOverride<boolean>(GLOBAL_ACCESS_REQUIRED_KEY, [context.getHandler(), context.getClass()]) ?? false;

        const request = context.switchToHttp().getRequest<CompanyRequest & { user?: RequestUser }>();
        const user = request.user;
        if (!user?.id) throw new I18nForbiddenException(I18N_KEYS.errors.authorization.unauthorized, 'Usuario no autorizado');

        await this.resolveCompanyId(request, user, requiresCompany);
        const companyId = request.companyId;
        const accessCompanyId = requiresGlobalAccess ? null : companyId;
        if (requiredPermissions.length === 0 && requiredRoles.length === 0) return true;

        if (requiredRoles.length > 0) {
            const hasRole = await this.accessControl.userHasAnyRole(user.id, requiredRoles, accessCompanyId);
            if (!hasRole) {
                throw new I18nForbiddenException(I18N_KEYS.errors.authorization.insufficientPermissions, 'Permisos insuficientes');
            }
        }

        if (requiredPermissions.length > 0) {
            const hasPermissions = await this.accessControl.userHasAllPermissions(user.id, requiredPermissions, accessCompanyId);
            if (!hasPermissions) {
                throw new I18nForbiddenException(I18N_KEYS.errors.authorization.insufficientPermissions, 'Permisos insuficientes');
            }
        }

        return true;
    }

    private async resolveCompanyId(request: Request, user: RequestUser, required: boolean): Promise<void> {
        const companyId = request.get('x-company-id')?.trim();
        if (!companyId) {
            if (!required) return;
            throw new I18nBadRequestException(I18N_KEYS.errors.validation.invalidData, 'X-Company-Id requerido');
        }

        if (!isUUID(companyId, '4')) {
            throw new I18nBadRequestException(I18N_KEYS.errors.validation.invalidData, 'X-Company-Id invalido');
        }

        if (!(await this.accessControl.companyIsActive(companyId))) {
            throw new I18nForbiddenException(I18N_KEYS.errors.authorization.companyDenied, 'Acceso denegado a esta compania');
        }

        if (!user.isGlobalAdmin && !(await this.accessControl.userCanAccessCompany(user.id, companyId))) {
            throw new I18nForbiddenException(I18N_KEYS.errors.authorization.companyDenied, 'Acceso denegado a esta compania');
        }

        (request as CompanyRequest).companyId = companyId;
    }
}
