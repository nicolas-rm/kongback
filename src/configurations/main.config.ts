import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { I18nValidationPipe } from 'nestjs-i18n';
import { AppConfigService } from '@/configurations/app-config.service';
import { requestContextMiddleware } from '@/middlewares/request-context.middleware';
import { securityHeadersMiddleware } from '@/middlewares/security-headers.middleware';

export function registerProcessHandlers(): void {
    process.on('unhandledRejection', (reason: unknown) => {
        console.error('[UnhandledRejection]', reason);
    });

    process.on('uncaughtException', (error: Error) => {
        console.error('[UncaughtException]', error);
        setTimeout(() => process.exit(1), 100);
    });
}

export function configureApp(app: INestApplication): void {
    const config = app.get(AppConfigService);
    const isProduction = config.nodeEnv === 'production';
    const allowedOrigins = config.security.allowedOrigins.length > 0 ? config.security.allowedOrigins : isProduction ? [config.webUrl] : true;

    app.use(securityHeadersMiddleware(isProduction));
    app.use(requestContextMiddleware);
    app.use(cookieParser());
    app.enableCors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept-Language'],
        exposedHeaders: ['X-Request-Id'],
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
        new I18nValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        })
    );
}
