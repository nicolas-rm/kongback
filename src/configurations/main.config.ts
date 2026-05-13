import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { formatValidationErrors } from '@/configurations/validation-messages';
import { RequestValidationException } from '@/configurations/request-validation';
import { requestContextMiddleware } from '@/middlewares/request-context.middleware';

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
    app.use(requestContextMiddleware);
    app.use(cookieParser());
    app.enableCors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
        exposedHeaders: ['X-Request-Id'],
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: (errors) => new RequestValidationException(formatValidationErrors(errors)),
        })
    );
}
