import { Injectable } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { LogoutDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

@Injectable()
export class LogoutUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService
    ) {}

    async execute(userId: string, dto: LogoutDto = {}) {
        if (!dto.refreshToken) {
            const result = await this.repository.revokeUserRefreshTokens(userId);
            return { revokedSessions: result.count };
        }

        const storedToken = await this.repository.findStoredRefreshToken(this.cryptoService.hashToken(dto.refreshToken));
        if (!storedToken || storedToken.userId !== userId) return { revokedSessions: 0 };

        await this.repository.revokeRefreshToken(storedToken.id);
        return { revokedSessions: 1 };
    }
}
