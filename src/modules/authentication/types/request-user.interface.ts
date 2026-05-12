export type RequestUser = {
    id: string;
    username: string;
    email?: string | null;
    fullName?: string | null;
    mustChangePassword?: boolean;
    isGlobalAdmin?: boolean;
    organizationIds?: string[];
    permissions?: string[];
    sessionId?: string | null;
};
