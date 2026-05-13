import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SKIP_MUST_CHANGE_PASSWORD_KEY } from '@/decorators/skip-must-change-password.decorator';
import { ERROR_CODES } from '@/errors/error-codes';
import { I18N_KEYS, I18nForbiddenException } from '@/i18n';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MUST_CHANGE_PASSWORD_KEY, [context.getHandler(), context.getClass()]);
        if (skip) return true;

        const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
        if (request.user?.mustChangePassword) {
            throw new I18nForbiddenException(I18N_KEYS.errors.authorization.mustChangePassword, 'Debes cambiar tu contrasena antes de continuar.', { code: ERROR_CODES.MUST_CHANGE_PASSWORD });
        }

        return true;
    }
}
