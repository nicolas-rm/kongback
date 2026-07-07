export type RequestUser = {
    id: string;
    username: string;
    email: string;
    fullName?: string | null;
    preferredLanguage?: string | null;
    mustChangePassword?: boolean;
    isGlobalAdmin?: boolean;
    companyIds?: string[];
    sessionId?: string | null;
};
