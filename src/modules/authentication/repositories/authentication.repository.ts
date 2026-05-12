import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export type AuthenticatedUserRecord = Awaited<ReturnType<AuthenticationRepository['findActiveUserForRequest']>>;

export type CreateSessionInput = {
    userId: string;
    organizationId?: string | null;
    expiresAt: Date;
    idleExpiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
    deviceName?: string | null;
};

export type CreateRefreshTokenInput = {
    userId: string;
    sessionId: string;
    tokenHash: string;
    expiresAt: Date;
    idleExpiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
};

@Injectable()
export class AuthenticationRepository {
    constructor(private readonly prisma: PrismaService) {}

    findActiveUserForRequest(userId: string) {
        return this.prisma.user.findFirst({
            where: {
                id: userId,
                deletedAt: null,
                status: 'active',
            },
            select: {
                id: true,
                username: true,
                email: true,
                fullName: true,
                mustChangePassword: true,
                accesses: {
                    where: { deletedAt: null, role: { deletedAt: null } },
                    select: {
                        organizationId: true,
                        role: {
                            select: {
                                code: true,
                                permissions: {
                                    where: { permission: { deletedAt: null } },
                                    select: { permission: { select: { code: true } } },
                                },
                            },
                        },
                    },
                },
            },
        });
    }

    createSession(input: CreateSessionInput) {
        return this.prisma.session.create({
            data: {
                userId: input.userId,
                organizationId: input.organizationId ?? null,
                expiresAt: input.expiresAt,
                idleExpiresAt: input.idleExpiresAt,
                userAgent: input.userAgent ?? null,
                ipAddress: input.ipAddress ?? null,
                deviceName: input.deviceName ?? null,
            },
            select: { id: true },
        });
    }

    createRefreshToken(input: CreateRefreshTokenInput) {
        return this.prisma.refreshToken.create({
            data: {
                userId: input.userId,
                sessionId: input.sessionId,
                tokenHash: input.tokenHash,
                expiresAt: input.expiresAt,
                idleExpiresAt: input.idleExpiresAt,
                userAgent: input.userAgent ?? null,
                ipAddress: input.ipAddress ?? null,
            },
            select: { id: true },
        });
    }
}
