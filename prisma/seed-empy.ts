import 'dotenv/config';

import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Status } from '@prisma/client';
import { Pool } from 'pg';

import { FUEL_CATALOG } from './fuel-catalog';
import { ALL_PERMISSION_CODES, PERMISSION_CATALOG, type PermissionCode } from './permission-catalog';

const prismaConnectionString = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!prismaConnectionString) {
    throw new Error('DIRECT_URL o DATABASE_URL es requerido para ejecutar prisma/seed-empy.ts');
}

const pool = new Pool({
    connectionString: prismaConnectionString,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    max: 2,
});

const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
});

// =============================================================================
// Admin
// =============================================================================

const ADMIN_ROLE_CODE = 'admin';
const ADMIN_ROLE_NAME = 'Administrador global';
const ADMIN_ROLE_DESCRIPTION = 'Rol inicial con acceso completo a todos los permisos del sistema.';

// =============================================================================
// Default company
// =============================================================================

const DEFAULT_COMPANY_KEY = 'DEFAULT';
const DEFAULT_COMPANY_NAME = 'Compañía por defecto';
const DEFAULT_SUB_COMPANY_KEY = 'DEFAULT';
const DEFAULT_SUB_COMPANY_NAME = 'Subcompañía por defecto';

// =============================================================================
// Types
// =============================================================================

type RoleSeed = {
    id: string;
    code: string;
};

type UserSeed = {
    id: string;
    username: string;
    fullName: string;
};

type CompanySeed = {
    id: string;
    key: string;
    name: string;
};

type SubCompanySeed = {
    id: string;
    key: string;
    name: string;
};

type RoleDefinition = {
    code: string;
    name: string;
    description: string;
    prefixes: readonly string[];
    extraPermissionCodes?: readonly PermissionCode[];
    excludePermissionCodes?: readonly PermissionCode[];
    readOnly?: boolean;
};

// =============================================================================
// Roles
// =============================================================================

const ROLE_DEFINITIONS = [
    {
        code: 'user-administrator',
        name: 'Administrador de usuarios',
        description: 'Administra usuarios, accesos y consulta roles/permisos disponibles.',
        prefixes: ['users.'],
        extraPermissionCodes: ['roles.read-list', 'roles.read-one', 'permissions.read-list', 'permissions.read-one'],
    },
    {
        code: 'rbac-administrator',
        name: 'Administrador de roles y permisos',
        description: 'Administra el catálogo de roles, permisos y asignaciones de permisos por rol.',
        prefixes: ['roles.', 'permissions.'],
    },
    {
        code: 'company-manager',
        name: 'Operador de compañía',
        description: 'Administra los módulos operativos principales dentro de una compañía.',
        prefixes: ['companies.', 'sub-companies.', 'drivers.', 'vehicles.', 'stations.', 'station-fuels.', 'cards.', 'documents.', 'users.'],
        extraPermissionCodes: [
            'fuels.read-list',
            'fuels.read-one',
            'cardcloud-stock.module',
            'cardcloud-stock.read-list',
            'cardcloud-stock.sub-company.assign',
            'cardcloud-stock.sub-company.unassign',
            'notifications.read-list',
            'notifications.unread-count.read',
            'notifications.mark-read',
            'notifications.mark-read-all',
        ],
        excludePermissionCodes: ['companies.create', 'companies.update', 'companies.delete'],
    },
    {
        code: 'company-viewer',
        name: 'Consulta de compañía',
        description: 'Consulta los módulos operativos principales dentro de una compañía sin permisos de escritura.',
        prefixes: ['companies.', 'sub-companies.', 'drivers.', 'vehicles.', 'fuels.', 'stations.', 'station-fuels.', 'cards.', 'documents.', 'notifications.', 'users.'],
        readOnly: true,
    },
    {
        code: 'driver-administrator',
        name: 'Administrador de choferes',
        description: 'Administra choferes y consulta subcompañías necesarias para asignarlos correctamente.',
        prefixes: ['drivers.'],
        extraPermissionCodes: ['sub-companies.read-list', 'sub-companies.read-one'],
    },
    {
        code: 'vehicle-administrator',
        name: 'Administrador de vehículos',
        description: 'Administra vehículos, asignación de choferes y catálogos necesarios para la flota.',
        prefixes: ['vehicles.'],
        extraPermissionCodes: ['drivers.read-list', 'drivers.read-one', 'fuels.read-list', 'fuels.read-one', 'sub-companies.read-list', 'sub-companies.read-one'],
    },
    {
        code: 'card-administrator',
        name: 'Administrador de tarjetas',
        description: 'Administra tarjetas, asignaciones a vehículos y stock Cardcloud.',
        prefixes: ['cards.'],
        extraPermissionCodes: [
            'vehicles.read-list',
            'vehicles.read-one',
            'fuels.read-list',
            'fuels.read-one',
            'sub-companies.read-list',
            'sub-companies.read-one',
            'cardcloud-stock.module',
            'cardcloud-stock.read-list',
            'cardcloud-stock.sub-company.assign',
            'cardcloud-stock.sub-company.unassign',
        ],
    },
    {
        code: 'cardholder',
        name: 'Tarjetahabiente',
        description: 'Acceso propio para usuarios conductores que consultan y operan sus tarjetas asignadas.',
        prefixes: ['cardholder.'],
    },
    {
        code: 'fuel-administrator',
        name: 'Administrador de combustibles',
        description: 'Administra el catálogo de combustibles.',
        prefixes: ['fuels.'],
    },
    {
        code: 'station-administrator',
        name: 'Administrador de estaciones',
        description: 'Administra estaciones y combustibles disponibles por estación.',
        prefixes: ['stations.', 'station-fuels.'],
        extraPermissionCodes: ['fuels.read-list', 'fuels.read-one', 'sub-companies.read-list', 'sub-companies.read-one'],
    },
    {
        code: 'document-administrator',
        name: 'Administrador de documentos',
        description: 'Administra documentos de la compañía seleccionada.',
        prefixes: ['documents.'],
    },
    {
        code: 'notification-administrator',
        name: 'Administrador de notificaciones',
        description: 'Administra notificaciones y consulta la bandeja del usuario.',
        prefixes: ['notifications.'],
    },
] as const satisfies readonly RoleDefinition[];

