import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AcceptLanguageResolver, I18nJsonLoader, I18nModule } from 'nestjs-i18n';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig from '@/configurations/app.config';
import { validate } from '@/configurations/env.validation';
import { AppConfigModule } from '@/configurations/app-config.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { CryptoModule } from '@/crypto/crypto.module';
import { AppMailerModule } from '@/mailer/mailer.module';
import { JwtAuthenticationGuard } from '@/guards/jwt-authentication.guard';
import { MustChangePasswordGuard } from '@/guards/must-change-password.guard';
import { PermissionsGuard } from '@/guards/permissions.guard';
import { HttpExceptionFilter } from '@/filters/http-exception.filter';
import { PrismaExceptionFilter } from '@/filters/prisma-exception.filter';
import { ValidationExceptionFilter } from '@/filters/validation-exception.filter';
import { APP_MODULES } from '@/modules';

function resolveI18nPath(): string {
    const candidates = [path.join(__dirname, 'i18n'), path.join(__dirname, '..', 'i18n'), path.join(process.cwd(), 'src', 'i18n')];
    return candidates.find((candidate) => existsSync(path.join(candidate, 'es')) && existsSync(path.join(candidate, 'en'))) ?? path.join(process.cwd(), 'src', 'i18n');
}

const I18N_PATH = resolveI18nPath();

@Module({
    imports: [
        NestConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig],
            validate,
            cache: true,
        }),
        I18nModule.forRoot({
            fallbackLanguage: 'es',
            loader: I18nJsonLoader,
            loaderOptions: {
                path: I18N_PATH,
                watch: process.env.NODE_ENV !== 'production',
            },
            resolvers: [new AcceptLanguageResolver({ matchType: 'strict-loose' })],
        }),
        AppConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        PrismaModule,
        CryptoModule,
        AppMailerModule,
        ...APP_MODULES,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        {
            provide: APP_FILTER,
            useClass: PrismaExceptionFilter,
        },
        {
            provide: APP_FILTER,
            useClass: ValidationExceptionFilter,
        },
        {
            provide: APP_FILTER,
            useClass: HttpExceptionFilter,
        },
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
        {
            provide: APP_GUARD,
            useClass: JwtAuthenticationGuard,
        },
        {
            provide: APP_GUARD,
            useClass: MustChangePasswordGuard,
        },
        {
            provide: APP_GUARD,
            useClass: PermissionsGuard,
        },
    ],
})
export class AppModule {}
