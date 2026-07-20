import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { AppMailerService } from '@/mailer/mailer.service';
import { UpdateMyProfileDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { UpdateProfileResponse } from '@/modules/authentication/responses';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import type { SessionContext } from '@/modules/authentication/types/session-context.interface';
import { normalizeEmail } from '@/utilities/authentication/email.util';

@Injectable()
export class UpdateMyProfileUseCase {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService,
        private readonly mailerService: AppMailerService
    ) {}

    async execute(user: RequestUser, dto: UpdateMyProfileDto, sessionContext: SessionContext = {}) {
        const emailChanged = this.emailChanged(user.email, dto.email);
        const profile = await this.repository.updateProfile(user.id, {
            email: dto.email,
            fullName: dto.fullName,
            preferredLanguage: dto.preferredLanguage,
            ...(emailChanged ? { emailVerifiedAt: null, requiresEmailVerification: true } : {}),
        });
        if (emailChanged) await this.sendVerification(user.id, profile.email, sessionContext);

        return UpdateProfileResponse.from(profile);
    }

    private emailChanged(currentEmail: string, nextEmail?: string): boolean {
        if (!nextEmail) return false;
        return normalizeEmail(currentEmail) !== normalizeEmail(nextEmail);
    }

    private async sendVerification(userId: string, email: string, sessionContext: SessionContext): Promise<void> {
        const token = randomBytes(32).toString('hex');
        await this.repository.createEmailVerificationToken(userId, this.cryptoService.hashToken(token), new Date(Date.now() + this.config.session.emailVerificationTtlMinutes * 60 * 1000));
        await this.mailerService.sendEmailVerification(email, token, { recipientUserId: userId, ipAddress: sessionContext.ipAddress, language: sessionContext.language });
    }
}
