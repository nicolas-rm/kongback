import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { I18N_KEYS, I18nNotFoundException } from '@/i18n';
import type { I18nKey } from '@/i18n';
import { paginate } from '@/utilities/pagination/pagination.dto';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { CreateNotificationDto, FindNotificationsDto } from '@/modules/notifications/dto';
import { NotificationsRepository } from '@/modules/notifications/repositories/notifications.repository';
import { NotificationResponse } from '@/modules/notifications/responses';
import { AuditService } from '@/modules/audit/audit.service';
import { NotificationsRealtimeService } from '@/modules/notifications/services/notifications-realtime.service';

@Injectable()
export class NotificationsService {
    constructor(
        private readonly repository: NotificationsRepository,
        private readonly i18n: I18nService,
        private readonly audit: AuditService,
        private readonly realtime: NotificationsRealtimeService
    ) {}

    async createForUser(userId: string, data: { title: string; message: string; detail?: string | null; type?: NotificationType; link?: string | null }) {
        const notification = await this.repository.createForUser(userId, data);
        if (!notification) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'No encontramos el usuario solicitado.');

        void this.audit.recordBusiness({ action: 'notification_created_for_user', resourceType: 'Notification', resourceId: notification.id, metadata: { userId, type: notification.type } });
        this.realtime.notifyCreated(notification);
        return notification;
    }

    async createSystemForUser(
        userId: string,
        data: {
            titleKey: I18nKey;
            messageKey: I18nKey;
            detailKey?: I18nKey;
            args?: Record<string, unknown>;
            language?: string | null;
            type?: NotificationType;
            link?: string | null;
        }
    ) {
        const lang = this.resolveLanguage(data.language);
        const notification = await this.repository.createForUser(userId, {
            title: this.translate(lang, data.titleKey, data.titleKey, data.args),
            message: this.translate(lang, data.messageKey, data.messageKey, data.args),
            detail: data.detailKey ? this.translate(lang, data.detailKey, data.detailKey, data.args) : null,
            type: data.type,
            link: data.link,
        });
        if (!notification) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'No encontramos el usuario solicitado.');

        void this.audit.recordBusiness({ action: 'system_notification_created_for_user', resourceType: 'Notification', resourceId: notification.id, metadata: { userId, type: notification.type } });
        this.realtime.notifyCreated(notification);
        return notification;
    }

    countUnreadForUser(userId: string): Promise<number> {
        return this.repository.countUnreadForUser(userId);
    }

    async create(dto: CreateNotificationDto, scope?: CompanyScope) {
        const notification = await this.repository.createForUser(dto.userId, dto, scope);
        if (!notification) throw new I18nNotFoundException(I18N_KEYS.errors.users.notFound, 'No encontramos el usuario solicitado.');

        void this.audit.recordBusiness({ action: 'notification_created', resourceType: 'Notification', resourceId: notification.id, metadata: { userId: dto.userId, type: notification.type } });
        this.realtime.notifyCreated(notification);
        return {
            notification,
            response: NotificationResponse.from(notification),
        };
    }

    async findForUser(userId: string, dto: FindNotificationsDto) {
        const where: Prisma.NotificationWhereInput = {
            userId,
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
        const notification = await this.repository.findOne({ id: notificationId, userId });
        if (!notification) throw new I18nNotFoundException(I18N_KEYS.errors.notifications.notFound, 'No encontramos la notificacion solicitada.');
        void this.audit.recordBusiness({ action: 'notification_consulted', resourceType: 'Notification', resourceId: notification.id, metadata: { userId } });
        return notification;
    }

    async markRead(userId: string, notificationId: string) {
        await this.findOneForUser(userId, notificationId);
        const notification = await this.repository.markRead(notificationId, userId);
        if (!notification) throw new I18nNotFoundException(I18N_KEYS.errors.notifications.notFound, 'No encontramos la notificacion solicitada.');

        void this.audit.recordBusiness({ action: 'notification_marked_read', resourceType: 'Notification', resourceId: notification.id, metadata: { userId } });
        this.realtime.notifyRead(notification);
        return {
            notification,
            response: NotificationResponse.from(notification),
        };
    }

    async markAllRead(userId: string) {
        const result = await this.repository.markAllRead(userId);
        void this.audit.recordBusiness({ action: 'notifications_marked_read_all', resourceType: 'Notification', metadata: { userId, updatedCount: result.count } });
        this.realtime.notifyReadAll({ userId, updatedCount: result.count, readAt: result.readAt });
        return result;
    }

    private translate(lang: string, key: I18nKey, fallback: string, args?: Record<string, unknown>): string {
        const translated = this.i18n.t(key, { lang, args }) as string;
        return translated && translated !== key ? translated : fallback;
    }

    private resolveLanguage(language?: string | null): string {
        return language?.split(',')[0]?.trim().split('-')[0] || 'es';
    }
}
