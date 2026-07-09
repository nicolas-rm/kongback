import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/configurations/app-config.module';
import { CardcloudController } from '@/modules/cardcloud/cardcloud.controller';
import { CardcloudExternalService } from '@/modules/cardcloud/cardcloud-external.service';
import { CardcloudService } from '@/modules/cardcloud/cardcloud.service';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';

@Module({
    imports: [AppConfigModule, IntegrationsModule],
    controllers: [CardcloudController],
    providers: [CardcloudExternalService, CardcloudService],
    exports: [CardcloudExternalService, CardcloudService],
})
export class CardcloudModule {}
