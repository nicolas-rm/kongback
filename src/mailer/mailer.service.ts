import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailDispatchContext, Prisma } from '@prisma/client';
import { AppConfigService } from '@/configurations/app-config.service';
import { EmailTemplateService } from '@/mailer/email-template.service';
import { EmailRateLimiterService, ReserveEmailDispatchResult } from '@/mailer/email-rate-limiter.service';

type MailContext = {
    recipientUserId?: string | null;
    triggeredByUserId?: string | null;
    ipAddress?: string | null;
    metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AppMailerService {
    private readonly logger = new Logger(AppMailerService.name);

    constructor(
        private readonly mailer: MailerService,
        private readonly config: AppConfigService,
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
        await this.sendTrackedTemplateMail({
            dispatchId: reservation.dispatchId,
            to,
            subject: 'Restablecer contrasena',
            appName: this.config.name,
            title: 'Restablecer contrasena',
            body: `Usa este enlace para restablecer tu contrasena. Expira en ${expiresAt.toLocaleString('es-MX')}.`,
            actionLabel: 'Restablecer contrasena',
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

        await this.sendTrackedTemplateMail({
            dispatchId: reservation.dispatchId,
            to,
            subject: `Bienvenido a ${this.config.name}`,
            appName: this.config.name,
            title: `Bienvenido a ${this.config.name}`,
            body: `Tu usuario es ${username} y tu contrasena temporal es ${password}.`,
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
        await this.sendTrackedTemplateMail({
            dispatchId: reservation.dispatchId,
            to,
            subject: 'Verificar correo electronico',
            appName: this.config.name,
            title: 'Verificar correo electronico',
            body: 'Confirma tu correo para completar la configuracion de tu cuenta.',
            actionLabel: 'Verificar correo',
            actionUrl: verificationUrl.toString(),
        });

        return reservation;
    }

    async sendOrganizationInvitation(to: string, token: string, organizationName: string, context: MailContext = {}) {
        const reservation = await this.emailRateLimiter.reserve({
            context: EmailDispatchContext.custom,
            recipientEmail: to,
            recipientUserId: context.recipientUserId,
            triggeredByUserId: context.triggeredByUserId,
            ipAddress: context.ipAddress,
            metadata: context.metadata,
        });
        if (!reservation.allowed) return reservation;

        const invitationUrl = new URL(`/invitations/${token}`, this.config.mail.webUrl);
        await this.sendTrackedTemplateMail({
            dispatchId: reservation.dispatchId,
            to,
            subject: `Invitacion a ${organizationName}`,
            appName: this.config.name,
            title: `Invitacion a ${organizationName}`,
            body: `Recibiste una invitacion para unirte a ${organizationName}.`,
            actionLabel: 'Aceptar invitacion',
            actionUrl: invitationUrl.toString(),
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
}
