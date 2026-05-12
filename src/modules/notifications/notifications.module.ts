import { Module } from '@nestjs/common';
import { NotificationsRepository } from '@/modules/notifications/repositories/notifications.repository';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';

@Module({
    providers: [NotificationsRepository, NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule {}
