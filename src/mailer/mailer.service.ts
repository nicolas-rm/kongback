import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailDispatchContext, Prisma } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { AppConfigService } from '@/configurations/app-config.service';
import { I18N_KEYS, type I18nKey } from '@/i18n';
import { EmailTemplateService } from '@/mailer/email-template.service';
import { EmailRateLimiterService, ReserveEmailDispatchResult } from '@/mailer/email-rate-limiter.service';

type MailContext = {
    recipientUserId?: string | null;
    triggeredByUserId?: string | null;
    ipAddress?: string | null;
    language?: string | null;
    metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AppMailerService {
    private readonly logger = new Logger(AppMailerService.name);

    constructor(
        private readonly mailer: MailerService,
        private readonly config: AppConfigService,
        private readonly i18n: I18nService,
        private readonly emailTemplateService: EmailTemplateService,
        private readonly emailRateLimiter: EmailRateLimiterService
    ) {}

    async reservePasswordReset(to: string, context: MailContext = {}): Promise<ReserveEmailDispatchResult> {
        return this.emailRateLimiter.reserve({
            context: EmailDispatchContext.password_reset,
            recipientEmail: to,
            recipientUserId: context.recipientUserId,
            triggeredByUserId: context.triggeredByUserId,
            ipAddress: context.ipAddress,
            metadata: context.metadata,
        });
    }

    async sendPasswordReset(to: string, token: string, expiresAt: Date, context: MailContext = {}, dispatchId?: string) {
        const reservation = dispatchId ? { allowed: true as const, dispatchId } : await this.reservePasswordReset(to, context);
        if (!reservation.allowed) return reservation;

        const resetUrl = new URL(`/reset-password/${token}`, this.config.mail.webUrl);
        const lang = this.resolveLanguage(context.language);
        const expiresAtText = this.formatDate(expiresAt, lang);
        await this.sendTrackedTemplateMail({
            dispatchId: reservation.dispatchId,
            to,
            subject: this.translate(lang, I18N_KEYS.mail.passwordReset.subject, 'Restablecer contrasena'),
            appName: this.config.name,
            title: this.translate(lang, I18N_KEYS.mail.passwordReset.title, 'Restablecer contrasena'),
            body: this.translate(lang, I18N_KEYS.mail.passwordReset.body, 'Usa este enlace para restablecer tu contrasena. Expira en {expiresAt}.', { expiresAt: expiresAtText }),
            actionLabel: this.translate(lang, I18N_KEYS.mail.passwordReset.action, 'Restablecer contrasena'),
            actionUrl: resetUrl.toString(),
        });

        return reservation;
    }

    async sendWelcomeCredentials(to: string, username: string, password: string, context: MailContext = {}) {
        const reservation = await this.emailRateLimiter.reserve({
            context: EmailDispatchContext.welcome_credentials,
            recipientEmail: to,
            recipientUserId: context.recipientUserId,
            triggeredByUserId: context.triggeredByUserId,
            ipAddress: context.ipAddress,
            metadata: context.metadata,
        });
        if (!reservation.allowed) return reservation;

        const lang = this.resolveLanguage(context.language);
        await this.sendTrackedTemplateMail({
            dispatchId: reservation.dispatchId,
            to,
            subject: this.translate(lang, I18N_KEYS.mail.welcomeCredentials.subject, 'Bienvenido a {appName}', { appName: this.config.name }),
            appName: this.config.name,
            title: this.translate(lang, I18N_KEYS.mail.welcomeCredentials.title, 'Bienvenido a {appName}', { appName: this.config.name }),
            body: this.translate(lang, I18N_KEYS.mail.welcomeCredentials.body, 'Tu usuario es {username} y tu contrasena temporal es {password}.', { username, password }),
        });

        return reservation;
    }

    async sendEmailVerification(to: string, token: string, context: MailContext = {}) {
        const reservation = await this.emailRateLimiter.reserve({
            context: EmailDispatchContext.verify_email,
            recipientEmail: to,
            recipientUserId: context.recipientUserId,
            triggeredByUserId: context.triggeredByUserId,
            ipAddress: context.ipAddress,
            metadata: context.metadata,
        });
        if (!reservation.allowed) return reservation;

        const verificationUrl = new URL(`/verify-email/${token}`, this.config.mail.webUrl);
        const lang = this.resolveLanguage(context.language);
        await this.sendTrackedTemplateMail({
            dispatchId: reservation.dispatchId,
            to,
            subject: this.translate(lang, I18N_KEYS.mail.emailVerification.subject, 'Verificar correo electronico'),
            appName: this.config.name,
            title: this.translate(lang, I18N_KEYS.mail.emailVerification.title, 'Verificar correo electronico'),
            body: this.translate(lang, I18N_KEYS.mail.emailVerification.body, 'Confirma tu correo para completar la configuracion de tu cuenta.'),
            actionLabel: this.translate(lang, I18N_KEYS.mail.emailVerification.action, 'Verificar correo'),
            actionUrl: verificationUrl.toString(),
        });

        return reservation;
    }

    private async sendTrackedTemplateMail(input: { dispatchId: string; to: string; subject: string; appName: string; title: string; body: string; actionLabel?: string; actionUrl?: string }) {
        const html = this.emailTemplateService.buildSimpleEmail({
            appName: input.appName,
            title: input.title,
            body: input.body,
            actionLabel: input.actionLabel,
            actionUrl: input.actionUrl,
        });

        await this.sendTrackedMail(input.dispatchId, input.to, input.subject, html);
    }

    private async sendTrackedMail(dispatchId: string, to: string, subject: string, html: string) {
        try {
            if (this.config.mail.driver === 'disabled') {
                await this.emailRateLimiter.markSent(dispatchId);
                return;
            }

            if (this.config.mail.driver === 'console') {
                this.logger.log(`mail.console to=${to} subject=${subject}`);
                this.logger.debug(html);
                await this.emailRateLimiter.markSent(dispatchId);
                return;
            }

            await this.mailer.sendMail({ to, from: `${this.config.name} <${this.config.mail.from}>`, subject, html });
            await this.emailRateLimiter.markSent(dispatchId);
        } catch (error) {
            await this.emailRateLimiter.markFailed(dispatchId, error);
            throw error;
        }
    }

    private translate(lang: string, key: I18nKey, fallback: string, args?: Record<string, unknown>): string {
        const translated = this.i18n.t(key, { lang, args }) as string;
        return translated && translated !== key ? translated : this.interpolate(fallback, args);
    }

    private resolveLanguage(language?: string | null): string {
        return language?.split(',')[0]?.trim().split('-')[0] || 'es';
    }

    private formatDate(date: Date, lang: string): string {
        const locales: Record<string, string> = { es: 'es-MX', en: 'en-US', fr: 'fr-FR', de: 'de-DE', zh: 'zh-CN' };
        return date.toLocaleString(locales[lang] ?? 'es-MX');
    }

    private interpolate(template: string, args?: Record<string, unknown>): string {
        if (!args) return template;
        return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(args[key] ?? `{${key}}`));
    }
}
