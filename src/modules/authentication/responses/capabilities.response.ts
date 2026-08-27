import { MODULE_CAPABILITIES, SIDEBAR_CAPABILITIES, type CapabilityRequirement } from '@/modules/authentication/capabilities/capabilities-map';

type CapabilitiesResponseData = {
    companyId?: string;
    isGlobalAdmin?: boolean;
    permissions?: string[];
};

type SidebarCapabilities = Record<
    string,
    {
        canEnter: boolean;
        label: string;
        path: string;
        section: string;
    }
>;

type ModuleCapabilities = Record<
    string,
    {
        canEnter: boolean;
        permissions: string[];
        actions: Record<string, boolean>;
    }
>;

export class CapabilitiesResponse {
    constructor(
        public companyId: string | null,
        public isGlobalAdmin: boolean,
        public permissions: string[],
        public sidebar: SidebarCapabilities,
        public modules: ModuleCapabilities
    ) {}

    static from(data: CapabilitiesResponseData): CapabilitiesResponse {
        const permissions = data.permissions ?? [];
        const permissionSet = new Set(permissions);
        return new CapabilitiesResponse(data.companyId ?? null, data.isGlobalAdmin ?? false, permissions, this.sidebar(permissionSet), this.modules(permissionSet, permissions));
    }

    private static sidebar(permissionSet: Set<string>): SidebarCapabilities {
        return Object.fromEntries(
            Object.entries(SIDEBAR_CAPABILITIES).map(([key, definition]) => [
                key,
                {
                    canEnter: this.allowed(definition, permissionSet),
                    label: definition.label,
                    path: definition.path,
                    section: definition.section,
                },
            ])
        );
    }

    private static modules(permissionSet: Set<string>, permissions: string[]): ModuleCapabilities {
        return Object.fromEntries(
            Object.entries(MODULE_CAPABILITIES).map(([key, definition]) => [
                key,
                {
                    canEnter: this.allowed(definition.canEnter, permissionSet),
                    permissions: permissions.filter((permission) => (definition.permissions as readonly string[]).includes(permission)),
                    actions: Object.fromEntries(Object.entries(definition.actions).map(([action, requirement]) => [action, this.allowed(requirement, permissionSet)])),
                },
            ])
        );
    }

    private static allowed(requirement: CapabilityRequirement, permissionSet: Set<string>): boolean {
        if (requirement.authenticated) return true;
        if (requirement.all?.length && !requirement.all.every((permission) => permissionSet.has(permission))) return false;
        if (requirement.any?.length && !requirement.any.some((permission) => permissionSet.has(permission))) return false;
        return Boolean(requirement.all?.length || requirement.any?.length || requirement.authenticated);
    }
}
