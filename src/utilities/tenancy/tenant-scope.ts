import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

export function buildOrganizationScope(user: RequestUser) {
    if (user.isGlobalAdmin) return {};
    return { organizationId: { in: user.organizationIds ?? [] } };
}

export function assertOrganizationAccess(user: RequestUser, organizationId: string): void {
    if (user.isGlobalAdmin) return;
    if (!(user.organizationIds ?? []).includes(organizationId)) {
        throw new ForbiddenException('Acceso denegado a esta organizacion');
    }
}
