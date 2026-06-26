import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { AppConfigService } from '@/configurations/app-config.service';
import { configureApp, registerProcessHandlers } from '@/configurations/main.config';
import { SpacedConsoleLogger } from '@/configurations/spaced-console.logger';

async function bootstrap() {
    registerProcessHandlers();
    const app = await NestFactory.create(AppModule, { logger: new SpacedConsoleLogger() });
    const config = app.get(AppConfigService);

    configureApp(app);

    await app.listen(config.port);
}
void bootstrap();
