import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Permissions } from '@/decorators';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import { CreateNotificationDto, FindNotificationsDto } from '@/modules/notifications/dto';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';

@Controller('notifications')
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway
    ) {}

    @Post()
    @Permissions('notifications.create')
    async create(@Body() dto: CreateNotificationDto) {
        const { notification, response } = await this.notificationsService.create(dto);
        await this.notificationsGateway.emitNotificationCreated(notification);
        return response;
    }
}

@Controller('me/notifications')
export class MyNotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway
    ) {}

    @Get()
    @Permissions('notifications.read-list')
    findMine(@CurrentUser() user: RequestUser, @Query() dto: FindNotificationsDto) {
        return this.notificationsService.findForUser(user.id, dto);
    }

    @Get('unread-count')
    @Permissions('notifications.unread-count.read')
    async unreadCount(@CurrentUser() user: RequestUser) {
        const count = await this.notificationsService.countUnreadForUser(user.id);
        return { count };
    }

    @Patch('read-all')
    @Permissions('notifications.mark-read-all')
    async markAllRead(@CurrentUser() user: RequestUser) {
        const result = await this.notificationsService.markAllRead(user.id);
        const readAt = new Date();
        await this.notificationsGateway.emitNotificationsReadAll(user.id, result.count, readAt);
        return { updatedCount: result.count, readAt };
    }

    @Patch(':id/read')
    @Permissions('notifications.mark-read')
    async markRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
        const { notification, response } = await this.notificationsService.markRead(user.id, id);
        await this.notificationsGateway.emitNotificationRead(notification);
        return response;
    }
}
