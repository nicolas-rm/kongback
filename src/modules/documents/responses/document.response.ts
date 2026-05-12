type DocumentResponseData = {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    organizationId: string | null;
    entityType: string | null;
    entityId: string | null;
    scopeKey: string | null;
    scopeId: string | null;
    originalName: string;
    mimeType: string;
    extension: string | null;
    sizeBytes: number;
    uploadedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export class DocumentResponse {
    constructor(
        public id: string,
        public title: string,
        public description: string | null,
        public category: string | null,
        public organizationId: string | null,
        public entityType: string | null,
        public entityId: string | null,
        public scopeKey: string | null,
        public scopeId: string | null,
        public originalName: string,
        public mimeType: string,
        public extension: string | null,
        public sizeBytes: number,
        public uploadedByUserId: string | null,
        public createdAt: Date,
        public updatedAt: Date
    ) {}

    static from(data: DocumentResponseData): DocumentResponse {
        return new DocumentResponse(
            data.id,
            data.title,
            data.description,
            data.category,
            data.organizationId,
            data.entityType,
            data.entityId,
            data.scopeKey,
            data.scopeId,
            data.originalName,
            data.mimeType,
            data.extension,
            data.sizeBytes,
            data.uploadedByUserId,
            data.createdAt,
            data.updatedAt
        );
    }
}
