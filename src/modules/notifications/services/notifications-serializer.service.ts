import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';

export type SerializableNotificationData = {
    id: string;
    title: string;
    message: string;
    detail: string | null;
    type: NotificationType;
    link: string | null;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
};

export type SerializableNotification = {
    id: string;
    title: string;
    message: string;
    detail: string | null;
    type: NotificationType;
    link: string | null;
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
};

@Injectable()
export class NotificationsSerializerService {
    serialize(notification: SerializableNotificationData): SerializableNotification {
        return {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            detail: notification.detail,
            type: notification.type,
            link: notification.link,
            isRead: notification.isRead,
            readAt: notification.readAt?.toISOString() ?? null,
            createdAt: notification.createdAt.toISOString(),
        };
    }
}
