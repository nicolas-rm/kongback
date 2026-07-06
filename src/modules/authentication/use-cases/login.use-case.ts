import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nUnauthorizedException } from '@/i18n';
import { LoginDto, VerifyTwoFactorLoginDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { AuthenticationTokensService } from '@/modules/authentication/services/authentication-tokens.service';
import type { SessionContext } from '@/modules/authentication/types/session-context.interface';
import { normalizeRecoveryCode, verifyTotpCode } from '@/utilities/authentication/totp.util';

@Injectable()
export class LoginUseCase {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService,
        private readonly authenticationTokensService: AuthenticationTokensService
    ) {}

    async execute(dto: LoginDto, sessionContext: SessionContext = {}) {
        const user = await this.repository.findLoginUser(dto.username);
        if (!user || user.status !== 'active') throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.invalidCredentials, 'Credenciales invalidas');

        if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.accountLocked, 'Cuenta bloqueada. Intenta de nuevo mas tarde');
        }

        const validPassword = await this.cryptoService.verifyPassword(user.passwordHash, dto.password);
        if (!validPassword) {
            await this.registerFailedAttempt(user.id, user.failedLoginAttempts);
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.invalidCredentials, 'Credenciales invalidas');
        }

        await this.repository.resetLoginState(user.id);

        if (user.requiresEmailVerification && !user.emailVerifiedAt) {
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.emailVerificationRequired, 'Debes verificar tu correo antes de iniciar sesion');
        }

        if (user.twoFactorEnabled) {
            const challengeToken = randomBytes(32).toString('hex');
            await this.repository.createTwoFactorLoginChallenge({
                userId: user.id,
                challengeHash: this.cryptoService.hashToken(challengeToken),
                expiresAt: new Date(Date.now() + this.config.twoFactor.loginChallengeTtlMinutes * 60 * 1000),
                userAgent: sessionContext.userAgent,
                ipAddress: sessionContext.ipAddress,
            });

            return { requiresTwoFactor: true, challengeToken };
        }

        return this.authenticationTokensService.issueTokens(
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

    async verifyTwoFactorLogin(dto: VerifyTwoFactorLoginDto, sessionContext: SessionContext = {}) {
        const challenge = await this.repository.findTwoFactorLoginChallenge(this.cryptoService.hashToken(dto.challengeToken));
        if (!challenge || !challenge.user.twoFactorEnabled || !challenge.user.twoFactorSecret || challenge.user.status !== 'active') {
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.invalidTwoFactorChallenge, 'Desafio 2FA invalido');
        }

        if (challenge.attemptCount >= this.config.twoFactor.loginChallengeMaxAttempts) {
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.invalidTwoFactorChallenge, 'Desafio 2FA invalido');
        }

        const validCode = await this.verifySecondFactor(challenge.user.id, challenge.user.twoFactorSecret, dto);

        if (!validCode) {
            await this.repository.incrementTwoFactorChallengeAttempt(challenge.id);
            throw new I18nUnauthorizedException(I18N_KEYS.errors.authentication.invalidTwoFactorCode, 'Codigo 2FA invalido');
        }

        await this.repository.consumeTwoFactorChallenge(challenge.id);
        return this.authenticationTokensService.issueTokens(
            { id: challenge.user.id, username: challenge.user.username },
            {
                userAgent: sessionContext.userAgent,
                ipAddress: sessionContext.ipAddress,
                deviceName: sessionContext.deviceName,
            }
        );
    }

    private async verifySecondFactor(userId: string, encryptedSecret: string, dto: VerifyTwoFactorLoginDto): Promise<boolean> {
        if (dto.recoveryCode) return this.consumeRecoveryCode(userId, dto.recoveryCode);
        if (!dto.code) return false;

        const secret = this.cryptoService.decrypt(encryptedSecret);
        return (
            Boolean(secret) &&
            verifyTotpCode(secret!, dto.code, {
                digits: this.config.twoFactor.totpDigits,
                periodSeconds: this.config.twoFactor.totpPeriodSeconds,
                window: this.config.twoFactor.totpWindow,
            })
        );
    }

    private async consumeRecoveryCode(userId: string, recoveryCode: string): Promise<boolean> {
        const normalizedCode = normalizeRecoveryCode(recoveryCode);
        if (!normalizedCode) return false;

        const result = await this.repository.consumeTwoFactorRecoveryCode(userId, this.recoveryCodeHashCandidates(normalizedCode));
        return result.count === 1;
    }

    private recoveryCodeHashCandidates(normalizedCode: string): string[] {
        const formattedCode = normalizedCode.length > 4 ? `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}` : normalizedCode;
        return [...new Set([normalizedCode, formattedCode].map((code) => this.cryptoService.hashToken(code)))];
    }
}