// =============================================================================
// Environment
// =============================================================================

function getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`${name} es requerido para ejecutar prisma/seed-empy.ts`);
    }

    return value;
}

// =============================================================================
// Permissions
// =============================================================================

async function seedPermissions(): Promise<void> {
    for (const permission of PERMISSION_CATALOG) {
        await prisma.permission.upsert({
            where: {
                code: permission.code,
            },
            create: {
                code: permission.code,
                name: permission.name,
                description: permission.description,
            },
            update: {
                name: permission.name,
                description: permission.description,
            },
        });
    }
}

// =============================================================================
// Roles
// =============================================================================

async function seedAdminRole(): Promise<RoleSeed> {
    return prisma.role.upsert({
        where: {
            code: ADMIN_ROLE_CODE,
        },
        create: {
            code: ADMIN_ROLE_CODE,
            name: ADMIN_ROLE_NAME,
            description: ADMIN_ROLE_DESCRIPTION,
        },
        update: {
            name: ADMIN_ROLE_NAME,
            description: ADMIN_ROLE_DESCRIPTION,
        },
        select: {
            id: true,
            code: true,
        },
    });
}

async function seedRoles(): Promise<RoleSeed[]> {
    const roles: RoleSeed[] = [];

    for (const definition of ROLE_DEFINITIONS) {
        const role = await prisma.role.upsert({
            where: {
                code: definition.code,
            },
            create: {
                code: definition.code,
                name: definition.name,
                description: definition.description,
            },
            update: {
                name: definition.name,
                description: definition.description,
            },
            select: {
                id: true,
                code: true,
            },
        });

        await syncRolePermissions(role.id, resolveRolePermissionCodes(definition));

        roles.push(role);
    }

    return roles;
}

async function syncAdminRolePermissions(roleId: string): Promise<void> {
    await syncRolePermissions(roleId, [...ALL_PERMISSION_CODES]);
}

async function syncRolePermissions(roleId: string, codes: PermissionCode[]): Promise<void> {
    const permissions = await prisma.permission.findMany({
        where: {
            code: {
                in: codes,
            },
        },
        select: {
            id: true,
        },
    });

    const permissionIds = permissions.map(({ id }) => id);

    await prisma.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({
            where: {
                roleId,
                permissionId: {
                    notIn: permissionIds,
                },
            },
        });

        if (permissionIds.length === 0) {
            return;
        }

        await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
                roleId,
                permissionId,
            })),
            skipDuplicates: true,
        });
    });
}

function resolveRolePermissionCodes(definition: RoleDefinition): PermissionCode[] {
    const permissionCodes = new Set<PermissionCode>();

    for (const code of ALL_PERMISSION_CODES) {
        const matchesPrefix = definition.prefixes.some((prefix) => code.startsWith(prefix));

        const isAllowed = !definition.readOnly || isReadPermissionCode(code);

        if (matchesPrefix && isAllowed) {
            permissionCodes.add(code);
        }
    }

    for (const code of definition.extraPermissionCodes ?? []) {
        permissionCodes.add(code);
    }

    for (const code of definition.excludePermissionCodes ?? []) {
        permissionCodes.delete(code);
    }

    return [...permissionCodes];
}

function isReadPermissionCode(code: PermissionCode): boolean {
    return code.includes('.read') || code.endsWith('.download') || code.endsWith('.module');
}

// =============================================================================
// Company
// =============================================================================

