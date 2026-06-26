type PermissionResponseData = {
    id: string;
    code: string;
    name: string | null;
    description: string | null;
};

export class PermissionResponse {
    constructor(
        public id: string,
        public code: string,
        public name: string | null,
        public description: string | null
    ) {}

    static from(data: PermissionResponseData): PermissionResponse {
        return new PermissionResponse(data.id, data.code, data.name, data.description);
    }
}
