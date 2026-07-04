type ProfileResponseData = {
    id: string;
    username: string;
    email: string;
    fullName?: string | null;
    preferredLanguage?: string | null;
    mustChangePassword?: boolean;
    isGlobalAdmin?: boolean;
    organizationIds?: string[];
    permissions?: string[];
};

export class ProfileResponse {
    constructor(
        public id: string,
        public username: string,
        public email: string,
        public fullName: string | null,
        public preferredLanguage: string,
        public mustChangePassword: boolean,
        public isGlobalAdmin: boolean,
        public organizationIds: string[],
        public permissions: string[]
    ) {}

    static from(data: ProfileResponseData): ProfileResponse {
        return new ProfileResponse(
            data.id,
            data.username,
            data.email,
            data.fullName ?? null,
            data.preferredLanguage ?? 'es',
            data.mustChangePassword ?? false,
            data.isGlobalAdmin ?? false,
            data.organizationIds ?? [],
            data.permissions ?? []
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
