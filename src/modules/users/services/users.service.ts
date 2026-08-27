import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { CryptoService } from '@/crypto/crypto.service';
import { I18N_KEYS, I18nBadRequestException, I18nNotFoundException } from '@/i18n';
import { AppMailerService } from '@/mailer/mailer.service';
import { AuditService } from '@/modules/audit/audit.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { PermissionResponse } from '@/modules/access-control/responses';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { generateSecurePassword } from '@/utilities/password/generate-password';
import { SUB_COMPANY_SCOPE_KEY, type CompanyScope } from '@/utilities/tenancy/company-scope';
import { AssignUserAccessDto, ChangeUserPasswordDto, CreateUserDto, FindUsersDto, ReplaceUserAccessDto, UpdateUserDto } from '@/modules/users/dto';
import { UsersRepository } from '@/modules/users/repositories/users.repository';
import { UserAccessResponse, UserResponse } from '@/modules/users/responses';

type ResolvedAccessInput = {
    roleId: string;
    companyId: string | null;
    scopeKey: string | null;
    scopeId: string | null;
};

@Injectable()
export class UsersService {
    constructor(
        private readonly repository: UsersRepository,
        private readonly cryptoService: CryptoService,
        private readonly mailerService: AppMailerService,
        private readonly notifications: NotificationsService,
        private readonly audit: AuditService
    ) {}

