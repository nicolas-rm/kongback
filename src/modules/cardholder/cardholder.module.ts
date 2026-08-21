import { Module } from '@nestjs/common';
import { CryptoModule } from '@/crypto/crypto.module';
import { CardcloudModule } from '@/modules/cardcloud/cardcloud.module';
import { CardholderController } from '@/modules/cardholder/cardholder.controller';
import { CardholderService } from '@/modules/cardholder/cardholder.service';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
    imports: [CardcloudModule, CryptoModule, NotificationsModule],
    controllers: [CardholderController],
    providers: [CardholderService],
})
export class CardholderModule {}
