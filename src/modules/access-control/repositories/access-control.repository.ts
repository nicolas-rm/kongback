import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { buildActiveUserAccessWhere } from '@/utilities/authentication/active-user-access-filter';

@Injectable()
export class AccessControlRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findUserRoleLabels(userId: string): Promise<string[]> {
        const accesses = await this.prisma.userAccess.findMany({
            where: buildActiveUserAccessWhere({ userId }),
            select: { role: { select: { code: true, name: true } } },
        });

        return accesses.flatMap((entry) => [entry.role.code, entry.role.name]);
    }

    async findUserPermissionCodes(userId: string): Promise<string[]> {
        const rolePermissions = await this.prisma.rolePermission.findMany({
            where: {
                permission: { deletedAt: null },
                role: {
                    deletedAt: null,
                    accesses: { some: buildActiveUserAccessWhere({ userId }) },
                },
            },
            select: { permission: { select: { code: true } } },
        });

        return rolePermissions.map((entry) => entry.permission.code);
    }
}
