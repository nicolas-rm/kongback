import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentCompanyScope, CurrentUser, Permissions, RequireSystemOrCompanyAccess } from '@/decorators';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';
import type { CompanyScope } from '@/utilities/tenancy/company-scope';
import { CreateNotificationDto, FindNotificationsDto } from '@/modules/notifications/dto';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';

@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Post()
    @RequireSystemOrCompanyAccess()
    @Permissions('notifications.create')
    async create(@CurrentCompanyScope() scope: CompanyScope | undefined, @Body() dto: CreateNotificationDto) {
        const { response } = await this.notificationsService.create(dto, scope);
        return response;
    }
}

@Controller('me/notifications')
export class MyNotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

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
        return { updatedCount: result.count, readAt: result.readAt };
    }

    @Patch(':id/read')
    @Permissions('notifications.mark-read')
    async markRead(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
        const { response } = await this.notificationsService.markRead(user.id, id);
        return response;
    }
}
