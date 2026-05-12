import { Injectable } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

@Injectable()
export class RevokeSessionUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService
    ) {}

    async execute(userId: string, sessionId: string, currentRefreshToken?: string) {
        const currentSessionId = currentRefreshToken ? (await this.repository.findStoredRefreshToken(this.cryptoService.hashToken(currentRefreshToken)))?.sessionId : null;
        const result = await this.repository.revokeSession(userId, sessionId);

        return {
            id: sessionId,
            revoked: result.count > 0,
            revokedCurrent: sessionId === currentSessionId,
        };
    }
}
