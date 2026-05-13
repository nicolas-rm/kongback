import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nBadRequestException, I18nNotFoundException } from '@/i18n';
import { AppMailerService } from '@/mailer/mailer.service';
import { PermissionResponse } from '@/modules/access-control/responses';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { generateSecurePassword } from '@/utilities/password/generate-password';
import { AssignUserAccessDto, ChangeUserPasswordDto, CreateUserDto, FindUsersDto, ReplaceUserAccessDto, UpdateUserDto } from '@/modules/users/dto';
import { UsersRepository } from '@/modules/users/repositories/users.repository';
import { UserAccessResponse, UserResponse } from '@/modules/users/responses';

@Injectable()
export class UsersService {
    constructor(
        private readonly repository: UsersRepository,
        private readonly cryptoService: CryptoService,
        private readonly mailerService: AppMailerService
    ) {}

    async create(dto: CreateUserDto) {
        const user = await this.repository.create({
            username: dto.username,
            email: dto.email ?? null,
            fullName: dto.fullName,
            passwordHash: await this.cryptoService.hashPassword(dto.password),
            status: dto.status ?? 'active',
            preferredLanguage: dto.preferredLanguage ?? 'es',
        });
        return UserResponse.from(user);
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
        return paginate(
            data.map((user) => UserResponse.from(user)),
            total,
            dto
        );
    }

    async findOne(id: string) {
        const user = await this.repository.findById(id);
        return user ? UserResponse.from(user) : null;
    }

    async update(id: string, dto: UpdateUserDto) {
        const user = await this.repository.update(id, {
            username: dto.username,
            email: dto.email,
            fullName: dto.fullName,
            status: dto.status,
            mustChangePassword: dto.mustChangePassword,
            preferredLanguage: dto.preferredLanguage,
        });
        return UserResponse.from(user);
    }

    async remove(id: string) {
        await this.repository.softDelete(id);
        return { id, deleted: true };
    }

    async assignAccess(userId: string, dto: AssignUserAccessDto) {
        await this.repository.assignAccess({
            userId,
            roleId: dto.roleId,
            organizationId: dto.organizationId ?? null,
            scopeKey: dto.scopeKey ?? null,
            scopeId: dto.scopeId ?? null,
        });
        return this.listAccess(userId);
    }

    async replaceAccess(userId: string, dto: ReplaceUserAccessDto) {
        const accesses = await this.repository.replaceAccess(
            userId,
            dto.accesses.map((access) => ({
                userId,
                roleId: access.roleId,
                organizationId: access.organizationId ?? null,
                scopeKey: access.scopeKey ?? null,
                scopeId: access.scopeId ?? null,
            }))
        );
        return accesses.map((access) => UserAccessResponse.from(access));
    }

    async listAccess(userId: string) {
        const accesses = await this.repository.listAccess(userId);
        return accesses.map((access) => UserAccessResponse.from(access));
    }

    async removeAccess(userId: string, accessId: string) {
        await this.repository.removeAccess(userId, accessId);
        return { id: accessId, deleted: true };
    }

    async listPermissions(userId: string) {
        const permissions = await this.repository.findPermissionCodes(userId);
        return permissions.map((entry) => PermissionResponse.from(entry.permission));
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
        if (!user) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'Usuario no encontrado');
        if (!user.email) throw new I18nBadRequestException(I18N_KEYS.errors.users.missingEmail, 'El usuario no tiene correo configurado');

        const password = generateSecurePassword();
        await this.repository.updatePassword(user.id, await this.cryptoService.hashPassword(password), true);
        await this.mailerService.sendWelcomeCredentials(user.email, user.username, password, { recipientUserId: user.id, language: user.preferredLanguage });

        return { credentialsSent: true };
    }
}
