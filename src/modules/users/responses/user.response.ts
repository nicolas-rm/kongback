import { Status } from '@prisma/client';

type UserResponseData = {
    id: string;
    username: string;
    email: string;
    fullName: string;
    preferredLanguage: string;
    status: Status;
    mustChangePassword: boolean;
    emailVerifiedAt: Date | null;
    twoFactorEnabled: boolean;
};

export class UserResponse {
    constructor(
        public id: string,
        public username: string,
        public email: string,
        public fullName: string,
        public preferredLanguage: string,
        public status: Status,
        public mustChangePassword: boolean,
        public emailVerified: boolean,
        public twoFactorEnabled: boolean
    ) {}

    static from(data: UserResponseData): UserResponse {
        return new UserResponse(data.id, data.username, data.email, data.fullName, data.preferredLanguage, data.status, data.mustChangePassword, Boolean(data.emailVerifiedAt), data.twoFactorEnabled);
    }
}
