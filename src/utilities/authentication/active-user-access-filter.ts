import { Prisma } from '@prisma/client';

export function buildActiveUserAccessWhere(input: Prisma.UserAccessWhereInput, organizationId?: string | null, companyId?: string | null): Prisma.UserAccessWhereInput {
    const requiresGlobalAccess = organizationId === null && companyId === null;

    return {
        AND: [
            input,
            requiresGlobalAccess ? { organizationId: null, companyId: null } : {},
            organizationId ? { OR: [{ organizationId: null }, { organizationId }] } : {},
            companyId
                ? {
                      OR: [
                          { organizationId: null, companyId: null },
                          { organizationId, companyId: null },
                          { organizationId, companyId },
                      ],
                  }
                : {},
            {
                OR: [{ organizationId: null }, { organization: { status: 'active' } }],
            },
            {
                OR: [{ companyId: null }, { company: { status: 'active' } }],
            },
        ],
    };
}
