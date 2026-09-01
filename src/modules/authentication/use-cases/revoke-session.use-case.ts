import { Injectable } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { AuditService } from '@/modules/audit/audit.service';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { RevokeSessionResponse } from '@/modules/authentication/responses';

@Injectable()
export class RevokeSessionUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService,
        private readonly audit: AuditService
    ) {}

    async execute(userId: string, sessionId: string, currentRefreshToken?: string) {
        const currentSessionId = currentRefreshToken ? (await this.repository.findStoredRefreshToken(this.cryptoService.hashToken(currentRefreshToken)))?.sessionId : null;
        const result = await this.repository.revokeSession(userId, sessionId);
        void this.audit.recordSecurity({
            action: 'session_revoked',
            result: result.count > 0 ? 'success' : 'failure',
            resourceType: 'Session',
            resourceId: sessionId,
            metadata: { userId, sessionId, revokedCurrent: sessionId === currentSessionId },
        });

        return RevokeSessionResponse.from({
            id: sessionId,
            revoked: result.count > 0,
            revokedCurrent: sessionId === currentSessionId,
        });
    }
}
