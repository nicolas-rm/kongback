import { SessionResponse } from '@/modules/authentication/responses/session.response';

type ProfileResponseData = {
    id: string;
    username: string;
    email?: string | null;
    fullName?: string | null;
    preferredLanguage?: string | null;
    mustChangePassword?: boolean;
    isGlobalAdmin?: boolean;
    organizationIds?: string[];
    permissions?: string[];
    session?: SessionResponse | null;
};

export class ProfileResponse {
    constructor(
        public id: string,
        public username: string,
        public email: string | null,
        public fullName: string | null,
        public preferredLanguage: string,
        public mustChangePassword: boolean,
        public isGlobalAdmin: boolean,
        public organizationIds: string[],
        public permissions: string[],
        public session: SessionResponse | null
    ) {}

    static from(data: ProfileResponseData): ProfileResponse {
        return new ProfileResponse(
            data.id,
            data.username,
            data.email ?? null,
            data.fullName ?? null,
            data.preferredLanguage ?? 'es',
            data.mustChangePassword ?? false,
            data.isGlobalAdmin ?? false,
            data.organizationIds ?? [],
            data.permissions ?? [],
            data.session ?? null
        );
    }
}

export class UpdateProfileResponse {
    constructor(
        public id: string,
        public username: string,
        public email: string | null,
        public fullName: string,
        public preferredLanguage: string,
        public updatedAt: Date
    ) {}

    static from(data: { id: string; username: string; email: string | null; fullName: string; preferredLanguage: string; updatedAt: Date }): UpdateProfileResponse {
        return new UpdateProfileResponse(data.id, data.username, data.email, data.fullName, data.preferredLanguage, data.updatedAt);
    }
}
