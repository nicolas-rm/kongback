import { Injectable } from '@nestjs/common';
import { AuditService } from '@/modules/audit/audit.service';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { RevokeTrustedDeviceResponse, TrustedDeviceResponse } from '@/modules/authentication/responses';

@Injectable()
export class TrustedDevicesUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly audit: AuditService
    ) {}

    async list(userId: string) {
        const trustedDevices = await this.repository.listActiveTrustedDevices(userId);
        return trustedDevices.map((trustedDevice) => TrustedDeviceResponse.from(trustedDevice));
    }

    async revoke(userId: string, trustedDeviceId: string) {
        const result = await this.repository.revokeTrustedDevice(userId, trustedDeviceId);
        const revoked = result.count === 1;

        void this.audit.recordSecurity({
            action: 'trusted_device_revoked',
            result: revoked ? 'success' : 'failure',
            actorUserId: userId,
            resourceType: 'TrustedDevice',
            resourceId: trustedDeviceId,
            metadata: { userId, trustedDeviceId },
        });

        return RevokeTrustedDeviceResponse.from({ id: trustedDeviceId, revoked });
    }
}
