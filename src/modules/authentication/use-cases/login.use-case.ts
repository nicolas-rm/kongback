import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { LoginDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { AuthTokensService } from '@/modules/authentication/services/auth-tokens.service';
import type { SessionContext } from '@/modules/authentication/types/session-context.interface';

@Injectable()
export class LoginUseCase {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService,
        private readonly authTokensService: AuthTokensService
    ) {}

    async execute(dto: LoginDto, sessionContext: SessionContext = {}) {
        const user = await this.repository.findLoginUser(dto.username);
        if (!user || user.status !== 'active') throw new UnauthorizedException('Credenciales invalidas');

        if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new UnauthorizedException(`Cuenta bloqueada. Intenta de nuevo mas tarde`);
        }

        const validPassword = await this.cryptoService.verifyPassword(user.passwordHash, dto.password);
        if (!validPassword) {
            await this.registerFailedAttempt(user.id, user.failedLoginAttempts);
            throw new UnauthorizedException('Credenciales invalidas');
        }

        await this.repository.resetLoginState(user.id);

        return this.authTokensService.issueTokens(
            { id: user.id, username: user.username },
            {
                userAgent: sessionContext.userAgent,
                ipAddress: sessionContext.ipAddress,
                deviceName: sessionContext.deviceName,
            }
        );
    }

    private async registerFailedAttempt(userId: string, currentAttempts: number): Promise<void> {
        const failedLoginAttempts = currentAttempts + 1;
        const lockedUntil = failedLoginAttempts >= this.config.session.maxFailedAttempts ? new Date(Date.now() + this.config.session.lockDurationMinutes * 60 * 1000) : null;

        await this.repository.updateFailedLoginState(userId, failedLoginAttempts, lockedUntil);
    }
}
