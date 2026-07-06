import { Status } from '@prisma/client';

type OrganizationResponseData = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: Status;
};

type OrganizationMemberResponseData = {
    id: string;
    user: {
        id: string;
        username: string;
        email: string;
        fullName: string;
        status: Status;
    };
};

export class OrganizationResponse {
    constructor(
        public id: string,
        public name: string,
        public slug: string,
        public description: string | null,
        public status: Status
    ) {}

    static from(data: OrganizationResponseData): OrganizationResponse {
        return new OrganizationResponse(data.id, data.name, data.slug, data.description, data.status);
    }
}

export class OrganizationMemberUserResponse {
    constructor(
        public id: string,
        public username: string,
        public email: string,
        public fullName: string,
        public status: Status
    ) {}

    static from(data: OrganizationMemberResponseData['user']): OrganizationMemberUserResponse {
        return new OrganizationMemberUserResponse(data.id, data.username, data.email, data.fullName, data.status);
    }
}

export class OrganizationMemberResponse {
    constructor(
        public id: string,
        public user: OrganizationMemberUserResponse
    ) {}

    static from(data: OrganizationMemberResponseData): OrganizationMemberResponse {
        return new OrganizationMemberResponse(data.id, OrganizationMemberUserResponse.from(data.user));
    }
}
