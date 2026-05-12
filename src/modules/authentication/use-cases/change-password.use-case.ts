import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CryptoService } from '@/crypto/crypto.service';
import { ChangePasswordDto } from '@/modules/authentication/dto';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';

@Injectable()
export class ChangePasswordUseCase {
    constructor(
        private readonly repository: AuthenticationRepository,
        private readonly cryptoService: CryptoService
    ) {}

    async execute(userId: string, dto: ChangePasswordDto) {
        const user = await this.repository.findUserForPasswordChange(userId);
        if (!user) throw new UnauthorizedException('Usuario no autorizado');

        const validPassword = await this.cryptoService.verifyPassword(user.passwordHash, dto.currentPassword);
        if (!validPassword) throw new BadRequestException('Contrasena actual invalida');

        await this.repository.updatePassword(user.id, await this.cryptoService.hashPassword(dto.newPassword));
        await this.repository.revokeUserRefreshTokens(user.id);

        return { passwordChanged: true };
    }
}
