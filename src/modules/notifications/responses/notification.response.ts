import { NotificationType } from '@prisma/client';

type NotificationResponseData = {
    id: string;
    userId?: string;
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

export class NotificationResponse {
    constructor(
        public id: string,
        public title: string,
        public message: string,
        public detail: string | null,
        public type: NotificationType,
        public link: string | null,
        public isRead: boolean,
        public readAt: Date | null,
        public createdAt: Date,
        public updatedAt: Date,
        public userId?: string
    ) {}

    static from(data: NotificationResponseData, options: { includeUserId?: boolean } = {}): NotificationResponse {
        return new NotificationResponse(
            data.id,
            data.title,
            data.message,
            data.detail,
            data.type,
            data.link,
            data.isRead,
            data.readAt,
            data.createdAt,
            data.updatedAt,
            options.includeUserId ? data.userId : undefined
        );
    }
}
