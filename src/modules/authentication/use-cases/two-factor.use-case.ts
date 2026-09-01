import { Injectable } from '@nestjs/common';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nBadRequestException, I18nUnauthorizedException } from '@/i18n';
import { AuditService } from '@/modules/audit/audit.service';
import { TwoFactorCodeDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { buildTotpOtpAuthenticationUrl, generateRecoveryCodes, generateTotpSecret, normalizeRecoveryCode, verifyTotpCode } from '@/utilities/authentication/totp.util';

@Injectable()
export class TwoFactorUseCase {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService,
        private readonly audit: AuditService
    ) {}

    async status(userId: string) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user) throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.unauthorizedUser, 'No pudimos validar tu usuario. Inicia sesion nuevamente.');

        return {
            enabled: user.twoFactorEnabled,
            pending: Boolean(user.twoFactorPendingSecret),
        };
    }

    async beginSetup(userId: string) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user) throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.unauthorizedUser, 'No pudimos validar tu usuario. Inicia sesion nuevamente.');

        const secret = generateTotpSecret();
        const createdAt = new Date();
        const expiresInSeconds = this.config.twoFactor.setupTtlMinutes * 60;
        const expiresAt = new Date(createdAt.getTime() + expiresInSeconds * 1000);
        await this.repository.setPendingTwoFactorSecret(user.id, this.cryptoService.encrypt(secret), createdAt);
        void this.audit.recordSecurity({
            action: 'two_factor_setup_started',
            result: 'success',
            resourceType: 'User',
            resourceId: user.id,
            metadata: { userId: user.id, expiresAt },
        });

        return {
            secret,
            expiresInSeconds,
            expiresAt,
            otpAuthenticationUrl: buildTotpOtpAuthenticationUrl({
                secret,
                accountName: user.email,
                issuer: this.config.twoFactor.issuer,
                digits: this.config.twoFactor.totpDigits,
                periodSeconds: this.config.twoFactor.totpPeriodSeconds,
            }),
        };
    }

    async enable(userId: string, dto: TwoFactorCodeDto) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user?.twoFactorPendingSecret) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.twoFactorPendingNotFound, 'Primero inicia la configuracion de 2FA.');
        if (this.isPendingSetupExpired(user.twoFactorPendingCreatedAt)) {
            await this.repository.clearPendingTwoFactorSecret(user.id);
            throw new I18nBadRequestException(I18N_KEYS.errors.authentication.twoFactorSetupExpired, 'La configuracion de 2FA expiro. Inicia el proceso nuevamente.');
        }

        const secret = this.cryptoService.decrypt(user.twoFactorPendingSecret);
        if (!secret || !this.verify(secret, dto.code)) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidTwoFactorCode, 'El codigo de verificacion no es correcto.');

        const recoveryCodes = generateRecoveryCodes(this.config.twoFactor.recoveryCodesCount);
        await this.repository.enableTwoFactor(user.id, this.cryptoService.encrypt(secret));
        await this.repository.replaceRecoveryCodes(
            user.id,
            recoveryCodes.map((code) => this.cryptoService.hashToken(normalizeRecoveryCode(code)))
        );
        void this.audit.recordSecurity({
            action: 'two_factor_enabled',
            result: 'success',
            resourceType: 'User',
            resourceId: user.id,
            metadata: { userId: user.id, recoveryCodesCount: recoveryCodes.length },
        });

        return { enabled: true, recoveryCodes };
    }

    async disable(userId: string, dto: TwoFactorCodeDto) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user?.twoFactorEnabled || !user.twoFactorSecret) return { enabled: false };

        const secret = this.cryptoService.decrypt(user.twoFactorSecret);
        if (!secret || !this.verify(secret, dto.code)) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidTwoFactorCode, 'El codigo de verificacion no es correcto.');

        await this.repository.disableTwoFactor(user.id);
        void this.audit.recordSecurity({
            action: 'two_factor_disabled',
            result: 'success',
            resourceType: 'User',
            resourceId: user.id,
            metadata: { userId: user.id },
        });
        return { enabled: false };
    }

    async regenerateRecoveryCodes(userId: string, dto: TwoFactorCodeDto) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user?.twoFactorEnabled || !user.twoFactorSecret) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.twoFactorNotEnabled, 'La verificacion en dos pasos no esta activada.');

        const secret = this.cryptoService.decrypt(user.twoFactorSecret);
        if (!secret || !this.verify(secret, dto.code)) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidTwoFactorCode, 'El codigo de verificacion no es correcto.');

        const recoveryCodes = generateRecoveryCodes(this.config.twoFactor.recoveryCodesCount);
        await this.repository.replaceRecoveryCodes(
            user.id,
            recoveryCodes.map((code) => this.cryptoService.hashToken(normalizeRecoveryCode(code)))
        );
        void this.audit.recordSecurity({
            action: 'two_factor_recovery_codes_regenerated',
            result: 'success',
            resourceType: 'User',
            resourceId: user.id,
            metadata: { userId: user.id, recoveryCodesCount: recoveryCodes.length },
        });

        return { recoveryCodes };
    }

    async reset(userId: string) {
        await this.repository.resetTwoFactor(userId);
        void this.audit.recordSecurity({
            action: 'two_factor_reset',
            result: 'success',
            resourceType: 'User',
            resourceId: userId,
            metadata: { userId },
        });
        return { twoFactorReset: true };
    }

    private verify(secret: string, code: string): boolean {
        return verifyTotpCode(secret, code, {
            digits: this.config.twoFactor.totpDigits,
            periodSeconds: this.config.twoFactor.totpPeriodSeconds,
            window: this.config.twoFactor.totpWindow,
        });
    }

    private isPendingSetupExpired(createdAt: Date | null): boolean {
        if (!createdAt) return true;
        return Date.now() - createdAt.getTime() > this.config.twoFactor.setupTtlMinutes * 60 * 1000;
    }
}
