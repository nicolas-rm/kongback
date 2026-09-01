type TrustedDeviceResponseData = {
    id: string;
    deviceName: string | null;
    platform: string | null;
    userAgent: string | null;
    ipAddress: string | null;
    lastUsedAt: Date | null;
    expiresAt: Date;
    createdAt: Date;
};

export class TrustedDeviceResponse {
    constructor(
        public id: string,
        public deviceName: string | null,
        public platform: string | null,
        public userAgent: string | null,
        public ipAddress: string | null,
        public lastUsedAt: Date | null,
        public expiresAt: Date,
        public createdAt: Date
    ) {}

    static from(data: TrustedDeviceResponseData): TrustedDeviceResponse {
        return new TrustedDeviceResponse(data.id, data.deviceName, data.platform, data.userAgent, data.ipAddress, data.lastUsedAt, data.expiresAt, data.createdAt);
    }
}

export class RevokeTrustedDeviceResponse {
    constructor(
        public id: string,
        public revoked: boolean
    ) {}

    static from(data: { id: string; revoked: boolean }): RevokeTrustedDeviceResponse {
        return new RevokeTrustedDeviceResponse(data.id, data.revoked);
    }
}
