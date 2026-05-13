import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticationModule } from '@/modules/authentication/authentication.module';
import { MyNotificationsController, NotificationsController } from '@/modules/notifications/notifications.controller';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';
import { NotificationsSocketAuthenticationService } from '@/modules/notifications/notifications-socket-authentication.service';
import { NotificationsRepository } from '@/modules/notifications/repositories/notifications.repository';
import { NotificationsSerializerService } from '@/modules/notifications/services/notifications-serializer.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';

@Module({
    imports: [AuthenticationModule, JwtModule.register({})],
    controllers: [NotificationsController, MyNotificationsController],
    providers: [NotificationsRepository, NotificationsSocketAuthenticationService, NotificationsSerializerService, NotificationsGateway, NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule {}
