import { Injectable } from '@nestjs/common';
import { AccessControlRepository } from '@/modules/access-control/repositories/access-control.repository';

@Injectable()
export class AccessControlService {
    constructor(private readonly repository: AccessControlRepository) {}

    async userHasAnyRole(userId: string, requiredRoles: string[]): Promise<boolean> {
        if (requiredRoles.length === 0) return true;

        const roles = new Set(await this.repository.findUserRoleLabels(userId));
        return requiredRoles.some((role) => roles.has(role));
    }

    async userHasAllPermissions(userId: string, requiredPermissions: string[]): Promise<boolean> {
        if (requiredPermissions.length === 0) return true;

        const permissions = new Set(await this.repository.findUserPermissionCodes(userId));
        return requiredPermissions.every((permission) => permissions.has(permission));
    }
}
