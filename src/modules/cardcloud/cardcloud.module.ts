import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/configurations/app-config.module';
import { CryptoModule } from '@/crypto/crypto.module';
import { CardcloudController } from '@/modules/cardcloud/cardcloud.controller';
import { CardcloudExternalService } from '@/modules/cardcloud/cardcloud-external.service';
import { CardcloudStockController } from '@/modules/cardcloud/cardcloud-stock.controller';
import { CardcloudService } from '@/modules/cardcloud/cardcloud.service';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
    imports: [AppConfigModule, CryptoModule, IntegrationsModule, NotificationsModule],
    controllers: [CardcloudController, CardcloudStockController],
    providers: [CardcloudExternalService, CardcloudService],
    exports: [CardcloudExternalService, CardcloudService],
})
export class CardcloudModule {}
