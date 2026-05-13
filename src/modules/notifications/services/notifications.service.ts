import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { I18N_KEYS, I18nNotFoundException } from '@/i18n';
import type { I18nKey } from '@/i18n';
import { paginate } from '@/utilities/pagination/pagination.dto';
import { CreateNotificationDto, FindNotificationsDto } from '@/modules/notifications/dto';
import { NotificationsRepository } from '@/modules/notifications/repositories/notifications.repository';
import { NotificationResponse } from '@/modules/notifications/responses';

@Injectable()
export class NotificationsService {
    constructor(
        private readonly repository: NotificationsRepository,
        private readonly i18n: I18nService
    ) {}

    createForUser(userId: string, data: { title: string; message: string; detail?: string | null; type?: NotificationType; link?: string | null }) {
        return this.repository.createForUser(userId, data);
    }

    createSystemForUser(
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
        return this.repository.createForUser(userId, {
            title: this.translate(lang, data.titleKey, data.titleKey, data.args),
            message: this.translate(lang, data.messageKey, data.messageKey, data.args),
            detail: data.detailKey ? this.translate(lang, data.detailKey, data.detailKey, data.args) : null,
            type: data.type,
            link: data.link,
        });
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
        if (!notification) throw new I18nNotFoundException(I18N_KEYS.errors.notifications.notFound, 'Notificacion no encontrada');
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

    private translate(lang: string, key: I18nKey, fallback: string, args?: Record<string, unknown>): string {
        const translated = this.i18n.t(key, { lang, args }) as string;
        return translated && translated !== key ? translated : fallback;
    }

    private resolveLanguage(language?: string | null): string {
        return language?.split(',')[0]?.trim().split('-')[0] || 'es';
    }
}
