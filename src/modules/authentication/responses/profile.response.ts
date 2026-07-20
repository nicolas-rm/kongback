import type { Status } from '@prisma/client';

type ProfileResponseData = {
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

export class ProfileResponse {
    constructor(
        public id: string,
        public username: string,
        public email: string,
        public fullName: string | null,
        public preferredLanguage: string,
        public status: Status | null,
        public emailVerified: boolean,
        public requiresEmailVerification: boolean,
        public twoFactorEnabled: boolean,
        public mustChangePassword: boolean,
        public isGlobalAdmin: boolean,
        public companyIds: string[],
        public sessionId: string | null
    ) {}

    static from(data: ProfileResponseData): ProfileResponse {
        return new ProfileResponse(
            data.id,
            data.username,
            data.email,
            data.fullName ?? null,
            data.preferredLanguage ?? 'es',
            data.status ?? null,
            data.emailVerified ?? false,
            data.requiresEmailVerification ?? false,
            data.twoFactorEnabled ?? false,
            data.mustChangePassword ?? false,
            data.isGlobalAdmin ?? false,
            data.companyIds ?? [],
            data.sessionId ?? null
        );
    }
}

export class UpdateProfileResponse {
    constructor(
        public id: string,
        public username: string,
        public email: string,
        public fullName: string,
        public preferredLanguage: string
    ) {}

    static from(data: { id: string; username: string; email: string; fullName: string; preferredLanguage: string }): UpdateProfileResponse {
        return new UpdateProfileResponse(data.id, data.username, data.email, data.fullName, data.preferredLanguage);
    }
}
