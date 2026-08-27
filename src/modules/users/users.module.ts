import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { UsersController } from '@/modules/users/users.controller';
import { UsersRepository } from '@/modules/users/repositories/users.repository';
import { UsersService } from '@/modules/users/services/users.service';

@Module({
    imports: [NotificationsModule],
    controllers: [UsersController],
    providers: [UsersRepository, UsersService],
    exports: [UsersService],
})
export class UsersModule {}
