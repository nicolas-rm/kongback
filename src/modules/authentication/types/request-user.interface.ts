import type { Status } from '@prisma/client';

export type RequestUser = {
    id: string;
    username: string;
    email: string;
    fullName?: string | null;
    preferredLanguage?: string | null;
    status?: Status;
    emailVerified?: boolean;
    requiresEmailVerification?: boolean;
    twoFactorEnabled?: boolean;
    mustChangePassword?: boolean;
    isGlobalAdmin?: boolean;
    companyIds?: string[];
    sessionId?: string | null;
};
