import { Injectable } from '@nestjs/common';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class OrganizationsRepository {
    constructor(private readonly prisma: PrismaService) {}

    create(data: Prisma.OrganizationUncheckedCreateInput) {
        return this.prisma.organization.create({ data, select: this.organizationSelect() });
    }

    findMany(where: Prisma.OrganizationWhereInput, skip: number, take?: number) {
        return this.prisma.organization.findMany({ where, skip, take, orderBy: { name: 'asc' }, select: this.organizationSelect() });
    }

    count(where: Prisma.OrganizationWhereInput): Promise<number> {
        return this.prisma.organization.count({ where });
    }

    findById(id: string) {
        return this.prisma.organization.findUnique({ where: { id }, select: this.organizationSelect() });
    }

    update(id: string, data: Prisma.OrganizationUncheckedUpdateInput) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.organization.updateMany({ where: { id }, data });
            if (result.count === 0) return null;

            return tx.organization.findUnique({ where: { id }, select: this.organizationSelect() });
        });
    }

    deactivate(id: string, updatedByUserId?: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.organization.updateMany({
                where: { id },
                data: { status: Status.inactive, updatedByUserId },
            });
            if (result.count === 0) return null;

            return tx.organization.findUnique({ where: { id }, select: this.organizationSelect() });
        });
    }

    countActiveOrganizations(ids: string[]): Promise<number> {
        return this.prisma.organization.count({ where: { id: { in: ids }, status: Status.active } });
    }

    countActiveUsers(ids: string[]): Promise<number> {
        return this.prisma.user.count({ where: { id: { in: ids }, status: Status.active } });
    }

    listMembers(organizationId: string) {
        return this.prisma.organizationMembership.findMany({
            where: { organizationId },
            orderBy: { user: { fullName: 'asc' } },
            select: this.memberSelect(),
        });
    }

    addMember(organizationId: string, userId: string) {
        return this.prisma.organizationMembership.upsert({
            where: { organizationId_userId: { organizationId, userId } },
            create: { organizationId, userId },
            update: {},
            select: this.memberSelect(),
        });
    }

    removeMember(organizationId: string, membershipId: string) {
        return this.prisma.$transaction(async (tx) => {
            const membership = await tx.organizationMembership.findFirst({
                where: { id: membershipId, organizationId },
                select: { id: true, userId: true },
            });
            if (!membership) return { count: 0 };

            const result = await tx.organizationMembership.deleteMany({ where: { id: membership.id, organizationId } });
            await tx.userAccess.deleteMany({ where: { userId: membership.userId, organizationId } });

            return result;
        });
    }

    private organizationSelect(): Prisma.OrganizationSelect {
        return {
            id: true,
            name: true,
            slug: true,
            description: true,
            status: true,
        };
    }

    private memberSelect(): Prisma.OrganizationMembershipSelect {
        return {
            id: true,
            user: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                    fullName: true,
                    status: true,
                },
            },
        };
    }
}
