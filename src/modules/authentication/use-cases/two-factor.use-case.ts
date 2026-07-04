import { Injectable } from '@nestjs/common';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nBadRequestException, I18nUnauthorizedException } from '@/i18n';
import { TwoFactorCodeDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { buildTotpOtpAuthenticationUrl, generateRecoveryCodes, generateTotpSecret, verifyTotpCode } from '@/utilities/authentication/totp.util';

@Injectable()
export class TwoFactorUseCase {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService
    ) {}

    async status(userId: string) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user) throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.unauthorizedUser, 'Usuario no autorizado');

        return {
            enabled: user.twoFactorEnabled,
            pending: Boolean(user.twoFactorPendingSecret),
        };
    }

    async beginSetup(userId: string) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user) throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.unauthorizedUser, 'Usuario no autorizado');

        const secret = generateTotpSecret();
        await this.repository.setPendingTwoFactorSecret(user.id, this.cryptoService.encrypt(secret));

        return {
            secret,
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
        if (!user?.twoFactorPendingSecret) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.twoFactorPendingNotFound, 'No hay configuracion 2FA pendiente');
        if (this.isPendingSetupExpired(user.twoFactorPendingCreatedAt)) {
            await this.repository.clearPendingTwoFactorSecret(user.id);
            throw new I18nBadRequestException(I18N_KEYS.errors.authentication.twoFactorSetupExpired, 'La configuracion 2FA expiro. Inicia el proceso nuevamente');
        }

        const secret = this.cryptoService.decrypt(user.twoFactorPendingSecret);
        if (!secret || !this.verify(secret, dto.code)) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidTwoFactorCode, 'Codigo 2FA invalido');

        const recoveryCodes = generateRecoveryCodes(this.config.twoFactor.recoveryCodesCount);
        await this.repository.enableTwoFactor(user.id, this.cryptoService.encrypt(secret));
        await this.repository.replaceRecoveryCodes(
            user.id,
            recoveryCodes.map((code) => this.cryptoService.hashToken(code))
        );

        return { enabled: true, recoveryCodes };
    }

    async disable(userId: string, dto: TwoFactorCodeDto) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user?.twoFactorEnabled || !user.twoFactorSecret) return { enabled: false };

        const secret = this.cryptoService.decrypt(user.twoFactorSecret);
        if (!secret || !this.verify(secret, dto.code)) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidTwoFactorCode, 'Codigo 2FA invalido');

        await this.repository.disableTwoFactor(user.id);
        return { enabled: false };
    }

    async regenerateRecoveryCodes(userId: string, dto: TwoFactorCodeDto) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user?.twoFactorEnabled || !user.twoFactorSecret) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.twoFactorNotEnabled, '2FA no esta habilitado');

        const secret = this.cryptoService.decrypt(user.twoFactorSecret);
        if (!secret || !this.verify(secret, dto.code)) throw new I18nBadRequestException(I18N_KEYS.errors.authentication.invalidTwoFactorCode, 'Codigo 2FA invalido');

        const recoveryCodes = generateRecoveryCodes(this.config.twoFactor.recoveryCodesCount);
        await this.repository.replaceRecoveryCodes(
            user.id,
            recoveryCodes.map((code) => this.cryptoService.hashToken(code))
        );

        return { recoveryCodes };
    }

    async reset(userId: string) {
        await this.repository.resetTwoFactor(userId);
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
