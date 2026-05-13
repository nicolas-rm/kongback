import { Injectable } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nBadRequestException } from '@/i18n';
import { ResetPasswordDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

@Injectable()
export class ResetPasswordUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService
    ) {}

    async execute(dto: ResetPasswordDto) {
        const storedToken = await this.repository.findPasswordResetToken(this.cryptoService.hashToken(dto.token));
        if (!storedToken) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidResetToken, 'Token invalido o expirado');

        await this.repository.updatePassword(storedToken.userId, await this.cryptoService.hashPassword(dto.password));
        await this.repository.markPasswordResetTokenUsed(storedToken.id);
        await this.repository.revokeUserSessions(storedToken.userId);

        return { passwordReset: true };
    }
}
