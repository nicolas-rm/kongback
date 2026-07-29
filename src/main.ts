import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppConfigService } from '@/configurations/app-config.service';
import { configureApp, registerProcessHandlers } from '@/configurations/main.config';
import { SpacedConsoleLogger } from '@/configurations/spaced-console.logger';

async function bootstrap() {
    registerProcessHandlers();
    const logger = new SpacedConsoleLogger();

    Logger.overrideLogger(logger);
    const { AppModule } = await import('./app.module.js');
    const app = await NestFactory.create(AppModule, { logger });
    const config = app.get(AppConfigService);

    configureApp(app);

    await app.listen(config.port);
}
void bootstrap();
