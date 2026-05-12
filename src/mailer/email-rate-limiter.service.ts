import { Injectable, Logger } from '@nestjs/common';
import { EmailDispatchContext, EmailDispatchStatus, Prisma } from '@prisma/client';
import { MailerRepository } from '@/mailer/mailer.repository';
import { normalizeEmail } from '@/utilities/auth/email.util';

type LimitDimension = 'recipient_email' | 'recipient_user' | 'trigger_user' | 'ip_address' | 'global';

type RateRule = {
    name: string;
    limit: number;
    windowMs: number;
    dimension: LimitDimension;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const EMAIL_RATE_RULES: Partial<Record<EmailDispatchContext, RateRule[]>> = {
    password_reset: [
        { name: 'email_10m', dimension: 'recipient_email', limit: 1, windowMs: 10 * MINUTE },
        { name: 'email_1h', dimension: 'recipient_email', limit: 3, windowMs: HOUR },
        { name: 'email_24h', dimension: 'recipient_email', limit: 10, windowMs: DAY },
        { name: 'ip_1h', dimension: 'ip_address', limit: 20, windowMs: HOUR },
        { name: 'global_1h', dimension: 'global', limit: 300, windowMs: HOUR },
    ],
    welcome_credentials: [
        { name: 'recipient_user_24h', dimension: 'recipient_user', limit: 1, windowMs: DAY },
        { name: 'email_24h', dimension: 'recipient_email', limit: 2, windowMs: DAY },
        { name: 'trigger_user_1h', dimension: 'trigger_user', limit: 50, windowMs: HOUR },
        { name: 'global_1h', dimension: 'global', limit: 500, windowMs: HOUR },
    ],
    verify_email: [
        { name: 'email_10m', dimension: 'recipient_email', limit: 1, windowMs: 10 * MINUTE },
        { name: 'email_1h', dimension: 'recipient_email', limit: 3, windowMs: HOUR },
        { name: 'global_1h', dimension: 'global', limit: 300, windowMs: HOUR },
    ],
};

export type ReserveEmailDispatchInput = {
    context: EmailDispatchContext;
    recipientEmail?: string | null;
    recipientUserId?: string | null;
    triggeredByUserId?: string | null;
    ipAddress?: string | null;
    metadata?: Prisma.InputJsonValue;
};

export type ReserveEmailDispatchResult =
    | {
          allowed: true;
          dispatchId: string;
      }
    | {
          allowed: false;
          reason: string;
          retryAfterSeconds: number;
      };

type NormalizedReserveInput = {
    context: EmailDispatchContext;
    recipientEmail: string | null;
    recipientUserId: string | null;
    triggeredByUserId: string | null;
    ipAddress: string | null;
    metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class EmailRateLimiterService {
    private readonly logger = new Logger(EmailRateLimiterService.name);

    constructor(private readonly mailerRepository: MailerRepository) {}

    async reserve(input: ReserveEmailDispatchInput): Promise<ReserveEmailDispatchResult> {
        const normalizedInput = this.normalizeReserveInput(input);
        const denied = await this.findFirstDeniedRule(normalizedInput);

        if (denied) {
            await this.mailerRepository.createDispatch({
                context: normalizedInput.context,
                status: EmailDispatchStatus.suppressed_rate_limit,
                recipientEmail: normalizedInput.recipientEmail,
                recipientUserId: normalizedInput.recipientUserId,
                triggeredByUserId: normalizedInput.triggeredByUserId,
                ipAddress: normalizedInput.ipAddress,
                reason: denied.reason,
                retryAfterSeconds: denied.retryAfterSeconds,
                metadata: normalizedInput.metadata,
            });

            this.logger.warn(`mail.rate_limit context=${normalizedInput.context} reason=${denied.reason}`);
            return denied;
        }

        const created = await this.mailerRepository.createDispatchReservation({
            context: normalizedInput.context,
            status: EmailDispatchStatus.accepted,
            recipientEmail: normalizedInput.recipientEmail,
            recipientUserId: normalizedInput.recipientUserId,
            triggeredByUserId: normalizedInput.triggeredByUserId,
            ipAddress: normalizedInput.ipAddress,
            metadata: normalizedInput.metadata,
        });

        return { allowed: true, dispatchId: created.id };
    }

    async markSent(dispatchId: string): Promise<void> {
        await this.mailerRepository.markDispatchSent(dispatchId);
    }

    async markFailed(dispatchId: string, error: unknown): Promise<void> {
        const message = error instanceof Error ? error.message : String(error ?? 'mail_send_failed');
        await this.mailerRepository.markDispatchFailed(dispatchId, message);
    }

    private normalizeReserveInput(input: ReserveEmailDispatchInput): NormalizedReserveInput {
        return {
            context: input.context,
            recipientEmail: normalizeEmail(input.recipientEmail),
            recipientUserId: input.recipientUserId ?? null,
            triggeredByUserId: input.triggeredByUserId ?? null,
            ipAddress: input.ipAddress ?? null,
            metadata: input.metadata,
        };
    }

    private async findFirstDeniedRule(input: NormalizedReserveInput): Promise<(ReserveEmailDispatchResult & { allowed: false }) | null> {
        const now = Date.now();

        for (const rule of EMAIL_RATE_RULES[input.context] ?? []) {
            const scopedWhere = this.buildScopedWhere(rule.dimension, input);
            if (!scopedWhere) continue;

            const since = new Date(now - rule.windowMs);
            const where: Prisma.EmailDispatchWhereInput = {
                context: input.context,
                createdAt: { gte: since },
                status: { in: [EmailDispatchStatus.accepted, EmailDispatchStatus.sent] },
                ...scopedWhere,
            };

            const count = await this.mailerRepository.countDispatches(where);
            if (count < rule.limit) continue;

            const oldestCreatedAt = await this.mailerRepository.findOldestDispatchCreatedAt(where);

            const retryAfterMs = Math.max(1000, (oldestCreatedAt?.getTime() ?? now) + rule.windowMs - now);
            return {
                allowed: false,
                reason: `${rule.name}:${count}/${rule.limit}`,
                retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
            };
        }

        return null;
    }

    private buildScopedWhere(dimension: LimitDimension, input: NormalizedReserveInput): Prisma.EmailDispatchWhereInput | null {
        if (dimension === 'global') return {};
        if (dimension === 'recipient_email') return input.recipientEmail ? { recipientEmail: input.recipientEmail } : null;
        if (dimension === 'recipient_user') return input.recipientUserId ? { recipientUserId: input.recipientUserId } : null;
        if (dimension === 'trigger_user') return input.triggeredByUserId ? { triggeredByUserId: input.triggeredByUserId } : null;
        if (dimension === 'ip_address') return input.ipAddress ? { ipAddress: input.ipAddress } : null;
        return null;
    }
}
