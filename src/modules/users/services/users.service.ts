import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CryptoService } from '@/crypto/crypto.service';
import { AppMailerService } from '@/mailer/mailer.service';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { generateSecurePassword } from '@/utilities/password/generate-password';
import { AssignUserAccessDto, ChangeUserPasswordDto, CreateUserDto, FindUsersDto, ReplaceUserAccessDto, UpdateUserDto } from '@/modules/users/dto';
import { UsersRepository } from '@/modules/users/repositories/users.repository';

@Injectable()
export class UsersService {
    constructor(
        private readonly repository: UsersRepository,
        private readonly cryptoService: CryptoService,
        private readonly mailerService: AppMailerService
    ) {}

    async create(dto: CreateUserDto) {
        return this.repository.create({
            username: dto.username,
            email: dto.email ?? null,
            fullName: dto.fullName,
            passwordHash: await this.cryptoService.hashPassword(dto.password),
            status: dto.status ?? 'active',
        });
    }

    async findAll(dto: FindUsersDto) {
        const where: Prisma.UserWhereInput = {
            deletedAt: null,
            status: dto.status,
            ...(dto.search
                ? {
                      OR: [
                          { username: { contains: dto.search, mode: 'insensitive' } },
                          { email: { contains: dto.search, mode: 'insensitive' } },
                          { fullName: { contains: dto.search, mode: 'insensitive' } },
                      ],
                  }
                : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(data, total, dto);
    }

    findOne(id: string) {
        return this.repository.findById(id);
    }

    update(id: string, dto: UpdateUserDto) {
        return this.repository.update(id, {
            username: dto.username,
            email: dto.email,
            fullName: dto.fullName,
            status: dto.status,
            mustChangePassword: dto.mustChangePassword,
        });
    }

    async remove(id: string) {
        await this.repository.softDelete(id);
        return { id, deleted: true };
    }

    assignAccess(userId: string, dto: AssignUserAccessDto) {
        return this.repository.assignAccess({
            userId,
            roleId: dto.roleId,
            organizationId: dto.organizationId ?? null,
            scopeKey: dto.scopeKey ?? null,
            scopeId: dto.scopeId ?? null,
        });
    }

    replaceAccess(userId: string, dto: ReplaceUserAccessDto) {
        return this.repository.replaceAccess(
            userId,
            dto.accesses.map((access) => ({
                userId,
                roleId: access.roleId,
                organizationId: access.organizationId ?? null,
                scopeKey: access.scopeKey ?? null,
                scopeId: access.scopeId ?? null,
            }))
        );
    }

    listAccess(userId: string) {
        return this.repository.listAccess(userId);
    }

    async removeAccess(userId: string, accessId: string) {
        await this.repository.removeAccess(userId, accessId);
        return { id: accessId, deleted: true };
    }

    async listPermissions(userId: string) {
        const permissions = await this.repository.findPermissionCodes(userId);
        return permissions.map((entry) => entry.permission);
    }

    async changePassword(userId: string, dto: ChangeUserPasswordDto) {
        await this.repository.updatePassword(userId, await this.cryptoService.hashPassword(dto.password), dto.mustChangePassword ?? false);
        return { passwordChanged: true };
    }

    async unlinkTwoFactor(userId: string) {
        await this.repository.resetTwoFactor(userId);
        return { twoFactorUnlinked: true };
    }

    async resendCredentials(userId: string) {
        const user = await this.repository.findCredentialRecipient(userId);
        if (!user) throw new NotFoundException('Usuario no encontrado');
        if (!user.email) throw new BadRequestException('El usuario no tiene correo configurado');

        const password = generateSecurePassword();
        await this.repository.updatePassword(user.id, await this.cryptoService.hashPassword(password), true);
        await this.mailerService.sendWelcomeCredentials(user.email, user.username, password, { recipientUserId: user.id });

        return { credentialsSent: true };
    }
}
