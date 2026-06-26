import { Prisma } from '@prisma/client';

export function buildActiveUserAccessWhere(input: Prisma.UserAccessWhereInput): Prisma.UserAccessWhereInput {
    return {
        AND: [
            input,
            {
                OR: [{ organizationId: null }, { organization: { status: 'active' } }],
            },
        ],
    };
}
