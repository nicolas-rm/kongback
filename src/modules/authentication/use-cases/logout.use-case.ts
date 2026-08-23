import { Injectable } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { AuditService } from '@/modules/audit/audit.service';
import { LogoutDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

@Injectable()
export class LogoutUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService,
        private readonly audit: AuditService
    ) {}

    async execute(userId: string, dto: LogoutDto = {}) {
        if (!dto.refreshToken) {
            const result = await this.repository.revokeUserSessions(userId);
            void this.audit.recordSecurity({ action: 'logout_all', result: 'success', metadata: { userId, revokedSessions: result.count } });
            return { revokedSessions: result.count };
        }

        const storedToken = await this.repository.findStoredRefreshToken(this.cryptoService.hashToken(dto.refreshToken));
        if (!storedToken || storedToken.userId !== userId) return { revokedSessions: 0 };

        await this.repository.revokeSession(userId, storedToken.sessionId);
        void this.audit.recordSecurity({ action: 'logout', result: 'success', metadata: { userId, sessionId: storedToken.sessionId } });
        return { revokedSessions: 1 };
    }
}
