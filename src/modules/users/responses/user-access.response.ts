type UserAccessResponseData = {
    id: string;
    companyId: string | null;
    scopeKey: string | null;
    scopeId: string | null;
    role: {
        id: string;
        code: string;
        name: string;
    };
};

export class UserAccessRoleResponse {
    constructor(
        public id: string,
        public code: string,
        public name: string
    ) {}

    static from(data: UserAccessResponseData['role']): UserAccessRoleResponse {
        return new UserAccessRoleResponse(data.id, data.code, data.name);
    }
}

export class UserAccessResponse {
    constructor(
        public id: string,
        public companyId: string | null,
        public scopeKey: string | null,
        public scopeId: string | null,
        public role: UserAccessRoleResponse
    ) {}

    static from(data: UserAccessResponseData): UserAccessResponse {
        return new UserAccessResponse(data.id, data.companyId, data.scopeKey, data.scopeId, UserAccessRoleResponse.from(data.role));
    }
}
