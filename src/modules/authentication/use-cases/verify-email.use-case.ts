import { BadRequestException, Injectable } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { VerifyEmailDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

@Injectable()
export class VerifyEmailUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService
    ) {}

    async execute(dto: VerifyEmailDto) {
        const token = await this.repository.findEmailVerificationToken(this.cryptoService.hashToken(dto.token));
        if (!token) throw new BadRequestException('Token de verificacion invalido o expirado');

        await this.repository.verifyEmail(token.id, token.userId);
        return { emailVerified: true };
    }
}
