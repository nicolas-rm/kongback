import { Injectable } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nBadRequestException } from '@/i18n';
import { VerifyEmailDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

@Injectable()
export class VerifyEmailUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService
    ) {}

    async execute(dto: VerifyEmailDto) {
        const token = await this.repository.findEmailVerificationToken(this.cryptoService.hashToken(dto.token));
        if (!token) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidVerificationToken, 'El enlace de verificacion no es valido o expiro.');

        const result = await this.repository.verifyEmail(token.id, token.userId);
        if (result.count === 0) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidVerificationToken, 'El enlace de verificacion no es valido o expiro.');

        return { emailVerified: true };
    }
}
