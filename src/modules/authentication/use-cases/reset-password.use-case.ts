import { Injectable } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nBadRequestException } from '@/i18n';
import { AuditService } from '@/modules/audit/audit.service';
import { ResetPasswordDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

@Injectable()
export class ResetPasswordUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService,
        private readonly audit: AuditService
    ) {}

    async execute(dto: ResetPasswordDto) {
        const storedToken = await this.repository.findPasswordResetToken(this.cryptoService.hashToken(dto.token));
        if (!storedToken) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidResetToken, 'El enlace para restablecer la contrasena no es valido o expiro.');

        const result = await this.repository.updatePassword(storedToken.userId, await this.cryptoService.hashPassword(dto.password));
        if (result.count === 0) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidResetToken, 'El enlace para restablecer la contrasena no es valido o expiro.');

        await this.repository.markPasswordResetTokenUsed(storedToken.id);
        const revokedSessions = await this.repository.revokeUserSessions(storedToken.userId);
        const revokedTrustedDevices = await this.repository.revokeUserTrustedDevices(storedToken.userId);

        void this.audit.recordSecurity({
            action: 'password_reset_completed',
            result: 'success',
            resourceType: 'User',
            resourceId: storedToken.userId,
            metadata: { userId: storedToken.userId, revokedSessions: revokedSessions.count, revokedTrustedDevices: revokedTrustedDevices.count },
        });

        return { passwordReset: true };
    }
}
