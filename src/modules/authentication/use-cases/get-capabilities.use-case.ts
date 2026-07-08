import { Injectable } from '@nestjs/common';
import { SYSTEM_ACCESS_PERMISSION_CODES } from '../../../../prisma/permission-catalog';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';
import { CapabilitiesResponse } from '@/modules/authentication/responses';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

const SYSTEM_ACCESS_PERMISSION_CODE_SET = new Set<string>(SYSTEM_ACCESS_PERMISSION_CODES);

@Injectable()
export class GetCapabilitiesUseCase {
    constructor(private readonly accessControlService: AccessControlService) {}

    async execute(user: RequestUser, companyId?: string) {
        const [contextPermissions, systemPermissions] = await Promise.all([
            this.accessControlService.listUserPermissionCodes(user.id, companyId),
            this.accessControlService.listUserPermissionCodes(user.id, null),
        ]);
        const systemPermissionSet = new Set(systemPermissions);
        const permissions = contextPermissions.filter((code) => !SYSTEM_ACCESS_PERMISSION_CODE_SET.has(code) || systemPermissionSet.has(code));

        return CapabilitiesResponse.from({
            companyId,
            isGlobalAdmin: user.isGlobalAdmin,
            permissions,
        });
    }
}
