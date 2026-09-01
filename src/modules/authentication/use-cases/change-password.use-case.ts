import { Injectable } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nBadRequestException, I18nUnauthorizedException } from '@/i18n';
import { AuditService } from '@/modules/audit/audit.service';
import { ChangePasswordDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

@Injectable()
export class ChangePasswordUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService,
        private readonly audit: AuditService
    ) {}

    async execute(userId: string, dto: ChangePasswordDto) {
        const user = await this.repository.findUserForPasswordChange(userId);
        if (!user) throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.unauthorizedUser, 'No pudimos validar tu usuario. Inicia sesion nuevamente.');

        const validPassword = await this.cryptoService.verifyPassword(user.passwordHash, dto.currentPassword);
        if (!validPassword) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidCurrentPassword, 'La contrasena actual no es correcta.');

        const result = await this.repository.updatePassword(user.id, await this.cryptoService.hashPassword(dto.newPassword));
        if (result.count === 0) throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.unauthorizedUser, 'No pudimos validar tu usuario. Inicia sesion nuevamente.');

        const revokedSessions = await this.repository.revokeUserSessions(user.id);
        const revokedTrustedDevices = await this.repository.revokeUserTrustedDevices(user.id);

        void this.audit.recordSecurity({
            action: 'password_changed',
            result: 'success',
            resourceType: 'User',
            resourceId: user.id,
            metadata: { userId: user.id, revokedSessions: revokedSessions.count, revokedTrustedDevices: revokedTrustedDevices.count },
        });

        return { passwordChanged: true };
    }
}
