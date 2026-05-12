import { Injectable } from '@nestjs/common';
import { Notification } from '@prisma/client';

export type SerializableNotification = {
    id: string;
    userId: string;
    title: string;
    message: string;
    detail: string | null;
    type: Notification['type'];
    link: string | null;
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
    updatedAt: string;
};

@Injectable()
export class NotificationsSerializerService {
    serialize(notification: Notification): SerializableNotification {
        return {
            id: notification.id,
            userId: notification.userId,
            title: notification.title,
            message: notification.message,
            detail: notification.detail,
            type: notification.type,
            link: notification.link,
            isRead: notification.isRead,
            readAt: notification.readAt?.toISOString() ?? null,
            createdAt: notification.createdAt.toISOString(),
            updatedAt: notification.updatedAt.toISOString(),
        };
    }
}
