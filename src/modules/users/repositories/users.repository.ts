import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class UsersRepository {
    constructor(protected readonly prisma: PrismaService) {}

    create(data: Prisma.UserUncheckedCreateInput) {
        return this.prisma.user.create({
            data,
            select: this.defaultSelect(),
        });
    }

    findMany(where: Prisma.UserWhereInput, skip: number, take?: number) {
        return this.prisma.user.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: this.defaultSelect(),
        });
    }

    count(where: Prisma.UserWhereInput): Promise<number> {
        return this.prisma.user.count({ where });
    }

    findById(id: string) {
        return this.prisma.user.findFirst({
            where: { id, deletedAt: null },
            select: this.defaultSelect(),
        });
    }

    update(id: string, data: Prisma.UserUncheckedUpdateInput) {
        return this.prisma.user.update({
            where: { id },
            data,
            select: this.defaultSelect(),
        });
    }

    softDelete(id: string) {
        return this.prisma.user.update({
            where: { id },
            data: { deletedAt: new Date(), status: 'inactive' },
            select: this.defaultSelect(),
        });
    }

    assignAccess(data: Prisma.UserAccessUncheckedCreateInput) {
        return this.prisma.userAccess.create({
            data,
            select: { id: true, userId: true, roleId: true, organizationId: true, scopeKey: true, scopeId: true, assignedAt: true },
        });
    }

    listAccess(userId: string) {
        return this.prisma.userAccess.findMany({
            where: { userId, deletedAt: null },
            orderBy: { assignedAt: 'desc' },
            select: {
                id: true,
                organizationId: true,
                scopeKey: true,
                scopeId: true,
                assignedAt: true,
                role: { select: { id: true, code: true, name: true } },
            },
        });
    }

    removeAccess(userId: string, id: string) {
        return this.prisma.userAccess.update({
            where: { id, userId },
            data: { deletedAt: new Date() },
        });
    }

    private defaultSelect(): Prisma.UserSelect {
        return {
            id: true,
            username: true,
            email: true,
            fullName: true,
            status: true,
            mustChangePassword: true,
            emailVerifiedAt: true,
            twoFactorEnabled: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
        };
    }
}
