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

    findLoginUser(identifier: string) {
        return this.prisma.user.findFirst({
            where: {
                deletedAt: null,
                OR: [{ username: identifier }, { email: { equals: identifier, mode: 'insensitive' } }],
            },
            select: {
                id: true,
                username: true,
                email: true,
                fullName: true,
                passwordHash: true,
                status: true,
                mustChangePassword: true,
                failedLoginAttempts: true,
                lockedUntil: true,
            },
        });
    }

    resetLoginState(userId: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
    }

    updateFailedLoginState(userId: string, failedLoginAttempts: number, lockedUntil: Date | null) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { failedLoginAttempts, lockedUntil },
        });
    }

    findStoredRefreshToken(tokenHash: string) {
        return this.prisma.refreshToken.findFirst({
            where: { tokenHash, revokedAt: null },
            select: {
                id: true,
                userId: true,
                sessionId: true,
                expiresAt: true,
                idleExpiresAt: true,
                user: { select: { id: true, username: true, email: true, fullName: true, status: true } },
            },
        });
    }

    revokeRefreshToken(id: string, revokedAt = new Date()) {
        return this.prisma.refreshToken.update({
            where: { id },
            data: { revokedAt },
        });
    }

    revokeUserRefreshTokens(userId: string, revokedAt = new Date()) {
        return this.prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt },
        });
    }

    listActiveSessions(userId: string) {
        return this.prisma.session.findMany({
            where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { lastActivityAt: 'desc' },
            select: {
                id: true,
                userAgent: true,
                ipAddress: true,
                deviceName: true,
                lastActivityAt: true,
                expiresAt: true,
                createdAt: true,
            },
        });
    }

    findUserForPasswordChange(userId: string) {
        return this.prisma.user.findFirst({
            where: { id: userId, deletedAt: null, status: 'active' },
            select: { id: true, username: true, passwordHash: true },
        });
    }

    updatePassword(userId: string, passwordHash: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash, mustChangePassword: false },
        });
    }

    findUserByEmail(email: string) {
        return this.prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null, status: 'active' },
            select: { id: true, email: true },
        });
    }

    createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
        return this.prisma.passwordResetToken.create({
            data: { userId, tokenHash, expiresAt },
            select: { id: true },
        });
    }

    findPasswordResetToken(tokenHash: string) {
        return this.prisma.passwordResetToken.findFirst({
            where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
            select: { id: true, userId: true },
        });
    }

    markPasswordResetTokenUsed(id: string, usedAt = new Date()) {
        return this.prisma.passwordResetToken.update({
            where: { id },
            data: { usedAt },
        });
    }

    findTwoFactorUser(userId: string) {
        return this.prisma.user.findFirst({
            where: { id: userId, deletedAt: null, status: 'active' },
            select: {
                id: true,
                username: true,
                email: true,
                twoFactorEnabled: true,
                twoFactorSecret: true,
                twoFactorPendingSecret: true,
                twoFactorPendingCreatedAt: true,
            },
        });
    }

    setPendingTwoFactorSecret(userId: string, encryptedSecret: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorPendingSecret: encryptedSecret,
                twoFactorPendingCreatedAt: new Date(),
            },
        });
    }

    enableTwoFactor(userId: string, encryptedSecret: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorEnabled: true,
                twoFactorSecret: encryptedSecret,
                twoFactorPendingSecret: null,
                twoFactorPendingCreatedAt: null,
                twoFactorConfirmedAt: new Date(),
            },
        });
    }

    disableTwoFactor(userId: string) {
        return this.prisma.$transaction(async (tx) => {
            await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
            return tx.user.update({
                where: { id: userId },
                data: {
                    twoFactorEnabled: false,
                    twoFactorSecret: null,
                    twoFactorPendingSecret: null,
                    twoFactorPendingCreatedAt: null,
                    twoFactorConfirmedAt: null,
                },
            });
        });
    }

    replaceRecoveryCodes(userId: string, codeHashes: string[]) {
        return this.prisma.$transaction(async (tx) => {
            await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
            if (codeHashes.length > 0) {
                await tx.twoFactorRecoveryCode.createMany({
                    data: codeHashes.map((codeHash) => ({ userId, codeHash })),
                });
            }
        });
    }
}
