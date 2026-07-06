import { Prisma } from '@prisma/client';

export function buildActiveUserAccessWhere(input: Prisma.UserAccessWhereInput, organizationId?: string): Prisma.UserAccessWhereInput {
    return {
        AND: [
            input,
            organizationId ? { OR: [{ organizationId: null }, { organizationId }] } : {},
            {
                OR: [{ organizationId: null }, { organization: { status: 'active' } }],
            },
        ],
    };
}
