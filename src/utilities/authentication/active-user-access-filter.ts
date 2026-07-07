import { Prisma } from '@prisma/client';

export function buildActiveUserAccessWhere(input: Prisma.UserAccessWhereInput, companyId?: string | null): Prisma.UserAccessWhereInput {
    const requiresGlobalAccess = companyId === null;

    return {
        AND: [
            input,
            requiresGlobalAccess ? { companyId: null } : {},
            companyId
                ? {
                      OR: [{ companyId: null }, { companyId }],
                  }
                : {},
            {
                OR: [{ companyId: null }, { company: { status: 'active' } }],
            },
        ],
    };
}
