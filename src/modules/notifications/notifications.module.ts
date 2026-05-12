import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticationModule } from '@/modules/authentication/authentication.module';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { NotificationsSocketAuthService } from '@/modules/notifications/notifications-socket-auth.service';
import { NotificationsRepository } from '@/modules/notifications/repositories/notifications.repository';
import { NotificationsSerializerService } from '@/modules/notifications/services/notifications-serializer.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';

@Module({
    imports: [AuthenticationModule, JwtModule.register({})],
    providers: [NotificationsRepository, NotificationsSocketAuthService, NotificationsSerializerService, NotificationsGateway, NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule {}
