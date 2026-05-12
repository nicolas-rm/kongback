import { Prisma } from '@prisma/client';

export function buildActiveUserAccessWhere(input: Prisma.UserAccessWhereInput): Prisma.UserAccessWhereInput {
    return {
        ...input,
        deletedAt: null,
        role: input.role ?? { deletedAt: null },
    };
}
