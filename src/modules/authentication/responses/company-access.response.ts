type CompanyAccessRoleResponseData = {
    id: string;
    code: string;
    name: string;
};

type CompanyAccessResponseData = {
    id: string;
    key: string;
    name: string;
    isGlobalAdmin?: boolean;
    roles?: CompanyAccessRoleResponseData[];
};

export class CompanyAccessRoleResponse {
    constructor(
        public id: string,
        public code: string,
        public name: string
    ) {}

    static from(data: CompanyAccessRoleResponseData): CompanyAccessRoleResponse {
        return new CompanyAccessRoleResponse(data.id, data.code, data.name);
    }
}

export class CompanyAccessResponse {
    constructor(
        public id: string,
        public key: string,
        public name: string,
        public isGlobalAdmin: boolean,
        public roles: CompanyAccessRoleResponse[]
    ) {}

    static from(data: CompanyAccessResponseData): CompanyAccessResponse {
        return new CompanyAccessResponse(
            data.id,
            data.key,
            data.name,
            data.isGlobalAdmin ?? false,
            (data.roles ?? []).map((role) => CompanyAccessRoleResponse.from(role))
        );
    }
}
