type CapabilitiesResponseData = {
    companyId?: string;
    isGlobalAdmin?: boolean;
    permissions?: string[];
};

export class CapabilitiesResponse {
    constructor(
        public companyId: string | null,
        public isGlobalAdmin: boolean,
        public permissions: string[]
    ) {}

    static from(data: CapabilitiesResponseData): CapabilitiesResponse {
        return new CapabilitiesResponse(data.companyId ?? null, data.isGlobalAdmin ?? false, data.permissions ?? []);
    }
}
