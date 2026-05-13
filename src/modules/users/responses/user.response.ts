import { UserStatus } from '@prisma/client';

type UserResponseData = {
    id: string;
    username: string;
    email: string | null;
    fullName: string;
    preferredLanguage: string;
    status: UserStatus;
    mustChangePassword: boolean;
    emailVerifiedAt: Date | null;
    twoFactorEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export class UserResponse {
    constructor(
        public id: string,
        public username: string,
        public email: string | null,
        public fullName: string,
        public preferredLanguage: string,
        public status: UserStatus,
        public mustChangePassword: boolean,
        public emailVerifiedAt: Date | null,
        public twoFactorEnabled: boolean,
        public createdAt: Date,
        public updatedAt: Date
    ) {}

    static from(data: UserResponseData): UserResponse {
        return new UserResponse(data.id, data.username, data.email, data.fullName, data.preferredLanguage, data.status, data.mustChangePassword, data.emailVerifiedAt, data.twoFactorEnabled, data.createdAt, data.updatedAt);
    }
}
