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
            email: dto.email,
            fullName: dto.fullName,
            passwordHash: await this.cryptoService.hashPassword(dto.password),
            status: dto.status ?? 'active',
            preferredLanguage: dto.preferredLanguage ?? 'es',
        });
        return UserResponse.from(user);
    }

    async findAll(dto: FindUsersDto) {
        const where: Prisma.UserWhereInput = {
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
        if (!user) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'Usuario no encontrado');
        return UserResponse.from(user);
    }

    async remove(id: string) {
        const result = await this.repository.delete(id);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'Usuario no encontrado');

        return { id, deleted: true };
    }

    async assignAccess(userId: string, dto: AssignUserAccessDto) {
        await this.assertUserActive(userId);
        await this.assertAccessTargetsActive([{ roleId: dto.roleId, companyId: dto.companyId ?? null }]);

        await this.repository.assignAccess({
            userId,
            roleId: dto.roleId,
            companyId: dto.companyId ?? null,
            scopeKey: dto.scopeKey ?? null,
            scopeId: dto.scopeId ?? null,
        });
        return this.listAccess(userId);
    }

    async replaceAccess(userId: string, dto: ReplaceUserAccessDto) {
        await this.assertUserActive(userId);
        await this.assertAccessTargetsActive(dto.accesses.map((access) => ({ roleId: access.roleId, companyId: access.companyId ?? null })));

        const accesses = await this.repository.replaceAccess(
            userId,
            dto.accesses.map((access) => ({
                userId,
                roleId: access.roleId,
                companyId: access.companyId ?? null,
                scopeKey: access.scopeKey ?? null,
                scopeId: access.scopeId ?? null,
            }))
        );
        return accesses.map((access) => UserAccessResponse.from(access));
    }

    async listAccess(userId: string) {
        await this.assertUserActive(userId);
        const accesses = await this.repository.listAccess(userId);
        return accesses.map((access) => UserAccessResponse.from(access));
    }

    async removeAccess(userId: string, accessId: string) {
        await this.assertUserActive(userId);
        const result = await this.repository.removeAccess(userId, accessId);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'Registro no encontrado');

        return { id: accessId, deleted: true };
    }

    async listPermissions(userId: string) {
        await this.assertUserActive(userId);
        const permissions = await this.repository.findPermissionCodes(userId);
        return permissions.map((entry) => PermissionResponse.from(entry.permission));
    }

    async changePassword(userId: string, dto: ChangeUserPasswordDto) {
        const result = await this.repository.updatePassword(userId, await this.cryptoService.hashPassword(dto.password), dto.mustChangePassword ?? false);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'Usuario no encontrado');

        return { passwordChanged: true };
    }

    async unlinkTwoFactor(userId: string) {
        const result = await this.repository.resetTwoFactor(userId);
        if (!result) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'Usuario no encontrado');

        return { twoFactorUnlinked: true };
    }

    async resendCredentials(userId: string) {
        const user = await this.repository.findCredentialRecipient(userId);
        if (!user) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'Usuario no encontrado');

        const password = generateSecurePassword();
        const result = await this.repository.updatePassword(user.id, await this.cryptoService.hashPassword(password), true);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'Usuario no encontrado');

        await this.mailerService.sendWelcomeCredentials(user.email, user.username, password, { recipientUserId: user.id, language: user.preferredLanguage });

        return { credentialsSent: true };
    }

    private async assertUserActive(userId: string): Promise<void> {
        const user = await this.repository.findById(userId);
        if (!user || user.status !== 'active') throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'Usuario no encontrado');
    }

    private async assertAccessTargetsActive(accesses: Array<{ roleId: string; companyId?: string | null }>): Promise<void> {
        const roleIds = [...new Set(accesses.map((access) => access.roleId))];
        const companyIds = [...new Set(accesses.map((access) => access.companyId).filter((id): id is string => Boolean(id)))];

        const [activeRoles, activeCompanies] = await Promise.all([
            this.repository.countActiveRoles(roleIds),
            companyIds.length > 0 ? this.repository.countActiveCompanies(companyIds) : Promise.resolve(0),
        ]);
        if (activeRoles !== roleIds.length || activeCompanies !== companyIds.length) {
            throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
        }
    }
}
