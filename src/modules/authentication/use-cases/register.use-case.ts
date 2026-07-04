import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { AppMailerService } from '@/mailer/mailer.service';
import { RegisterDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import type { SessionContext } from '@/modules/authentication/types/session-context.interface';

@Injectable()
export class RegisterUseCase {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService,
        private readonly mailerService: AppMailerService
    ) {}

    async execute(dto: RegisterDto, sessionContext: SessionContext = {}) {
        const user = await this.repository.createUser({
            username: dto.username,
            email: dto.email,
            fullName: dto.fullName,
            passwordHash: await this.cryptoService.hashPassword(dto.password),
            requiresEmailVerification: true,
        });

        await this.sendVerification(user.id, user.email, sessionContext);
        return { id: user.id, registered: true, emailVerificationRequired: true };
    }

    async resendVerification(email: string, sessionContext: SessionContext = {}) {
        const user = await this.repository.findUserByEmail(email);
        if (user?.email) await this.sendVerification(user.id, user.email, sessionContext);
        return { accepted: true };
    }

    private async sendVerification(userId: string, email: string, sessionContext: SessionContext): Promise<void> {
        const token = randomBytes(32).toString('hex');
        await this.repository.createEmailVerificationToken(userId, this.cryptoService.hashToken(token), new Date(Date.now() + this.config.session.emailVerificationTtlMinutes * 60 * 1000));
        await this.mailerService.sendEmailVerification(email, token, { recipientUserId: userId, ipAddress: sessionContext.ipAddress, language: sessionContext.language });
    }
}
