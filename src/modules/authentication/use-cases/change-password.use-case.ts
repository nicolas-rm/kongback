import { Injectable } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nBadRequestException, I18nUnauthorizedException } from '@/i18n';
import { ChangePasswordDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

@Injectable()
export class ChangePasswordUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService
    ) {}

    async execute(userId: string, dto: ChangePasswordDto) {
        const user = await this.repository.findUserForPasswordChange(userId);
        if (!user) throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.unauthorizedUser, 'Usuario no autorizado');

        const validPassword = await this.cryptoService.verifyPassword(user.passwordHash, dto.currentPassword);
        if (!validPassword) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidCurrentPassword, 'Contrasena actual invalida');

        await this.repository.updatePassword(user.id, await this.cryptoService.hashPassword(dto.newPassword));
        await this.repository.revokeUserSessions(user.id);

        return { passwordChanged: true };
    }
}
