import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig from '@/configurations/app.config';
import { validate } from '@/configurations/env.validation';
import { AppConfigModule } from '@/configurations/app-config.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { CryptoModule } from '@/crypto/crypto.module';
import { AppMailerModule } from '@/mailer/mailer.module';
import { JwtAuthGuard } from '@/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from '@/guards/must-change-password.guard';
import { PermissionsGuard } from '@/guards/permissions.guard';
import { HttpExceptionFilter } from '@/filters/http-exception.filter';
import { PrismaExceptionFilter } from '@/filters/prisma-exception.filter';
import { ValidationExceptionFilter } from '@/filters/validation-exception.filter';
import { APP_MODULES } from '@/modules';

@Module({
    imports: [
        NestConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig],
            validate,
            cache: true,
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
            useClass: JwtAuthGuard,
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