async function seedDefaultCompany(): Promise<CompanySeed> {
    return prisma.company.upsert({
        where: {
            key: DEFAULT_COMPANY_KEY,
        },
        create: {
            key: DEFAULT_COMPANY_KEY,
            name: DEFAULT_COMPANY_NAME,
            tradeName: DEFAULT_COMPANY_NAME,
            status: Status.active,
        },
        update: {
            name: DEFAULT_COMPANY_NAME,
            tradeName: DEFAULT_COMPANY_NAME,
            status: Status.active,
        },
        select: {
            id: true,
            key: true,
            name: true,
        },
    });
}

async function seedDefaultSubCompany(companyId: string): Promise<SubCompanySeed> {
    return prisma.subCompany.upsert({
        where: {
            companyId_key: {
                companyId,
                key: DEFAULT_SUB_COMPANY_KEY,
            },
        },
        create: {
            companyId,
            key: DEFAULT_SUB_COMPANY_KEY,
            name: DEFAULT_SUB_COMPANY_NAME,
            status: Status.active,
            isDefault: true,
        },
        update: {
            name: DEFAULT_SUB_COMPANY_NAME,
            status: Status.active,
            isDefault: true,
        },
        select: {
            id: true,
            key: true,
            name: true,
        },
    });
}

// =============================================================================
// Fuels
// =============================================================================

async function seedFuels(): Promise<number> {
    for (const definition of FUEL_CATALOG) {
        await prisma.fuel.upsert({
            where: {
                code: definition.code,
            },
            create: {
                code: definition.code,
                name: definition.name,
                status: Status.active,
            },
            update: {
                name: definition.name,
                status: Status.active,
            },
        });
    }

    return FUEL_CATALOG.length;
}

// =============================================================================
// Users
// =============================================================================

async function seedAdminUser(adminRoleId: string, companyId: string): Promise<UserSeed> {
    const username = getRequiredEnv('ADMIN_USERNAME');

    const email = getRequiredEnv('ADMIN_EMAIL');

    const password = getRequiredEnv('ADMIN_PASSWORD');

    const fullName = getRequiredEnv('ADMIN_FULL_NAME');

    const passwordHash = await argon2.hash(password);

    const existing = await prisma.user.findFirst({
        where: {
            username,
        },
        select: {
            id: true,
        },
    });

    const user = existing
        ? await prisma.user.update({
              where: {
                  id: existing.id,
              },
              data: {
                  email,
                  fullName,
                  passwordHash,
                  preferredLanguage: 'es',
                  status: Status.active,
                  mustChangePassword: false,
                  requiresEmailVerification: false,
                  failedLoginAttempts: 0,
                  lockedUntil: null,
              },
              select: {
                  id: true,
                  username: true,
                  fullName: true,
              },
          })
        : await prisma.user.create({
              data: {
                  username,
                  email,
                  fullName,
                  passwordHash,
                  preferredLanguage: 'es',
                  status: Status.active,
                  mustChangePassword: false,
                  requiresEmailVerification: false,
              },
              select: {
                  id: true,
                  username: true,
                  fullName: true,
              },
          });

    await ensureGlobalAdminAccess(user.id, adminRoleId);

    await ensureCompanyAdminAccess(user.id, adminRoleId, companyId);

    return user;
}

// =============================================================================
// User access
// =============================================================================

async function ensureGlobalAdminAccess(userId: string, roleId: string): Promise<void> {
    const existing = await prisma.userAccess.findFirst({
        where: {
            userId,
            roleId,
            companyId: null,
            scopeKey: null,
            scopeId: null,
        },
        select: {
            id: true,
        },
    });

    if (existing) {
        return;
    }

    await prisma.userAccess.create({
        data: {
            userId,
            roleId,
            companyId: null,
            scopeKey: null,
            scopeId: null,
        },
    });
}

async function ensureCompanyAdminAccess(userId: string, roleId: string, companyId: string): Promise<void> {
    const existing = await prisma.userAccess.findFirst({
        where: {
            userId,
            roleId,
            companyId,
            scopeKey: null,
            scopeId: null,
        },
        select: {
            id: true,
        },
    });

    if (existing) {
        return;
    }

    await prisma.userAccess.create({
        data: {
            userId,
            roleId,
            companyId,
            scopeKey: null,
            scopeId: null,
        },
    });
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
    await seedPermissions();

    const adminRole = await seedAdminRole();

    await syncAdminRolePermissions(adminRole.id);

    const roles = await seedRoles();

    const company = await seedDefaultCompany();

    const subCompany = await seedDefaultSubCompany(company.id);

    const fuelCount = await seedFuels();

    const adminUser = await seedAdminUser(adminRole.id, company.id);

    console.log('Seed completado correctamente.');

    console.log(`Compañía: ${company.name} (${company.key})`);

    console.log(`Subcompañía: ${subCompany.name} (${subCompany.key})`);

    console.log(`Combustibles: ${fuelCount}`);

    console.log(`Administrador: ${adminUser.username}`);

    console.log(`Roles: ${[adminRole.code, ...roles.map(({ code }) => code)].join(', ')}`);

    console.log('Datos creados: permisos, roles, usuarios, compañía, subcompañía por defecto y combustibles.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
