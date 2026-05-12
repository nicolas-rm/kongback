import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HttpClientService } from '@/modules/integrations/http-client.service';

@Module({
    imports: [
        HttpModule.register({
            timeout: 10_000,
            maxRedirects: 3,
        }),
    ],
    providers: [HttpClientService],
    exports: [HttpClientService],
})
export class IntegrationsModule {}
