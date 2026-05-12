import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { CreateNotificationDto, FindNotificationsDto } from '@/modules/notifications/dto';
import { NotificationsRepository } from '@/modules/notifications/repositories/notifications.repository';

type UserNotificationResponse = {
    id: string;
    title: string;
    message: string;
    detail: string | null;
    type: NotificationType;
    link: string | null;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

@Injectable()
export class NotificationsService {
    constructor(private readonly repository: NotificationsRepository) {}

    createForUser(userId: string, data: { title: string; message: string; detail?: string | null; type?: NotificationType; link?: string | null }) {
        return this.repository.createForUser(userId, data);
    }

    countUnreadForUser(userId: string): Promise<number> {
        return this.repository.countUnreadForUser(userId);
    }

    create(dto: CreateNotificationDto) {
        return this.repository.createForUser(dto.userId, dto);
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
            data.map((notification) => this.toUserResponse(notification)),
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
            response: this.toUserResponse(notification),
        };
    }

    markAllRead(userId: string) {
        return this.repository.markAllRead(userId);
    }

    private toUserResponse(notification: {
        id: string;
        title: string;
        message: string;
        detail: string | null;
        type: NotificationType;
        link: string | null;
        isRead: boolean;
        readAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }): UserNotificationResponse {
        return {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            detail: notification.detail,
            type: notification.type,
            link: notification.link,
            isRead: notification.isRead,
            readAt: notification.readAt,
            createdAt: notification.createdAt,
            updatedAt: notification.updatedAt,
        };
    }
}
