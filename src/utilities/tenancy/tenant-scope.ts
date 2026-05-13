import { I18N_KEYS, I18nForbiddenException } from '@/i18n';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

export function buildOrganizationScope(user: RequestUser) {
    if (user.isGlobalAdmin) return {};
    return { organizationId: { in: user.organizationIds ?? [] } };
}

export function assertOrganizationAccess(user: RequestUser, organizationId: string): void {
    if (user.isGlobalAdmin) return;
    if (!(user.organizationIds ?? []).includes(organizationId)) {
        throw new I18nForbiddenException(I18N_KEYS.errors.authorization.organizationDenied, 'Acceso denegado a esta organizacion');
    }
}
