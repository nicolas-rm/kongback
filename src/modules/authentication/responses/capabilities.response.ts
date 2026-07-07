type CapabilitiesResponseData = {
    organizationId: string;
    isGlobalAdmin?: boolean;
    permissions?: string[];
};

export class CapabilitiesResponse {
    constructor(
        public organizationId: string,
        public isGlobalAdmin: boolean,
        public permissions: string[]
    ) {}

    static from(data: CapabilitiesResponseData): CapabilitiesResponse {
        return new CapabilitiesResponse(data.organizationId, data.isGlobalAdmin ?? false, data.permissions ?? []);
    }
}
