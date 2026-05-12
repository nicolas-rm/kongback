import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { CreateNotificationDto, FindNotificationsDto } from '@/modules/notifications/dto';
import { NotificationsRepository } from '@/modules/notifications/repositories/notifications.repository';
import { NotificationResponse } from '@/modules/notifications/responses';

@Injectable()
export class NotificationsService {
    constructor(private readonly repository: NotificationsRepository) {}

    createForUser(userId: string, data: { title: string; message: string; detail?: string | null; type?: NotificationType; link?: string | null }) {
        return this.repository.createForUser(userId, data);
    }

    countUnreadForUser(userId: string): Promise<number> {
        return this.repository.countUnreadForUser(userId);
    }

    async create(dto: CreateNotificationDto) {
        const notification = await this.repository.createForUser(dto.userId, dto);
        return {
            notification,
            response: NotificationResponse.from(notification, { includeUserId: true }),
        };
    }

    async findForUser(userId: string, dto: FindNotificationsDto) {
        const where: Prisma.NotificationWhereInput = {
            userId,
            deletedAt: null,
            isRead: dto.isRead,
            type: dto.type,
            ...(dto.search ? { OR: [{ title: { contains: dto.search, mode: 'insensitive' } }, { message: { contains: dto.search, mode: 'insensitive' } }] } : {}),
        };
        const [data, total] = await Promise.all([this.repository.findMany(where, dto.skip, dto.actualLimit), this.repository.count(where)]);
        return paginate(
            data.map((notification) => NotificationResponse.from(notification)),
            total,
            dto
        );
    }

    async findOneForUser(userId: string, notificationId: string) {
        const notification = await this.repository.findOne({ id: notificationId, userId, deletedAt: null });
        if (!notification) throw new NotFoundException('Notificacion no encontrada');
        return notification;
    }

    async markRead(userId: string, notificationId: string) {
        await this.findOneForUser(userId, notificationId);
        const notification = await this.repository.markRead(notificationId, userId);

        return {
            notification,
            response: NotificationResponse.from(notification),
        };
    }

    markAllRead(userId: string) {
        return this.repository.markAllRead(userId);
    }
}
