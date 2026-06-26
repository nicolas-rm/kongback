import { Injectable } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { SessionResponse } from '@/modules/authentication/responses';

@Injectable()
export class ListSessionsUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService
    ) {}

    async execute(userId: string, currentRefreshToken?: string) {
        const currentSessionId = currentRefreshToken ? (await this.repository.findStoredRefreshToken(this.cryptoService.hashToken(currentRefreshToken)))?.sessionId : null;
        const sessions = await this.repository.listActiveSessions(userId);

        return sessions.map((session) =>
            SessionResponse.from({
                id: session.id,
                deviceName: session.deviceName,
                userAgent: session.userAgent,
                ipAddress: session.ipAddress,
                lastActivityAt: session.lastActivityAt,
                expiresAt: session.expiresAt,
                isCurrent: session.id === currentSessionId,
            })
        );
    }
}
