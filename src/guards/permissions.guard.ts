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
import { AuditService } from '@/modules/audit/audit.service';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly accessControl: AccessControlService,
        private readonly audit: AuditService
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
                void this.audit.recordSecurity({
                    action: 'insufficient_roles',
                    result: 'denied',
                    statusCode: 403,
                    reason: 'missing_required_role',
                    metadata: { requiredRoles, companyId: accessCompanyId },
                });
                throw new I18nForbiddenException(I18N_KEYS.errors.authorization.insufficientPermissions, 'No tienes permisos suficientes para este contenido.');
            }
        }

        if (requiredPermissions.length > 0) {
            const hasPermissions = await this.accessControl.userHasAllPermissions(user.id, requiredPermissions, accessCompanyId);
            if (!hasPermissions) {
                void this.audit.recordSecurity({
                    action: 'insufficient_permissions',
                    result: 'denied',
                    statusCode: 403,
                    reason: 'missing_required_permission',
                    metadata: { requiredPermissions, companyId: accessCompanyId },
                });
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
            void this.audit.recordSecurity({
                action: 'company_scope_denied',
                result: 'denied',
                statusCode: 403,
                reason: 'company_scope_not_resolved',
                metadata: { companyId, requiredPermissions, requiredRoles },
            });
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
            void this.audit.recordSecurity({
                action: 'company_denied',
                result: 'denied',
                statusCode: 403,
                reason: 'company_not_active',
                metadata: { companyId },
            });
            throw new I18nForbiddenException(I18N_KEYS.errors.authorization.companyDenied, 'No tienes acceso a esta compania.');
        }

        if (!user.isGlobalAdmin && !(await this.accessControl.userCanAccessCompany(user.id, companyId))) {
            void this.audit.recordSecurity({
                action: 'company_denied',
                result: 'denied',
                statusCode: 403,
                reason: 'user_cannot_access_company',
                metadata: { companyId },
            });
            throw new I18nForbiddenException(I18N_KEYS.errors.authorization.companyDenied, 'No tienes acceso a esta compania.');
        }

        (request as CompanyRequest).companyId = companyId;
    }

    private invalidCompanyHeader(message: string, detail: string): BadRequestException {
        void this.audit.recordSecurity({
            action: 'invalid_company_header',
            result: 'denied',
            statusCode: 400,
            reason: detail,
        });
        return new BadRequestException({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message,
            errors: [{ field: 'X-Company-Id', message: detail }],
        });
    }
}
