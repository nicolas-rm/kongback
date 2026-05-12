import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailDispatchContext, Prisma } from '@prisma/client';
import { AppConfigService } from '@/configurations/app-config.service';
import { EmailRateLimiterService, ReserveEmailDispatchResult } from '@/utilities/mailer/email-rate-limiter.service';

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
        const html = buildSimpleEmailHtml({
            appName: this.config.name,
            title: 'Restablecer contrasena',
            body: `Usa este enlace para restablecer tu contrasena. Expira en ${expiresAt.toLocaleString('es-MX')}.`,
            actionLabel: 'Restablecer contrasena',
            actionUrl: resetUrl.toString(),
        });

        await this.sendTrackedMail(reservation.dispatchId, to, 'Restablecer contrasena', html);
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

        const html = buildSimpleEmailHtml({
            appName: this.config.name,
            title: `Bienvenido a ${this.config.name}`,
            body: `Tu usuario es ${username} y tu contrasena temporal es ${password}.`,
        });

        await this.sendTrackedMail(reservation.dispatchId, to, `Bienvenido a ${this.config.name}`, html);
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
        const html = buildSimpleEmailHtml({
            appName: this.config.name,
            title: `Invitacion a ${organizationName}`,
            body: `Recibiste una invitacion para unirte a ${organizationName}.`,
            actionLabel: 'Aceptar invitacion',
            actionUrl: invitationUrl.toString(),
        });

        await this.sendTrackedMail(reservation.dispatchId, to, `Invitacion a ${organizationName}`, html);
        return reservation;
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

function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function buildSimpleEmailHtml(input: { appName: string; title: string; body: string; actionLabel?: string; actionUrl?: string }) {
    const action =
        input.actionLabel && input.actionUrl
            ? `<p><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#111827;color:white;padding:10px 14px;border-radius:6px;text-decoration:none">${escapeHtml(input.actionLabel)}</a></p>`
            : '';

    return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111827"><h1>${escapeHtml(input.title)}</h1><p>${escapeHtml(input.body)}</p>${action}<p style="color:#6b7280;font-size:12px">${escapeHtml(input.appName)}</p></body></html>`;
}
