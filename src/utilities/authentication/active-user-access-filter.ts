import { Prisma } from '@prisma/client';

export function buildActiveUserAccessWhere(input: Prisma.UserAccessWhereInput, organizationId?: string, companyId?: string): Prisma.UserAccessWhereInput {
    return {
        AND: [
            input,
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
