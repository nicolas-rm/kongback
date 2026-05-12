import { Injectable } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

@Injectable()
export class ListSessionsUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService
    ) {}

    async execute(userId: string, currentRefreshToken?: string) {
        const currentSessionId = currentRefreshToken ? (await this.repository.findStoredRefreshToken(this.cryptoService.hashToken(currentRefreshToken)))?.sessionId : null;
        const sessions = await this.repository.listActiveSessions(userId);

        return sessions.map((session) => ({
            ...session,
            isCurrent: session.id === currentSessionId,
        }));
    }
}
