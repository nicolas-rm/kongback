type WorkspaceRoleResponseData = {
    id: string;
    code: string;
    name: string;
};

type WorkspaceResponseData = {
    id: string;
    name: string;
    slug: string;
    isGlobalAdmin?: boolean;
    roles?: WorkspaceRoleResponseData[];
};

export class WorkspaceRoleResponse {
    constructor(
        public id: string,
        public code: string,
        public name: string
    ) {}

    static from(data: WorkspaceRoleResponseData): WorkspaceRoleResponse {
        return new WorkspaceRoleResponse(data.id, data.code, data.name);
    }
}

export class WorkspaceResponse {
    constructor(
        public id: string,
        public name: string,
        public slug: string,
        public isGlobalAdmin: boolean,
        public roles: WorkspaceRoleResponse[]
    ) {}

    static from(data: WorkspaceResponseData): WorkspaceResponse {
        return new WorkspaceResponse(
            data.id,
            data.name,
            data.slug,
            data.isGlobalAdmin ?? false,
            (data.roles ?? []).map((role) => WorkspaceRoleResponse.from(role))
        );
    }
}
