type UserAccessResponseData = {
    id: string;
    organizationId: string | null;
    scopeKey: string | null;
    scopeId: string | null;
    assignedAt: Date;
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
        public organizationId: string | null,
        public scopeKey: string | null,
        public scopeId: string | null,
        public assignedAt: Date,
        public role: UserAccessRoleResponse
    ) {}

    static from(data: UserAccessResponseData): UserAccessResponse {
        return new UserAccessResponse(data.id, data.organizationId, data.scopeKey, data.scopeId, data.assignedAt, UserAccessRoleResponse.from(data.role));
    }
}
