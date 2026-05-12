type PermissionResponseData = {
    id: string;
    code: string;
    name: string | null;
    description: string | null;
    createdAt?: Date;
    updatedAt?: Date;
};

export class PermissionResponse {
    constructor(
        public id: string,
        public code: string,
        public name: string | null,
        public description: string | null,
        public createdAt?: Date,
        public updatedAt?: Date
    ) {}

    static from(data: PermissionResponseData): PermissionResponse {
        return new PermissionResponse(data.id, data.code, data.name, data.description, data.createdAt, data.updatedAt);
    }
}
