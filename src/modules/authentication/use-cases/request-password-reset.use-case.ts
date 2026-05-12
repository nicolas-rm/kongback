import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppConfigService } from '@/configurations/app-config.service';
import { CryptoService } from '@/crypto/crypto.service';
import { AppMailerService } from '@/mailer/mailer.service';
import { RequestPasswordResetDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import type { SessionContext } from '@/modules/authentication/types/session-context.interface';

@Injectable()
export class RequestPasswordResetUseCase {
    constructor(
        private readonly config: AppConfigService,
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService,
        private readonly mailerService: AppMailerService
    ) {}

    async execute(dto: RequestPasswordResetDto, sessionContext: SessionContext = {}) {
        const user = await this.repository.findUserByEmail(dto.email);
        if (!user?.email) return { accepted: true };

        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + this.config.session.passwordResetTtlMinutes * 60 * 1000);
        await this.repository.createPasswordResetToken(user.id, this.cryptoService.hashToken(token), expiresAt);
        await this.mailerService.sendPasswordReset(user.email, token, expiresAt, { recipientUserId: user.id, ipAddress: sessionContext.ipAddress });

        return { accepted: true };
    }
}
