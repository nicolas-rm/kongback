import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { TwoFactorCodeDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { buildTotpOtpAuthUrl, generateRecoveryCodes, generateTotpSecret, verifyTotpCode } from '@/utilities/authentication/totp.util';

@Injectable()
export class TwoFactorUseCase {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService
    ) {}

    async status(userId: string) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user) throw new UnauthorizedException('Usuario no autorizado');

        return {
            enabled: user.twoFactorEnabled,
            pending: Boolean(user.twoFactorPendingSecret),
        };
    }

    async beginSetup(userId: string) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user) throw new UnauthorizedException('Usuario no autorizado');

        const secret = generateTotpSecret();
        await this.repository.setPendingTwoFactorSecret(user.id, this.cryptoService.encrypt(secret));

        return {
            secret,
            otpauthUrl: buildTotpOtpAuthUrl({
                secret,
                accountName: user.email ?? user.username,
                issuer: this.config.twoFactor.issuer,
                digits: this.config.twoFactor.totpDigits,
                periodSeconds: this.config.twoFactor.totpPeriodSeconds,
            }),
        };
    }

    async enable(userId: string, dto: TwoFactorCodeDto) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user?.twoFactorPendingSecret) throw new BadRequestException('No hay configuracion 2FA pendiente');

        const secret = this.cryptoService.decrypt(user.twoFactorPendingSecret);
        if (!secret || !this.verify(secret, dto.code)) throw new BadRequestException('Codigo 2FA invalido');

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
        if (!secret || !this.verify(secret, dto.code)) throw new BadRequestException('Codigo 2FA invalido');

        await this.repository.disableTwoFactor(user.id);
        return { enabled: false };
    }

    async regenerateRecoveryCodes(userId: string, dto: TwoFactorCodeDto) {
        const user = await this.repository.findTwoFactorUser(userId);
        if (!user?.twoFactorEnabled || !user.twoFactorSecret) throw new BadRequestException('2FA no esta habilitado');

        const secret = this.cryptoService.decrypt(user.twoFactorSecret);
        if (!secret || !this.verify(secret, dto.code)) throw new BadRequestException('Codigo 2FA invalido');

        const recoveryCodes = generateRecoveryCodes(this.config.twoFactor.recoveryCodesCount);
        await this.repository.replaceRecoveryCodes(
            user.id,
            recoveryCodes.map((code) => this.cryptoService.hashToken(code))
        );

        return { recoveryCodes };
    }

    private verify(secret: string, code: string): boolean {
        return verifyTotpCode(secret, code, {
            digits: this.config.twoFactor.totpDigits,
            periodSeconds: this.config.twoFactor.totpPeriodSeconds,
            window: this.config.twoFactor.totpWindow,
        });
    }
}
