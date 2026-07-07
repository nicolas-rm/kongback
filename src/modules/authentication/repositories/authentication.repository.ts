import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { buildActiveUserAccessWhere } from '@/utilities/authentication/active-user-access-filter';

export type AuthenticatedUserRecord = Awaited<ReturnType<AuthenticationRepository['findActiveUserForRequest']>>;

export type CreateSessionInput = {
    userId: string;
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
                status: 'active',
            },
            select: {
                id: true,
                username: true,
                email: true,
                fullName: true,
                preferredLanguage: true,
                mustChangePassword: true,
                accesses: {
                    where: buildActiveUserAccessWhere({}),
                    select: {
                        companyId: true,
                        role: {
                            select: {
                                code: true,
                            },
                        },
                    },
                },
            },
        });
    }

    findActiveSession(sessionId: string) {
        return this.prisma.session.findFirst({
            where: {
                id: sessionId,
                revokedAt: null,
                expiresAt: { gt: new Date() },
                idleExpiresAt: { gt: new Date() },
            },
            select: { id: true, userId: true, lastActivityAt: true },
        });
    }

    createSession(input: CreateSessionInput) {
        return this.prisma.session.create({
            data: {
                userId: input.userId,
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

    async enforceActiveSessionLimit(userId: string, keepSessionId: string, maxActiveSessions: number, revokedAt = new Date()) {
        if (maxActiveSessions < 1) return { count: 0 };

        const activeSessions = await this.prisma.session.findMany({
            where: { userId, revokedAt: null, expiresAt: { gt: revokedAt } },
            orderBy: { lastActivityAt: 'asc' },
            select: { id: true },
        });
        const revokeCount = activeSessions.length - maxActiveSessions;
        if (revokeCount <= 0) return { count: 0 };

        const sessionIds = activeSessions
            .filter((session) => session.id !== keepSessionId)
            .slice(0, revokeCount)
            .map((session) => session.id);
        if (sessionIds.length === 0) return { count: 0 };

        return this.prisma.$transaction(async (tx) => {
            const result = await tx.session.updateMany({
                where: { id: { in: sessionIds }, userId, revokedAt: null },
                data: { revokedAt },
            });
            await tx.refreshToken.updateMany({
                where: { sessionId: { in: sessionIds }, revokedAt: null },
                data: { revokedAt },
            });
            return result;
        });
    }

    findLoginUser(identifier: string) {
        return this.prisma.user.findFirst({
            where: {
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
                twoFactorEnabled: true,
                twoFactorSecret: true,
                requiresEmailVerification: true,
                emailVerifiedAt: true,
            },
        });
    }

    resetLoginState(userId: string) {
        return this.prisma.user.updateMany({
            where: { id: userId, status: 'active' },
            data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
    }

    updateFailedLoginState(userId: string, failedLoginAttempts: number, lockedUntil: Date | null) {
        return this.prisma.user.updateMany({
            where: { id: userId, status: 'active' },
            data: { failedLoginAttempts, lockedUntil },
        });
    }

    findStoredRefreshToken(tokenHash: string) {
        return this.prisma.refreshToken.findFirst({
            where: { tokenHash, user: { status: 'active' } },
            select: {
                id: true,
                userId: true,
                sessionId: true,
                expiresAt: true,
                idleExpiresAt: true,
                revokedAt: true,
                user: { select: { id: true, username: true, email: true, fullName: true, status: true } },
                session: { select: { id: true, revokedAt: true, expiresAt: true, idleExpiresAt: true } },
            },
        });
    }

    touchSession(sessionId: string, idleExpiresAt: Date, touchedAt = new Date()) {
        return this.prisma.$transaction(async (tx) => {
            await tx.session.update({
                where: { id: sessionId },
                data: { lastActivityAt: touchedAt, idleExpiresAt },
                select: { id: true },
            });
            await tx.refreshToken.updateMany({
                where: { sessionId, revokedAt: null },
                data: { lastActivityAt: touchedAt, idleExpiresAt },
            });
        });
    }

    revokeRefreshToken(id: string, revokedAt = new Date()) {
        return this.prisma.refreshToken.update({
            where: { id },
            data: { revokedAt },
            select: { id: true },
        });
    }

    revokeUserRefreshTokens(userId: string, revokedAt = new Date()) {
        return this.prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt },
        });
    }

    revokeUserSessions(userId: string, revokedAt = new Date()) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.session.updateMany({
                where: { userId, revokedAt: null },
                data: { revokedAt },
            });

            await tx.refreshToken.updateMany({
                where: { userId, revokedAt: null },
                data: { revokedAt },
            });

            return result;
        });
    }

    revokeSession(userId: string, sessionId: string, revokedAt = new Date()) {
        return this.prisma.$transaction(async (tx) => {
            const session = await tx.session.findFirst({
                where: { id: sessionId, userId, revokedAt: null },
                select: { id: true },
            });

            if (!session) return { count: 0 };

            await tx.session.update({
                where: { id: session.id },
                data: { revokedAt },
                select: { id: true },
            });

            await tx.refreshToken.updateMany({
                where: { sessionId: session.id, revokedAt: null },
                data: { revokedAt },
            });

            return { count: 1 };
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
            },
        });
    }

    listActiveCompanies() {
        return this.prisma.company.findMany({
            where: { status: 'active' },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                key: true,
                name: true,
            },
        });
    }

    listUserCompanyAccesses(userId: string) {
        return this.prisma.userAccess.findMany({
            where: { userId, companyId: { not: null }, company: { status: 'active' } },
            orderBy: { assignedAt: 'asc' },
            select: {
                role: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                    },
                },
                company: {
                    select: {
                        id: true,
                        key: true,
                        name: true,
                    },
                },
            },
        });
    }

    findUserForPasswordChange(userId: string) {
        return this.prisma.user.findFirst({
            where: { id: userId, status: 'active' },
            select: { id: true, username: true, passwordHash: true },
        });
    }

    updatePassword(userId: string, passwordHash: string) {
        return this.prisma.user.updateMany({
            where: { id: userId, status: 'active' },
            data: { passwordHash, mustChangePassword: false },
        });
    }

    updateProfile(userId: string, data: { email?: string; fullName?: string; preferredLanguage?: string }) {
        return this.prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                username: true,
                email: true,
                fullName: true,
                preferredLanguage: true,
            },
        });
    }

    createUser(data: { username: string; email: string; fullName: string; passwordHash: string; requiresEmailVerification: boolean }) {
        return this.prisma.user.create({
            data: {
                username: data.username,
                email: data.email,
                fullName: data.fullName,
                passwordHash: data.passwordHash,
                requiresEmailVerification: data.requiresEmailVerification,
            },
            select: { id: true, username: true, email: true, fullName: true },
        });
    }

    findUserByEmail(email: string) {
        return this.prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' }, status: 'active' },
            select: { id: true, email: true },
        });
    }

    createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
        return this.prisma.passwordResetToken.create({
            data: { userId, tokenHash, expiresAt },
            select: { id: true },
        });
    }

    createEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date) {
        return this.prisma.emailVerificationToken.create({
            data: { userId, tokenHash, expiresAt },
            select: { id: true },
        });
    }

    findEmailVerificationToken(tokenHash: string) {
        return this.prisma.emailVerificationToken.findFirst({
            where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() }, user: { status: 'active' } },
            select: { id: true, userId: true },
        });
    }

    verifyEmail(tokenId: string, userId: string, usedAt = new Date()) {
        return this.prisma.$transaction(async (tx) => {
            await tx.emailVerificationToken.update({
                where: { id: tokenId },
                data: { usedAt },
                select: { id: true },
            });
            return tx.user.updateMany({
                where: { id: userId, status: 'active' },
                data: { emailVerifiedAt: usedAt, requiresEmailVerification: false },
            });
        });
    }

    findPasswordResetToken(tokenHash: string) {
        return this.prisma.passwordResetToken.findFirst({
            where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() }, user: { status: 'active' } },
            select: { id: true, userId: true },
        });
    }

    markPasswordResetTokenUsed(id: string, usedAt = new Date()) {
        return this.prisma.passwordResetToken.update({
            where: { id },
            data: { usedAt },
            select: { id: true },
        });
    }

    findTwoFactorUser(userId: string) {
        return this.prisma.user.findFirst({
            where: { id: userId, status: 'active' },
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
            select: { id: true },
        });
    }

    clearPendingTwoFactorSecret(userId: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorPendingSecret: null,
                twoFactorPendingCreatedAt: null,
            },
            select: { id: true },
        });
    }

    createTwoFactorLoginChallenge(input: { userId: string; challengeHash: string; expiresAt: Date; userAgent?: string | null; ipAddress?: string | null }) {
        return this.prisma.twoFactorLoginChallenge.create({
            data: {
                userId: input.userId,
                challengeHash: input.challengeHash,
                expiresAt: input.expiresAt,
                userAgent: input.userAgent ?? null,
                ipAddress: input.ipAddress ?? null,
            },
            select: { id: true },
        });
    }

    findTwoFactorLoginChallenge(challengeHash: string) {
        return this.prisma.twoFactorLoginChallenge.findFirst({
            where: { challengeHash, consumedAt: null, expiresAt: { gt: new Date() }, user: { status: 'active' } },
            select: {
                id: true,
                userId: true,
                attemptCount: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        twoFactorEnabled: true,
                        twoFactorSecret: true,
                        status: true,
                    },
                },
            },
        });
    }

    incrementTwoFactorChallengeAttempt(id: string) {
        return this.prisma.twoFactorLoginChallenge.update({
            where: { id },
            data: { attemptCount: { increment: 1 } },
            select: { id: true },
        });
    }

    consumeTwoFactorChallenge(id: string, consumedAt = new Date()) {
        return this.prisma.twoFactorLoginChallenge.update({
            where: { id },
            data: { consumedAt },
            select: { id: true },
        });
    }

    consumeTwoFactorRecoveryCode(userId: string, codeHashes: string[], usedAt = new Date()) {
        return this.prisma.twoFactorRecoveryCode.updateMany({
            where: { userId, codeHash: { in: codeHashes }, usedAt: null },
            data: { usedAt },
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
            select: { id: true },
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
                select: { id: true },
            });
        });
    }

    resetTwoFactor(userId: string) {
        return this.disableTwoFactor(userId);
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
