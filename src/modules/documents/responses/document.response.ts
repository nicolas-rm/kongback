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
    sizeBytes: number;
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
        public sizeBytes: number
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
            data.sizeBytes
        );
    }
}
