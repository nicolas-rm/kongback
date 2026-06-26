import { Injectable } from '@nestjs/common';
import { EmailDispatchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class MailerRepository {
    constructor(private readonly prisma: PrismaService) {}

    async countDispatches(where: Prisma.EmailDispatchWhereInput): Promise<number> {
        return this.prisma.emailDispatch.count({ where });
    }

    async findOldestDispatchCreatedAt(where: Prisma.EmailDispatchWhereInput): Promise<Date | null> {
        const dispatch = await this.prisma.emailDispatch.findFirst({
            where,
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        });

        return dispatch?.createdAt ?? null;
    }

    async createDispatch(data: Prisma.EmailDispatchUncheckedCreateInput): Promise<void> {
        await this.prisma.emailDispatch.create({ data });
    }

    async createDispatchReservation(data: Prisma.EmailDispatchUncheckedCreateInput): Promise<{ id: string }> {
        return this.prisma.emailDispatch.create({
            data,
            select: { id: true },
        });
    }

    async markDispatchSent(dispatchId: string): Promise<void> {
        await this.prisma.emailDispatch.update({
            where: { id: dispatchId },
            data: {
                status: EmailDispatchStatus.sent,
                reason: null,
                retryAfterSeconds: null,
                errorMessage: null,
            },
            select: { id: true },
        });
    }

    async markDispatchFailed(dispatchId: string, message: string): Promise<void> {
        await this.prisma.emailDispatch.update({
            where: { id: dispatchId },
            data: {
                status: EmailDispatchStatus.failed,
                errorMessage: message.slice(0, 1000),
            },
            select: { id: true },
        });
    }
}
