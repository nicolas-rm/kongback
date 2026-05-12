import { Global, Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { AppConfigModule } from '@/configurations/app-config.module';
import { AppConfigService } from '@/configurations/app-config.service';
import { EmailRateLimiterService } from '@/utilities/mailer/email-rate-limiter.service';
import { AppMailerService } from '@/utilities/mailer/mailer.service';

@Global()
@Module({
    imports: [
        AppConfigModule,
        MailerModule.forRootAsync({
            imports: [AppConfigModule],
            inject: [AppConfigService],
            useFactory: (config: AppConfigService) => ({
                transport: {
                    host: config.mail.host,
                    port: config.mail.port,
                    secure: config.mail.secure,
                    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined,
                },
                defaults: {
                    from: config.mail.from,
                },
            }),
        }),
    ],
    providers: [EmailRateLimiterService, AppMailerService],
    exports: [AppMailerService],
})
export class AppMailerModule {}
