import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class NotificationsRepository {
    constructor(protected readonly prisma: PrismaService) {}

    createForUser(userId: string, data: { title: string; message: string; detail?: string | null; type?: NotificationType; link?: string | null }) {
        return this.prisma.notification.create({
            data: {
                userId,
                title: data.title,
                message: data.message,
                detail: data.detail ?? null,
                type: data.type ?? NotificationType.info,
                link: data.link ?? null,
            },
        });
    }

    countUnreadForUser(userId: string): Promise<number> {
        return this.prisma.notification.count({
            where: { userId, isRead: false, deletedAt: null },
        });
    }

    findMany(where: Prisma.NotificationWhereInput, skip: number, take?: number) {
        return this.prisma.notification.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
        });
    }

    count(where: Prisma.NotificationWhereInput): Promise<number> {
        return this.prisma.notification.count({ where });
    }

    markRead(id: string, userId: string) {
        return this.prisma.notification.update({
            where: { id },
            data: { isRead: true, readAt: new Date() },
        });
    }

    markAllRead(userId: string) {
        const readAt = new Date();
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false, deletedAt: null },
            data: { isRead: true, readAt },
        });
    }

    findOne(where: Prisma.NotificationWhereInput) {
        return this.prisma.notification.findFirst({ where });
    }
}
