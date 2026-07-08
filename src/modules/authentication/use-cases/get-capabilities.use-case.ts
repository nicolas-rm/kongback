import { Injectable } from '@nestjs/common';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';
import { CapabilitiesResponse } from '@/modules/authentication/responses';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

const SYSTEM_ACCESS_PERMISSION_CODES = new Set([
    'companies.create',
    'companies.update',
    'companies.delete',
    'fuels.create',
    'fuels.update',
    'fuels.delete',
    'notifications.create',
    'users.create',
    'users.read-list',
    'users.read-one',
    'users.update',
    'users.delete',
    'users.access.assign',
    'users.access.read',
    'users.permissions.read',
    'users.password.update',
    'users.2fa.unlink',
    'users.credentials.resend',
    'roles.create',
    'roles.read-list',
    'roles.read-one',
    'roles.update',
    'roles.delete',
    'roles.permissions.assign',
    'roles.permissions.read',
    'permissions.create',
    'permissions.read-list',
    'permissions.read-one',
    'permissions.update',
    'permissions.delete',
]);

@Injectable()
export class GetCapabilitiesUseCase {
    constructor(private readonly accessControlService: AccessControlService) {}

    async execute(user: RequestUser, companyId?: string) {
        const [contextPermissions, systemPermissions] = await Promise.all([
            this.accessControlService.listUserPermissionCodes(user.id, companyId),
            this.accessControlService.listUserPermissionCodes(user.id, null),
        ]);
        const systemPermissionSet = new Set(systemPermissions);
        const permissions = contextPermissions.filter((code) => !SYSTEM_ACCESS_PERMISSION_CODES.has(code) || systemPermissionSet.has(code));

        return CapabilitiesResponse.from({
            companyId,
            isGlobalAdmin: user.isGlobalAdmin,
            permissions,
        });
    }
}
