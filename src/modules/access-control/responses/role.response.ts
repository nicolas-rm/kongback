import { PermissionResponse } from '@/modules/access-control/responses/permission.response';

type RoleResponseData = {
    id: string;
    code: string;
    name: string;
    description: string | null;
};

type RoleWithPermissionsResponseData = RoleResponseData & {
    permissions: Array<{ permission: Parameters<typeof PermissionResponse.from>[0] }>;
};

export class RoleResponse {
    constructor(
        public id: string,
        public code: string,
        public name: string,
        public description: string | null
    ) {}

    static from(data: RoleResponseData): RoleResponse {
        return new RoleResponse(data.id, data.code, data.name, data.description);
    }
}

export class RoleWithPermissionsResponse extends RoleResponse {
    constructor(
        id: string,
        code: string,
        name: string,
        description: string | null,
        public permissions: PermissionResponse[]
    ) {
        super(id, code, name, description);
    }

    static from(data: RoleWithPermissionsResponseData): RoleWithPermissionsResponse {
        return new RoleWithPermissionsResponse(
            data.id,
            data.code,
            data.name,
            data.description,
            data.permissions.map((entry) => PermissionResponse.from(entry.permission))
        );
    }
}
