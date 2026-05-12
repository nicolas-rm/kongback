import { Module } from '@nestjs/common';
import { UsersController } from '@/modules/users/users.controller';
import { UsersRepository } from '@/modules/users/repositories/users.repository';
import { UsersService } from '@/modules/users/services/users.service';

@Module({
    controllers: [UsersController],
    providers: [UsersRepository, UsersService],
    exports: [UsersService],
})
export class UsersModule {}