    async create(dto: CreateUserDto, contextScope?: CompanyScope) {
        if (contextScope?.companyId && !dto.access) {
            throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Algunos datos relacionados no son validos.');
        }

        const access = dto.access ? this.resolveAccessInput(dto.access, contextScope) : undefined;
        if (access) await this.assertAccessTargetsActive([access]);
        if (access) await this.assertCardholderAccessIsolation(null, [access]);

        const password = dto.password ?? generateSecurePassword();
        const mustChangePassword = !dto.password;
        const user = await this.repository.create(
            {
                username: dto.username,
                email: dto.email,
                fullName: dto.fullName,
                passwordHash: await this.cryptoService.hashPassword(password),
                status: dto.status ?? 'active',
                mustChangePassword,
                preferredLanguage: dto.preferredLanguage ?? 'es',
            },
            access
        );
        if (mustChangePassword) {
            await this.mailerService.sendWelcomeCredentials(user.email, user.username, password, { recipientUserId: user.id, language: user.preferredLanguage });
        }

        void this.audit.recordAccess({ action: 'user_created', resourceType: 'User', resourceId: user.id, after: user, metadata: { hasInitialAccess: Boolean(access) } });
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
        if (!user) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'No encontramos el usuario solicitado.');
        void this.audit.recordAccess({ action: 'user_updated', resourceType: 'User', resourceId: user.id, metadata: dto, after: user });
        return UserResponse.from(user);
    }

    async remove(id: string) {
        const result = await this.repository.delete(id);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'No encontramos el usuario solicitado.');

        void this.audit.recordAccess({ action: 'user_deleted', resourceType: 'User', resourceId: id });
        return { id, deleted: true };
    }

    async assignAccess(userId: string, dto: AssignUserAccessDto, contextScope?: CompanyScope) {
        await this.assertUserActive(userId);
        const access = this.resolveAccessInput(dto, contextScope);
        await this.assertAccessTargetsActive([access]);
        await this.assertCardholderAccessIsolation(userId, [access]);

        await this.repository.assignAccess({
            userId,
            roleId: dto.roleId,
            companyId: access.companyId,
            scopeKey: access.scopeKey,
            scopeId: access.scopeId,
        });
        await this.notifyUser(userId, 'Acceso asignado', 'Se asigno un nuevo acceso a tu usuario.', 'Revisa tus permisos y alcance dentro del sistema.', NotificationType.info);
        void this.audit.recordAccess({ action: 'user_access_assigned', resourceType: 'User', resourceId: userId, metadata: access });
        return this.listAccess(userId, contextScope);
    }

    async replaceAccess(userId: string, dto: ReplaceUserAccessDto, contextScope?: CompanyScope) {
        await this.assertUserActive(userId);
        const accessInputs = dto.accesses.map((access) => this.resolveAccessInput(access, contextScope));
        await this.assertAccessTargetsActive(accessInputs);
        await this.assertCardholderAccessIsolation(userId, accessInputs, contextScope, true);

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
        await this.notifyUser(userId, 'Accesos actualizados', 'Tus accesos fueron actualizados.', 'Los cambios pueden afectar los modulos y acciones disponibles.', NotificationType.info);
        void this.audit.recordAccess({ action: 'user_access_replaced', resourceType: 'User', resourceId: userId, metadata: { accessCount: accessInputs.length, accesses: accessInputs } });
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
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.prisma.recordNotFound, 'No encontramos el registro solicitado.');

        await this.notifyUser(userId, 'Acceso removido', 'Se removio uno de tus accesos.', 'Los cambios pueden afectar los modulos y acciones disponibles.', NotificationType.warning);
        void this.audit.recordAccess({ action: 'user_access_removed', resourceType: 'UserAccess', resourceId: accessId, metadata: { userId } });
        return { id: accessId, deleted: true };
    }

    async listPermissions(userId: string, scope?: CompanyScope) {
        await this.assertUserActive(userId, scope);
        const permissions = await this.repository.findPermissionCodes(userId, scope);
        return permissions.map((entry) => PermissionResponse.from(entry.permission));
    }

    async changePassword(userId: string, dto: ChangeUserPasswordDto) {
        const result = await this.repository.updatePassword(userId, await this.cryptoService.hashPassword(dto.password), dto.mustChangePassword ?? false);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'No encontramos el usuario solicitado.');

        await this.notifyUser(
            userId,
            'Contrasena actualizada',
            'Un administrador actualizo tu contrasena.',
            dto.mustChangePassword ? 'Deberas cambiarla en tu proximo inicio de sesion.' : 'Si no reconoces este cambio, contacta a soporte.',
            NotificationType.warning
        );
        void this.audit.recordSecurity({ action: 'user_password_changed_by_admin', resourceType: 'User', resourceId: userId, metadata: { mustChangePassword: dto.mustChangePassword ?? false } });
        return { passwordChanged: true };
    }

    async unlinkTwoFactor(userId: string) {
        const result = await this.repository.resetTwoFactor(userId);
        if (!result) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'No encontramos el usuario solicitado.');

        await this.notifyUser(userId, 'Autenticacion de dos factores desvinculada', 'Un administrador desvinculo tu 2FA.', 'Vuelve a configurarlo si tu acceso lo requiere.', NotificationType.warning);
        void this.audit.recordSecurity({ action: 'user_2fa_unlinked_by_admin', resourceType: 'User', resourceId: userId });
        return { twoFactorUnlinked: true };
    }

    async resendCredentials(userId: string, triggeredByUserId?: string | null) {
        const user = await this.repository.findCredentialRecipient(userId);
        if (!user) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'No encontramos el usuario solicitado.');

        const mailContext = { recipientUserId: user.id, triggeredByUserId, language: user.preferredLanguage };
        const dispatchId = await this.mailerService.reserveWelcomeCredentialsOrThrow(user.email, mailContext);

        const password = generateSecurePassword();
        const result = await this.repository.updatePassword(user.id, await this.cryptoService.hashPassword(password), true);
        if (result.count === 0) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'No encontramos el usuario solicitado.');

        await this.mailerService.sendWelcomeCredentials(user.email, user.username, password, mailContext, dispatchId);

        await this.notifyUser(user.id, 'Credenciales reenviadas', 'Se reenviaron tus credenciales de acceso.', 'Revisa tu correo y cambia tu contrasena al iniciar sesion.', NotificationType.warning);
        void this.audit.recordSecurity({ action: 'user_credentials_resent', resourceType: 'User', resourceId: user.id, metadata: { triggeredByUserId } });
        return { credentialsSent: true };
    }

    private async notifyUser(userId: string, title: string, message: string, detail: string, type: NotificationType): Promise<void> {
        await this.notifications.createForUser(userId, { title, message, detail, type }).catch(() => null);
    }

    private async assertUserActive(userId: string, scope?: CompanyScope): Promise<void> {
        const user = await this.repository.findById(userId, scope);
        if (!user || user.status !== 'active') throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'No encontramos el usuario solicitado.');
    }

    private resolveAccessInput(access: AssignUserAccessDto, contextScope?: CompanyScope): ResolvedAccessInput {
        const companyId = this.resolveAccessCompanyId(access.companyId, contextScope?.companyId);
        const scopeKey = access.scopeKey ?? null;
        const scopeId = access.scopeId ?? null;

        if (contextScope?.subCompanyIds) {
            const resolvedScopeId = scopeId ?? (contextScope.subCompanyIds.length === 1 ? contextScope.subCompanyIds[0] : null);
            if ((scopeKey && scopeKey !== SUB_COMPANY_SCOPE_KEY) || !resolvedScopeId || !contextScope.subCompanyIds.includes(resolvedScopeId)) {
                throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Algunos datos relacionados no son validos.');
            }
            return { roleId: access.roleId, companyId, scopeKey: SUB_COMPANY_SCOPE_KEY, scopeId: resolvedScopeId };
        }

        if ((scopeKey || scopeId) && (scopeKey !== SUB_COMPANY_SCOPE_KEY || !scopeId || !companyId)) {
            throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Algunos datos relacionados no son validos.');
        }

        return { roleId: access.roleId, companyId, scopeKey, scopeId };
    }

    private resolveAccessCompanyId(companyId: string | null | undefined, contextCompanyId?: string): string | null {
        const accessCompanyId = companyId ?? null;
        if (!contextCompanyId) return accessCompanyId;
        if (accessCompanyId && accessCompanyId !== contextCompanyId) {
            throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Algunos datos relacionados no son validos.');
        }
        return contextCompanyId;
    }

    private async assertAccessTargetsActive(accesses: ResolvedAccessInput[]): Promise<void> {
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
            throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'Algunos datos relacionados no son validos.');
        }
    }

    private async assertCardholderAccessIsolation(userId: string | null, newAccesses: ResolvedAccessInput[], replacementScope?: CompanyScope, isReplacement = false): Promise<void> {
        const existingRoleIds = userId ? await this.repository.listAccessRoleIds(userId, replacementScope, isReplacement) : [];
        const roleIds = [...new Set([...existingRoleIds.map((access) => access.roleId), ...newAccesses.map((access) => access.roleId)])];
        if (roleIds.length === 0) return;

        const roleProfiles = await this.repository.findRolePermissionProfiles(roleIds);
        const profiles = roleProfiles.map((role) => {
            const permissionCodes = role.permissions.map((entry) => entry.permission.code);
            const hasCardholderPermissions = permissionCodes.some((code) => code.startsWith('cardholder.'));
            const hasAdministrativePermissions = permissionCodes.some((code) => !code.startsWith('cardholder.'));

            return {
                id: role.id,
                isCardholderRole: ['tarjetahabiente', 'cardholder'].includes(role.code) || hasCardholderPermissions,
                hasAdministrativePermissions,
            };
        });

        const hybridRole = profiles.some((role) => role.isCardholderRole && role.hasAdministrativePermissions);
        if (hybridRole) {
            throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'El perfil de tarjetahabiente no puede mezclarse con permisos administrativos.');
        }

        const hasCardholderRole = profiles.some((role) => role.isCardholderRole);
        const hasAdministrativeRole = profiles.some((role) => !role.isCardholderRole);
        if (hasCardholderRole && hasAdministrativeRole) {
            throw new I18nBadRequestException(I18N_KEYS.prisma.invalidRelation, 'No puedes combinar el perfil de tarjetahabiente con roles administrativos.');
        }
    }
}
