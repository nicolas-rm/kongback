import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '@/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '@/decorators/public.decorator';
import { ROLES_KEY } from '@/decorators/roles.decorator';
import { I18N_KEYS, I18nForbiddenException } from '@/i18n';
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

        if (requiredPermissions.length === 0 && requiredRoles.length === 0) return true;

        const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
        const user = request.user;
        if (!user?.id) throw new I18nForbiddenException(I18N_KEYS.errors.authorization.unauthorized, 'Usuario no autorizado');

        if (requiredRoles.length > 0) {
            const hasRole = await this.accessControl.userHasAnyRole(user.id, requiredRoles);
            if (!hasRole) {
                throw new I18nForbiddenException(I18N_KEYS.errors.authorization.insufficientPermissions, 'Permisos insuficientes');
            }
        }

        if (requiredPermissions.length > 0) {
            const hasPermissions = await this.accessControl.userHasAllPermissions(user.id, requiredPermissions);
            if (!hasPermissions) {
                throw new I18nForbiddenException(I18N_KEYS.errors.authorization.insufficientPermissions, 'Permisos insuficientes');
            }
        }

        return true;
    }
}
