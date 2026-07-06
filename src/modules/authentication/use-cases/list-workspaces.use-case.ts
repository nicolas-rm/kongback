import { Injectable } from '@nestjs/common';
import { AuthenticationRepository } from '@/modules/authentication/repositories/authentication.repository';
import { WorkspaceResponse } from '@/modules/authentication/responses';
import type { RequestUser } from '@/modules/authentication/types/request-user.interface';

type WorkspaceEntry = {
    id: string;
    name: string;
    slug: string;
    isGlobalAdmin: boolean;
    roles: Array<{ id: string; code: string; name: string }>;
};

@Injectable()
export class ListWorkspacesUseCase {
    constructor(private readonly repository: AuthenticationRepository) {}

    async execute(user: RequestUser) {
        if (user.isGlobalAdmin) {
            const organizations = await this.repository.listActiveOrganizations();
            return organizations.map((organization) => WorkspaceResponse.from({ ...organization, isGlobalAdmin: true, roles: [] }));
        }

        const accesses = await this.repository.listUserOrganizationAccesses(user.id);
        const workspaces = new Map<string, WorkspaceEntry>();

        for (const access of accesses) {
            if (!access.organization) continue;

            const workspace = workspaces.get(access.organization.id) ?? {
                id: access.organization.id,
                name: access.organization.name,
                slug: access.organization.slug,
                isGlobalAdmin: false,
                roles: [],
            };

            workspace.roles.push(access.role);
            workspaces.set(workspace.id, workspace);
        }

        return [...workspaces.values()].sort((left, right) => left.name.localeCompare(right.name)).map((workspace) => WorkspaceResponse.from(workspace));
    }
}
