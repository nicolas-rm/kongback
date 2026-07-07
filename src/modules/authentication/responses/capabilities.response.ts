type CapabilitiesResponseData = {
    organizationId: string;
    companyId?: string;
    isGlobalAdmin?: boolean;
    permissions?: string[];
};

export class CapabilitiesResponse {
    constructor(
        public organizationId: string,
        public companyId: string | null,
        public isGlobalAdmin: boolean,
        public permissions: string[]
    ) {}

    static from(data: CapabilitiesResponseData): CapabilitiesResponse {
        return new CapabilitiesResponse(data.organizationId, data.companyId ?? null, data.isGlobalAdmin ?? false, data.permissions ?? []);
    }
}
