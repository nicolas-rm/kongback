import { Global, Module } from '@nestjs/common';
import appConfig from '@/configurations/app.config';
import { AppConfigService } from '@/configurations/app-config.service';

@Global()
@Module({
    providers: [
        {
            provide: appConfig.KEY,
            useFactory: () => appConfig(),
        },
        AppConfigService,
    ],
    exports: [AppConfigService],
})
export class AppConfigModule {}
