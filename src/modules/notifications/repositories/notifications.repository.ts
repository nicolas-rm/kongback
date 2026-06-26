import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class NotificationsRepository {
    constructor(protected readonly prisma: PrismaService) {}

    createForUser(userId: string, data: { title: string; message: string; detail?: string | null; type?: NotificationType; link?: string | null }) {
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.findFirst({ where: { id: userId, status: 'active' }, select: { id: true } });
            if (!user) return null;

            return tx.notification.create({
                data: {
                    userId,
                    title: data.title,
                    message: data.message,
                    detail: data.detail ?? null,
                    type: data.type ?? NotificationType.info,
                    link: data.link ?? null,
                },
                select: this.publicSelect(),
            });
        });
    }

    countUnreadForUser(userId: string): Promise<number> {
        return this.prisma.notification.count({
            where: { userId, isRead: false },
        });
    }

    findMany(where: Prisma.NotificationWhereInput, skip: number, take?: number) {
        return this.prisma.notification.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: this.publicSelect(),
        });
    }

    count(where: Prisma.NotificationWhereInput): Promise<number> {
        return this.prisma.notification.count({ where });
    }

    markRead(id: string, userId: string) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.notification.updateMany({
                where: { id, userId },
                data: { isRead: true, readAt: new Date() },
            });
            if (result.count === 0) return null;

            return tx.notification.findFirst({ where: { id, userId }, select: this.publicSelect() });
        });
    }

    markAllRead(userId: string) {
        const readAt = new Date();
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true, readAt },
        });
    }

    findOne(where: Prisma.NotificationWhereInput) {
        return this.prisma.notification.findFirst({ where, select: this.publicSelect() });
    }

    private publicSelect(): Prisma.NotificationSelect {
        return {
            id: true,
            userId: true,
            title: true,
            message: true,
            detail: true,
            type: true,
            link: true,
            isRead: true,
            readAt: true,
            createdAt: true,
        };
    }
}
