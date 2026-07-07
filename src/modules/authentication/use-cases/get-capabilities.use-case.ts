import { Injectable } from '@nestjs/common';
import { AccessControlService } from '@/modules/access-control/services/access-control.service';
import { CapabilitiesResponse } from '@/modules/authentication/responses';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

@Injectable()
export class GetCapabilitiesUseCase {
    constructor(private readonly accessControlService: AccessControlService) {}

    async execute(user: RequestUser, organizationId: string) {
        const permissions = await this.accessControlService.listUserPermissionCodes(user.id, organizationId);

        return CapabilitiesResponse.from({
            organizationId,
            isGlobalAdmin: user.isGlobalAdmin,
            permissions,
        });
    }
}
