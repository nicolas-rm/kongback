import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nBadRequestException, I18nNotFoundException } from '@/i18n';
import { AppMailerService } from '@/mailer/mailer.service';
import { PermissionResponse } from '@/modules/access-control/responses';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { generateSecurePassword } from '@/utilities/password/generate-password';
import { SUB_COMPANY_SCOPE_KEY, type CompanyScope } from '@/utilities/tenancy/company-scope';
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

    async findAll(dto: FindUsersDto, scope?: CompanyScope) {
        const where: Prisma.UserWhereInput = {
            status: dto.status,
            ...(scope?.companyId
                ? {
                      accesses: {
                          some: scope.subCompanyIds
                              ? { companyId: scope.companyId, scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: { in: scope.subCompanyIds }, company: { status: 'active' } }
                              : { companyId: scope.companyId, company: { status: 'active' } },
                      },
                  }
                : {}),
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

    async findOne(id: string, scope?: CompanyScope) {
        const user = await this.repository.findById(id, scope);
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

    async assignAccess(userId: string, dto: AssignUserAccessDto, contextScope?: CompanyScope) {
        await this.assertUserActive(userId);
        const access = this.resolveAccessInput(dto, contextScope);
        await this.assertAccessTargetsActive([access]);

        await this.repository.assignAccess({
            userId,
            roleId: dto.roleId,
            companyId: access.companyId,
            scopeKey: access.scopeKey,
            scopeId: access.scopeId,
        });
        return this.listAccess(userId, contextScope);
    }

    async replaceAccess(userId: string, dto: ReplaceUserAccessDto, contextScope?: CompanyScope) {
        await this.assertUserActive(userId);
        const accessInputs = dto.accesses.map((access) => this.resolveAccessInput(access, contextScope));
        await this.assertAccessTargetsActive(accessInputs);

        const accesses = await this.repository.replaceAccess(
            userId,
            accessInputs.map((access) => ({
                userId,
                roleId: access.roleId,
                companyId: access.companyId,
                scopeKey: access.scopeKey,
                scopeId: access.scopeId,
            })),
            contextScope
        );
        return accesses.map((access) => UserAccessResponse.from(access));
    }

    async listAccess(userId: string, scope?: CompanyScope) {
        await this.assertUserActive(userId, scope);
        const accesses = await this.repository.listAccess(userId, scope);
        return accesses.map((access) => UserAccessResponse.from(access));
    }

    async removeAccess(userId: string, accessId: string, scope?: CompanyScope) {
        await this.assertUserActive(userId, scope);
        const result = await this.repository.removeAccess(userId, accessId, scope);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'Registro no encontrado');

        return { id: accessId, deleted: true };
    }

    async listPermissions(userId: string, scope?: CompanyScope) {
        await this.assertUserActive(userId, scope);
        const permissions = await this.repository.findPermissionCodes(userId, scope);
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

    private async assertUserActive(userId: string, scope?: CompanyScope): Promise<void> {
        const user = await this.repository.findById(userId, scope);
        if (!user || user.status !== 'active') throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'Usuario no encontrado');
    }

    private resolveAccessInput(access: AssignUserAccessDto, contextScope?: CompanyScope): { roleId: string; companyId: string | null; scopeKey: string | null; scopeId: string | null } {
        const companyId = this.resolveAccessCompanyId(access.companyId, contextScope?.companyId);
        const scopeKey = access.scopeKey ?? null;
        const scopeId = access.scopeId ?? null;

        if (contextScope?.subCompanyIds) {
            const resolvedScopeId = scopeId ?? (contextScope.subCompanyIds.length === 1 ? contextScope.subCompanyIds[0] : null);
            if ((scopeKey && scopeKey !== SUB_COMPANY_SCOPE_KEY) || !resolvedScopeId || !contextScope.subCompanyIds.includes(resolvedScopeId)) {
                throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
            }
            return { roleId: access.roleId, companyId, scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: resolvedScopeId };
        }

        if ((scopeKey || scopeId) && (scopeKey !== SUB_COMPANY_SCOPE_KEY || !scopeId || !companyId)) {
            throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
        }

        return { roleId: access.roleId, companyId, scopeKey, scopeId };
    }

    private resolveAccessCompanyId(companyId: string | null | undefined, contextCompanyId?: string): string | null {
        const accessCompanyId = companyId ?? null;
        if (!contextCompanyId) return accessCompanyId;
        if (accessCompanyId && accessCompanyId !== contextCompanyId) {
            throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
        }
        return contextCompanyId;
    }

    private async assertAccessTargetsActive(accesses: Array<{ roleId: string; companyId?: string | null; scopeKey?: string | null; scopeId?: string | null }>): Promise<void> {
        const roleIds = [...new Set(accesses.map((access) => access.roleId))];
        const companyIds = [...new Set(accesses.map((access) => access.companyId).filter((id): id is string => Boolean(id)))];
        const subCompanyScopes = [
            ...new Map(
                accesses
                    .filter(
                        (access): access is { roleId: string; companyId: string; scopeKey: string; scopeId: string } =>
                            access.scopeKey === SUB_COMPANY_SCOPE_KEY && Boolean(access.companyId) && Boolean(access.scopeId)
                    )
                    .map((access) => [`${access.companyId}:${access.scopeId}`, { companyId: access.companyId, subCompanyId: access.scopeId }])
            ).values(),
        ];

        const [activeRoles, activeCompanies, activeSubCompanies] = await Promise.all([
            this.repository.countActiveRoles(roleIds),
            companyIds.length > 0 ? this.repository.countActiveCompanies(companyIds) : Promise.resolve(0),
            subCompanyScopes.length > 0 ? this.repository.countActiveSubCompanyScopes(subCompanyScopes) : Promise.resolve(0),
        ]);
        if (activeRoles !== roleIds.length || activeCompanies !== companyIds.length || activeSubCompanies !== subCompanyScopes.length) {
            throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Relacion invalida');
        }
    }
}
