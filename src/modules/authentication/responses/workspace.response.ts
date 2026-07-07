type WorkspaceRoleResponseData = {
    id: string;
    code: string;
    name: string;
};

type WorkspaceCompanyResponseData = {
    id: string;
    key: string;
    name: string;
};

type WorkspaceResponseData = {
    id: string;
    name: string;
    slug: string;
    isGlobalAdmin?: boolean;
    roles?: WorkspaceRoleResponseData[];
    companies?: WorkspaceCompanyResponseData[];
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
        public roles: WorkspaceRoleResponse[],
        public companies: WorkspaceCompanyResponse[]
    ) {}

    static from(data: WorkspaceResponseData): WorkspaceResponse {
        return new WorkspaceResponse(
            data.id,
            data.name,
            data.slug,
            data.isGlobalAdmin ?? false,
            (data.roles ?? []).map((role) => WorkspaceRoleResponse.from(role)),
            (data.companies ?? []).map((company) => WorkspaceCompanyResponse.from(company))
        );
    }
}

export class WorkspaceCompanyResponse {
    constructor(
        public id: string,
        public key: string,
        public name: string
    ) {}

    static from(data: WorkspaceCompanyResponseData): WorkspaceCompanyResponse {
        return new WorkspaceCompanyResponse(data.id, data.key, data.name);
    }
}
