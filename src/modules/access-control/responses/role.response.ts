import { PermissionResponse } from '@/modules/access-control/responses/permission.response';

type RoleResponseData = {
    id: string;
    code: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
};

type RoleWithPermissionsResponseData = RoleResponseData & {
    permissions: Array<{ permission: Parameters<typeof PermissionResponse.from>[0] }>;
};

export class RoleResponse {
    constructor(
        public id: string,
        public code: string,
        public name: string,
        public description: string | null,
        public createdAt: Date,
        public updatedAt: Date
    ) {}

    static from(data: RoleResponseData): RoleResponse {
        return new RoleResponse(data.id, data.code, data.name, data.description, data.createdAt, data.updatedAt);
    }
}

export class RoleWithPermissionsResponse extends RoleResponse {
    constructor(
        id: string,
        code: string,
        name: string,
        description: string | null,
        createdAt: Date,
        updatedAt: Date,
        public permissions: PermissionResponse[]
    ) {
        super(id, code, name, description, createdAt, updatedAt);
    }

    static from(data: RoleWithPermissionsResponseData): RoleWithPermissionsResponse {
        return new RoleWithPermissionsResponse(
            data.id,
            data.code,
            data.name,
            data.description,
            data.createdAt,
            data.updatedAt,
            data.permissions.map((entry) => PermissionResponse.from(entry.permission))
        );
    }
}
