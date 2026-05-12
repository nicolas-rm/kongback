import { Module } from '@nestjs/common';
import { UsersRepository } from '@/modules/users/repositories/users.repository';
import { UsersService } from '@/modules/users/services/users.service';

@Module({
    providers: [UsersRepository, UsersService],
    exports: [UsersService],
})
export class UsersModule {}
