import { Module } from '@nestjs/common';
import { CardholdersController } from '@/modules/cardholders/cardholders.controller';
import { CardholdersRepository } from '@/modules/cardholders/repositories/cardholders.repository';
import { CardholdersService } from '@/modules/cardholders/cardholders.service';

@Module({
    controllers: [CardholdersController],
    providers: [CardholdersRepository, CardholdersService],
})
export class CardholdersModule {}
