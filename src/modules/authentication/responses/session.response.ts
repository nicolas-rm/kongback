type SessionResponseData = {
    id: string;
    deviceName: string | null;
    userAgent: string | null;
    ipAddress: string | null;
    lastActivityAt: Date;
    expiresAt: Date;
    isCurrent: boolean;
};

export class SessionResponse {
    constructor(
        public id: string,
        public deviceName: string | null,
        public userAgent: string | null,
        public ipAddress: string | null,
        public lastActivityAt: Date,
        public expiresAt: Date,
        public isCurrent: boolean
    ) {}

    static from(data: SessionResponseData): SessionResponse {
        return new SessionResponse(data.id, data.deviceName, data.userAgent, data.ipAddress, data.lastActivityAt, data.expiresAt, data.isCurrent);
    }
}

export class RevokeSessionResponse {
    constructor(
        public id: string,
        public revoked: boolean,
        public revokedCurrent: boolean
    ) {}

    static from(data: { id: string; revoked: boolean; revokedCurrent: boolean }): RevokeSessionResponse {
        return new RevokeSessionResponse(data.id, data.revoked, data.revokedCurrent);
    }
}
