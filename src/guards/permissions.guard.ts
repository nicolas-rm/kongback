import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { COMPANY_CONTEXT_REQUIRED_KEY, type CompanyRequest } from '@/decorators/company-context.decorator';
import { PERMISSIONS_KEY } from '@/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '@/decorators/public.decorator';
import { ROLES_KEY } from '@/decorators/roles.decorator';
import { SYSTEM_ACCESS_REQUIRED_KEY, SYSTEM_OR_COMPANY_ACCESS_REQUIRED_KEY } from '@/decorators/system-access.decorator';
import { ERROR_CODES } from '@/errors/error-codes';
import { I18N_KEYS, I18nForbiddenException } from '@/i18n';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';

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
        const requiresSystemAccess = this.reflector.getAllAndOverride<boolean>(SYSTEM_ACCESS_REQUIRED_KEY, [context.getHandler(), context.getClass()]) ?? false;
        const requiresSystemOrCompanyAccess = this.reflector.getAllAndOverride<boolean>(SYSTEM_OR_COMPANY_ACCESS_REQUIRED_KEY, [context.getHandler(), context.getClass()]) ?? false;

        const request = context.switchToHttp().getRequest<CompanyRequest & { user?: RequestUser }>();
        const user = request.user;
        if (!user?.id) throw new I18nForbiddenException(I18N_KEYS.errors.authorization.unauthorized, 'Tu sesion no es valida. Inicia sesion nuevamente.');

        await this.resolveCompanyId(request, user, requiresCompany);
        const companyId = request.companyId;
        const accessCompanyId = requiresSystemAccess || (requiresSystemOrCompanyAccess && !companyId) ? null : companyId;

        if (requiredRoles.length > 0) {
            const hasRole = await this.accessControl.userHasAnyRole(user.id, requiredRoles, accessCompanyId);
            if (!hasRole) {
                throw new I18nForbiddenException(I18N_KEYS.errors.authorization.insufficientPermissions, 'No tienes permisos suficientes para este contenido.');
            }
        }

        if (requiredPermissions.length > 0) {
            const hasPermissions = await this.accessControl.userHasAllPermissions(user.id, requiredPermissions, accessCompanyId);
            if (!hasPermissions) {
                throw new I18nForbiddenException(I18N_KEYS.errors.authorization.insufficientPermissions, 'No tienes permisos suficientes para este contenido.');
            }
        }

        if (companyId && !requiresSystemAccess) {
            request.companyScope = await this.resolveCompanyScope(user, companyId, requiredPermissions, requiredRoles);
        }

        return true;
    }

    private async resolveCompanyScope(user: RequestUser, companyId: string, requiredPermissions: string[], requiredRoles: string[]): Promise<CompanyScope> {
        if (user.isGlobalAdmin) return { companyId };

        const scope = await this.accessControl.resolveCompanyScope(user.id, companyId, requiredPermissions, requiredRoles);
        if (!scope) {
            throw new I18nForbiddenException(I18N_KEYS.errors.authorization.companyDenied, 'No tienes acceso a esta compania.');
        }

        return scope;
    }

    private async resolveCompanyId(request: Request, user: RequestUser, required: boolean): Promise<void> {
        const companyId = request.get('x-company-id')?.trim();
        if (!companyId) {
            if (!required) return;
            throw this.invalidCompanyHeader('Selecciona una compania para continuar.', 'Selecciona una compania antes de consultar este modulo.');
        }

        if (!isUUID(companyId, '4')) {
            throw this.invalidCompanyHeader('Selecciona una compania valida para continuar.', 'La compania seleccionada no es valida.');
        }

        if (!(await this.accessControl.companyIsActive(companyId))) {
            throw new I18nForbiddenException(I18N_KEYS.errors.authorization.companyDenied, 'No tienes acceso a esta compania.');
        }

        if (!user.isGlobalAdmin && !(await this.accessControl.userCanAccessCompany(user.id, companyId))) {
            throw new I18nForbiddenException(I18N_KEYS.errors.authorization.companyDenied, 'No tienes acceso a esta compania.');
        }

        (request as CompanyRequest).companyId = companyId;
    }

    private invalidCompanyHeader(message: string, detail: string): BadRequestException {
        return new BadRequestException({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message,
            errors: [{ field: 'X-Company-Id', message: detail }],
        });
    }
}
