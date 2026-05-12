import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import { PERMISSIONS_KEY } from '@/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '@/decorators/public.decorator';
import { ROLES_KEY } from '@/decorators/roles.decorator';
import { buildActiveUserAccessWhere } from '@/utilities/auth/active-user-access-filter';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
        if (isPublic) return true;

        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]) ?? [];

        if (requiredPermissions.length === 0 && requiredRoles.length === 0) return true;

        const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
        const user = request.user;
        if (!user?.id) throw new ForbiddenException('Usuario no autorizado');

        if (requiredRoles.length > 0) {
            const userAccesses = await this.prisma.userAccess.findMany({
                where: buildActiveUserAccessWhere({ userId: user.id }),
                select: { role: { select: { code: true, name: true } } },
            });

            const roles = new Set(userAccesses.flatMap((entry) => [entry.role.code, entry.role.name]));
            if (!requiredRoles.some((role) => roles.has(role))) {
                throw new ForbiddenException('Permisos insuficientes');
            }
        }

        if (requiredPermissions.length > 0) {
            const rolePermissions = await this.prisma.rolePermission.findMany({
                where: {
                    permission: { deletedAt: null },
                    role: {
                        deletedAt: null,
                        accesses: { some: buildActiveUserAccessWhere({ userId: user.id }) },
                    },
                },
                select: { permission: { select: { code: true } } },
            });

            const permissionCodes = new Set(rolePermissions.map((entry) => entry.permission.code));
            if (!requiredPermissions.every((permission) => permissionCodes.has(permission))) {
                throw new ForbiddenException('Permisos insuficientes');
            }
        }

        return true;
    }
}
