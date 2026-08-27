import 'dotenv/config';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { CardAssignmentMode, NotificationType, Prisma, PrismaClient, SettingScope, Status } from '@prisma/client';
import { Pool } from 'pg';
import { FUEL_CATALOG } from './fuel-catalog';
import { ALL_PERMISSION_CODES, PERMISSION_CATALOG, type PermissionCode } from './permission-catalog';

const prismaConnectionString = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!prismaConnectionString) {
    throw new Error('DIRECT_URL o DATABASE_URL es requerido para ejecutar prisma/seed.ts');
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

const ADMIN_ROLE_CODE = 'administrador-global';
const ADMIN_ROLE_NAME = 'Administrador global';
const ADMIN_ROLE_DESCRIPTION = 'Rol inicial con acceso a los permisos administrativos del sistema.';
const ADMIN_EXCLUDED_PERMISSION_PREFIXES = ['cardholder.'] as const;
const DEFAULT_DEMO_TENANT_COUNT = 2;
const DEFAULT_DEMO_SUB_COMPANIES_PER_COMPANY = 2;
const DEMO_TENANT_COUNT = parseSeedPositiveInt('SEED_DEMO_TENANT_COUNT', DEFAULT_DEMO_TENANT_COUNT);
const DEMO_SUB_COMPANIES_PER_COMPANY = parseSeedPositiveInt('SEED_DEMO_SUB_COMPANIES_PER_COMPANY', DEFAULT_DEMO_SUB_COMPANIES_PER_COMPANY);
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD?.trim() || 'Demo1234';
const DOCUMENTS_STORAGE_DIR = process.env.DOCUMENTS_STORAGE_DIR?.trim() || path.join('uploads', 'documents');

type RoleSeed = {
    id: string;
    code: string;
};

type DemoRoleDefinition = {
    code: string;
    name: string;
    description: string;
    prefixes: readonly string[];
    extraPermissionCodes?: readonly PermissionCode[];
    excludePermissionCodes?: readonly PermissionCode[];
    readOnly?: boolean;
};

type UserSeed = {
    id: string;
    username: string;
    fullName: string;
    roleCode?: string;
    accessScope?: DemoAccessScope;
};

type DemoAccessScope = 'global' | 'company' | 'subCompany';

type DemoUserDefinition = {
    username: string;
    email: string;
    fullName: string;
    roleCode: string;
    accessScope: DemoAccessScope;
};

const DEMO_USER_DEFINITIONS = [
    {
        username: 'demo.company.manager',
        email: 'demo.company.manager@example.com',
        fullName: 'Demo Company Manager',
        roleCode: 'demo-operador-compania',
        accessScope: 'company',
    },
    {
        username: 'demo.company.viewer',
        email: 'demo.company.viewer@example.com',
        fullName: 'Demo Company Viewer',
        roleCode: 'demo-consulta-compania',
        accessScope: 'company',
    },
    {
        username: 'demo.subcompany.manager',
        email: 'demo.subcompany.manager@example.com',
        fullName: 'Demo Subcompany Manager',
        roleCode: 'demo-operador-compania',
        accessScope: 'subCompany',
    },
    {
        username: 'demo.cards.manager',
        email: 'demo.cards.manager@example.com',
        fullName: 'Demo Cards Manager',
        roleCode: 'demo-tarjetas-administrador',
        accessScope: 'company',
    },
    {
        username: 'demo.stations.manager',
        email: 'demo.stations.manager@example.com',
        fullName: 'Demo Stations Manager',
        roleCode: 'demo-estaciones-administrador',
        accessScope: 'company',
    },
    {
        username: 'demo.users.admin',
        email: 'demo.users.admin@example.com',
        fullName: 'Demo Users Admin',
        roleCode: 'demo-usuarios-administrador',
        accessScope: 'global',
    },
    {
        username: 'demo.rbac.admin',
        email: 'demo.rbac.admin@example.com',
        fullName: 'Demo RBAC Admin',
        roleCode: 'demo-roles-permisos-administrador',
        accessScope: 'global',
    },
] as const satisfies readonly DemoUserDefinition[];

type CompanySeed = {
    id: string;
    key: string;
    index: number;
};

type SubCompanySeed = {
    id: string;
    key: string;
    companyId: string;
    index: number;
    companyIndex: number;
    subCompanyIndex: number;
};

type DriverSeed = {
    id: string;
    name: string;
    subCompanyId: string;
    index: number;
};

type FuelSeed = {
    id: string;
    code: string;
};

type VehicleSeed = {
    id: string;
    subCompanyId: string;
    fuelId: string;
    index: number;
};

type StationSeed = {
    id: string;
    subCompanyId: string;
    index: number;
};

type CardSeed = {
    id: string;
    externalId: string;
    subCompanyId: string;
    index: number;
};

function getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`${name} es requerido para ejecutar prisma/seed.ts`);
    }

    return value;
}

function parseSeedPositiveInt(name: string, fallback: number): number {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) return fallback;

    const value = Number.parseInt(rawValue, 10);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

function seedIndexes(count = DEMO_TENANT_COUNT): number[] {
    return Array.from({ length: count }, (_value, index) => index + 1);
}

function pad(index: number): string {
    return String(index).padStart(2, '0');
}

async function seedPermissions(): Promise<void> {
    for (const permission of PERMISSION_CATALOG) {
        await syncPermission(permission);
    }
}

async function upsertAdminRole(): Promise<RoleSeed> {
    const existing = await findActiveRoleByCode(ADMIN_ROLE_CODE);

    if (existing) {
        return prisma.role.update({
            where: { id: existing.id },
            data: {
                name: ADMIN_ROLE_NAME,
                description: ADMIN_ROLE_DESCRIPTION,
            },
            select: { id: true, code: true },
        });
    }

    return prisma.role.create({
        data: {
            code: ADMIN_ROLE_CODE,
            name: ADMIN_ROLE_NAME,
            description: ADMIN_ROLE_DESCRIPTION,
        },
        select: { id: true, code: true },
    });
}

async function syncPermission(permission: (typeof PERMISSION_CATALOG)[number]): Promise<void> {
    const existing = await prisma.permission.findFirst({
        where: {
            code: permission.code,
        },
        select: { id: true },
    });

    if (existing) {
        await prisma.permission.update({
            where: { id: existing.id },
            data: {
                name: permission.name,
                description: permission.description,
            },
        });
        return;
    }

    await prisma.permission.create({
        data: {
            code: permission.code,
            name: permission.name,
            description: permission.description,
        },
    });
}

function findActiveRoleByCode(code: string) {
    return prisma.role.findFirst({
        where: {
            code,
        },
        select: { id: true },
    });
}

async function syncRolePermissions(roleId: string): Promise<void> {
    await syncRolePermissionsByCodes(roleId, resolveAdminPermissionCodes());
}

async function syncRolePermissionsByCodes(roleId: string, codes: string[]): Promise<void> {
    const permissions = await prisma.permission.findMany({
        where: { code: { in: codes } },
        select: { id: true },
    });

    const permissionIds = permissions.map((permission) => permission.id);

    await prisma.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({
            where: {
                roleId,
                permissionId: { notIn: permissionIds },
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

function resolveAdminPermissionCodes(): PermissionCode[] {
    return ALL_PERMISSION_CODES.filter((code) => !ADMIN_EXCLUDED_PERMISSION_PREFIXES.some((prefix) => code.startsWith(prefix)));
}

async function seedAdminUser(roleId: string): Promise<UserSeed> {
    const username = getRequiredEnv('ADMIN_USERNAME');
    const email = getRequiredEnv('ADMIN_EMAIL');
    const password = getRequiredEnv('ADMIN_PASSWORD');
    const fullName = getRequiredEnv('ADMIN_FULL_NAME');
    const passwordHash = await argon2.hash(password);

    const existing = await prisma.user.findFirst({
        where: {
            username,
        },
        select: { id: true },
    });

    const user = existing
        ? await prisma.user.update({
              where: { id: existing.id },
              data: {
                  fullName,
                  email,
                  passwordHash,
                  status: Status.active,
                  requiresEmailVerification: false,
              },
              select: { id: true, username: true, fullName: true },
          })
        : await prisma.user.create({
              data: {
                  username,
                  email,
                  fullName,
                  passwordHash,
                  status: Status.active,
                  requiresEmailVerification: false,
              },
              select: { id: true, username: true, fullName: true },
          });

    await ensureGlobalAdminAccess(user.id, roleId);

    return {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
    };
}

async function ensureGlobalAdminAccess(userId: string, roleId: string): Promise<void> {
    const globalAccess = await prisma.userAccess.findFirst({
        where: {
            userId,
            roleId,
            companyId: null,
            scopeKey: null,
            scopeId: null,
        },
        select: { id: true },
    });

    if (globalAccess) return;

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

async function seedDemoRoles(): Promise<RoleSeed[]> {
    const roleDefinitions = [
        {
            code: 'demo-usuarios-administrador',
            name: 'Demo Administracion de usuarios',
            description: 'Administra usuarios, accesos y consulta roles/permisos disponibles.',
            prefixes: ['users.'],
            extraPermissionCodes: ['roles.read-list', 'roles.read-one', 'permissions.read-list', 'permissions.read-one'],
        },
        {
            code: 'demo-roles-permisos-administrador',
            name: 'Demo Administracion de roles y permisos',
            description: 'Administra el catalogo de roles, permisos y asignaciones de permisos por rol.',
            prefixes: ['roles.', 'permissions.'],
        },
        {
            code: 'demo-operador-compania',
            name: 'Demo Operador de compania',
            description: 'Administra la operacion diaria de una compania sin permisos globales de seguridad.',
            prefixes: ['sub-companies.', 'drivers.', 'vehicles.', 'stations.', 'station-fuels.', 'cards.', 'documents.', 'cardholders.'],
            extraPermissionCodes: [
                'companies.module',
                'companies.read-list',
                'companies.read-one',
                'fuels.read-list',
                'fuels.read-one',
                'users.read-list',
                'users.read-one',
                'cardcloud-stock.module',
                'cardcloud-stock.read-list',
                'cardcloud-stock.sub-company.assign',
                'cardcloud-stock.sub-company.unassign',
                'notifications.module',
                'notifications.read-list',
                'notifications.unread-count.read',
                'notifications.mark-read',
                'notifications.mark-read-all',
            ],
        },
        {
            code: 'demo-consulta-compania',
            name: 'Demo Consulta de compania',
            description: 'Consulta los modulos operativos principales dentro de una compania sin permisos de escritura.',
            prefixes: ['companies.', 'sub-companies.', 'drivers.', 'vehicles.', 'fuels.', 'stations.', 'station-fuels.', 'cards.', 'documents.', 'cardholders.', 'cardcloud-stock.', 'notifications.'],
            extraPermissionCodes: ['users.read-list', 'users.read-one', 'notifications.mark-read', 'notifications.mark-read-all'],
            readOnly: true,
        },
        {
            code: 'demo-flota-administrador',
            name: 'Demo Administracion de flota',
            description: 'Administra conductores, vehiculos y asignaciones de chofer dentro de una compania.',
            prefixes: ['drivers.', 'vehicles.'],
            extraPermissionCodes: ['fuels.read-list', 'fuels.read-one', 'sub-companies.read-list', 'sub-companies.read-one', 'users.read-list', 'users.read-one'],
        },
        {
            code: 'demo-tarjetas-administrador',
            name: 'Demo Administracion de tarjetas',
            description: 'Administra tarjetas, asignaciones a vehiculos y stock Cardcloud.',
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
            code: 'demo-cardcloud-administrador',
            name: 'Demo Administracion Cardcloud',
            description: 'Administra cuenta, subcuentas, tarjetas externas, transferencias y stock Cardcloud.',
            prefixes: ['cardcloud.', 'cardcloud-stock.'],
            extraPermissionCodes: ['sub-companies.read-list', 'sub-companies.read-one', 'cards.read-list', 'cards.read-one'],
        },
        {
            code: 'demo-tarjetahabientes-administrador',
            name: 'Demo Administracion de tarjetahabientes',
            description: 'Consulta usuarios con perfil tarjetahabiente y su contexto operativo.',
            prefixes: ['cardholders.'],
            extraPermissionCodes: ['sub-companies.read-list', 'sub-companies.read-one'],
        },
        {
            code: 'demo-tarjetahabiente',
            name: 'Demo Tarjetahabiente',
            description: 'Acceso propio para usuarios conductores que consultan y operan sus tarjetas asignadas.',
            prefixes: ['cardholder.'],
        },
        {
            code: 'demo-combustibles-administrador',
            name: 'Demo Administracion de combustibles',
            description: 'Administra el catalogo de combustibles.',
            prefixes: ['fuels.'],
        },
        {
            code: 'demo-estaciones-administrador',
            name: 'Demo Administracion de estaciones',
            description: 'Administra estaciones y combustibles disponibles por estacion.',
            prefixes: ['stations.', 'station-fuels.'],
            extraPermissionCodes: ['fuels.read-list', 'fuels.read-one', 'sub-companies.read-list', 'sub-companies.read-one'],
        },
        {
            code: 'demo-documentos-administrador',
            name: 'Demo Administracion de documentos',
            description: 'Administra documentos de la compania seleccionada.',
            prefixes: ['documents.'],
            extraPermissionCodes: ['sub-companies.read-list', 'sub-companies.read-one'],
        },
        {
            code: 'demo-notificaciones-administrador',
            name: 'Demo Administracion de notificaciones',
            description: 'Administra notificaciones y consulta la bandeja del usuario.',
            prefixes: ['notifications.'],
        },
        {
            code: 'demo-consulta-auditoria',
            name: 'Demo Consulta de auditoria',
            description: 'Consulta eventos de auditoria del sistema sin permisos de escritura.',
            prefixes: ['audit.'],
            readOnly: true,
        },
    ] as const satisfies readonly DemoRoleDefinition[];

    const roles: RoleSeed[] = [];

    for (const definition of roleDefinitions) {
        const role = await prisma.role.upsert({
            where: { code: definition.code },
            create: {
                code: definition.code,
                name: definition.name,
                description: definition.description,
            },
            update: {
                name: definition.name,
                description: definition.description,
            },
            select: { id: true, code: true },
        });

        const permissionCodes = resolveDemoRolePermissionCodes(definition);
        await syncRolePermissionsByCodes(role.id, permissionCodes);
        roles.push(role);
    }

    return roles;
}

function resolveDemoRolePermissionCodes(definition: DemoRoleDefinition): PermissionCode[] {
    const permissionCodes = new Set<PermissionCode>();

    for (const code of ALL_PERMISSION_CODES) {
        if (definition.prefixes.some((prefix) => code.startsWith(prefix)) && (!definition.readOnly || isReadPermissionCode(code))) {
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

async function seedDemoUsers(): Promise<UserSeed[]> {
    const passwordHash = await argon2.hash(DEMO_PASSWORD);
    const users: UserSeed[] = [];

    for (const definition of DEMO_USER_DEFINITIONS) {
        const user = await prisma.user.upsert({
            where: { username: definition.username },
            create: {
                username: definition.username,
                email: definition.email,
                fullName: definition.fullName,
                passwordHash,
                preferredLanguage: 'es',
                status: Status.active,
                requiresEmailVerification: false,
                emailVerifiedAt: new Date(),
            },
            update: {
                email: definition.email,
                fullName: definition.fullName,
                passwordHash,
                preferredLanguage: 'es',
                status: Status.active,
                requiresEmailVerification: false,
            },
            select: { id: true, username: true, fullName: true },
        });

        users.push({ ...user, roleCode: definition.roleCode, accessScope: definition.accessScope });
    }

    return users;
}

async function seedUserAccesses(users: UserSeed[], roles: RoleSeed[], companies: CompanySeed[], subCompanies: SubCompanySeed[]): Promise<void> {
    const rolesByCode = new Map(roles.map((role) => [role.code, role]));

    for (const user of users) {
        if (!user.roleCode || !user.accessScope) continue;

        const role = rolesByCode.get(user.roleCode);
        if (!role) throw new Error(`Rol demo no encontrado para ${user.username}: ${user.roleCode}`);

        if (user.accessScope === 'global') {
            await ensureUserAccess({
                userId: user.id,
                roleId: role.id,
                companyId: null,
                scopeKey: null,
                scopeId: null,
            });
            continue;
        }

        for (const company of companies) {
            if (user.accessScope === 'company') {
                await ensureUserAccess({
                    userId: user.id,
                    roleId: role.id,
                    companyId: company.id,
                    scopeKey: null,
                    scopeId: null,
                });
                continue;
            }

            const subCompany = subCompanies.find((entry) => entry.companyId === company.id && entry.subCompanyIndex === 1);
            if (!subCompany) throw new Error(`Subcompania demo no encontrada para ${company.key}`);

            await ensureUserAccess({
                userId: user.id,
                roleId: role.id,
                companyId: company.id,
                scopeKey: 'subCompanyId',
                scopeId: subCompany.id,
            });
        }
    }
}

async function ensureUserAccess(data: { userId: string; roleId: string; companyId: string | null; scopeKey: string | null; scopeId: string | null }): Promise<void> {
    const existing = await prisma.userAccess.findFirst({
        where: data,
        select: { id: true },
    });

    if (existing) return;

    await prisma.userAccess.create({ data });
}

async function seedSettings(adminUserId: string): Promise<void> {
    const settings = [
        {
            key: 'demo.ui.theme',
            value: { theme: 'light' },
            description: 'Tema demo global.',
            scope: SettingScope.global,
        },
        {
            key: 'demo.features.cards',
            value: { enabled: true },
            description: 'Feature flag demo para tarjetas.',
            scope: SettingScope.global,
        },
        {
            key: 'demo.notifications.digest',
            value: { frequency: 'daily' },
            description: 'Preferencia demo de digest.',
            scope: SettingScope.global,
        },
    ] satisfies Array<{
        key: string;
        value: Prisma.JsonObject;
        description: string;
        scope: SettingScope;
    }>;

    for (const setting of settings) {
        const existing = await prisma.setting.findFirst({
            where: {
                key: setting.key,
                scope: setting.scope,
            },
            select: { id: true },
        });

        if (existing) {
            await prisma.setting.update({
                where: { id: existing.id },
                data: {
                    value: setting.value,
                    description: setting.description,
                    updatedByUserId: adminUserId,
                },
            });
            continue;
        }

        await prisma.setting.create({
            data: {
                key: setting.key,
                value: setting.value,
                description: setting.description,
                scope: setting.scope,
                createdByUserId: adminUserId,
                updatedByUserId: adminUserId,
            },
        });
    }
}

async function seedCompanies(): Promise<CompanySeed[]> {
    const companies: CompanySeed[] = [];

    for (const index of seedIndexes()) {
        const suffix = pad(index);
        const key = `DEMO-COMP-${suffix}`;
        const data = {
            externalId: `DEMO-EXT-COMP-${suffix}`,
            name: `Demo Company ${suffix}`,
            tradeName: `Demo Trade ${suffix}`,
            status: Status.active,
        };
        const existing = await prisma.company.findFirst({
            where: { key },
            select: { id: true },
        });

        const company = existing
            ? await prisma.company.update({
                  where: { id: existing.id },
                  data,
                  select: { id: true, key: true },
              })
            : await prisma.company.create({
                  data: {
                      ...data,
                      key,
                  },
                  select: { id: true, key: true },
              });

        companies.push({ ...company, index });
    }

    return companies;
}

async function seedSubCompanies(companies: CompanySeed[]): Promise<SubCompanySeed[]> {
    const subCompanies: SubCompanySeed[] = [];

    for (const company of companies) {
        for (const subCompanyIndex of seedIndexes(DEMO_SUB_COMPANIES_PER_COMPANY)) {
            const suffix = `${pad(company.index)}-${pad(subCompanyIndex)}`;
            const globalIndex = (company.index - 1) * DEMO_SUB_COMPANIES_PER_COMPANY + subCompanyIndex;
            const subCompany = await prisma.subCompany.upsert({
                where: {
                    companyId_key: {
                        companyId: company.id,
                        key: `DEMO-SUB-${suffix}`,
                    },
                },
                create: {
                    companyId: company.id,
                    key: `DEMO-SUB-${suffix}`,
                    cardcloudSubaccountId: `DEMO-SUBACCOUNT-${suffix}`,
                    name: `Demo Sub Company ${suffix}`,
                    status: Status.active,
                    isDefault: subCompanyIndex === 1,
                },
                update: {
                    cardcloudSubaccountId: `DEMO-SUBACCOUNT-${suffix}`,
                    name: `Demo Sub Company ${suffix}`,
                    status: Status.active,
                    isDefault: subCompanyIndex === 1,
                },
                select: { id: true, key: true, companyId: true },
            });

            subCompanies.push({ ...subCompany, index: globalIndex, companyIndex: company.index, subCompanyIndex });
        }
    }

    return subCompanies;
}

async function seedFuels(): Promise<FuelSeed[]> {
    const fuels: FuelSeed[] = [];

    for (const definition of FUEL_CATALOG) {
        const fuel = await prisma.fuel.upsert({
            where: { code: definition.code },
            create: {
                code: definition.code,
                name: definition.name,
                status: Status.active,
            },
            update: {
                name: definition.name,
                status: Status.active,
            },
            select: { id: true, code: true },
        });

        fuels.push(fuel);
    }

    return fuels;
}

async function seedDrivers(subCompanies: SubCompanySeed[], users: UserSeed[]): Promise<DriverSeed[]> {
    const drivers: DriverSeed[] = [];

    for (const subCompany of subCompanies) {
        const suffix = pad(subCompany.index);
        const user = users[subCompany.index - 1];
        const driver = await prisma.driver.upsert({
            where: {
                subCompanyId_externalReference: {
                    subCompanyId: subCompany.id,
                    externalReference: `DEMO-DRV-${suffix}`,
                },
            },
            create: {
                subCompanyId: subCompany.id,
                userId: user?.id ?? null,
                name: `Demo Driver ${suffix}`,
                externalReference: `DEMO-DRV-${suffix}`,
                status: Status.active,
            },
            update: {
                userId: user?.id ?? null,
                name: `Demo Driver ${suffix}`,
                status: Status.active,
            },
            select: { id: true, name: true, subCompanyId: true },
        });

        drivers.push({ ...driver, index: subCompany.index });
    }

    return drivers;
}

async function seedVehicles(subCompanies: SubCompanySeed[], fuels: FuelSeed[], drivers: DriverSeed[]): Promise<VehicleSeed[]> {
    const vehicles: VehicleSeed[] = [];

    for (const subCompany of subCompanies) {
        const suffix = pad(subCompany.index);
        const fuel = fuels[(subCompany.index - 1) % fuels.length];
        const driver = drivers.find((entry) => entry.subCompanyId === subCompany.id);
        const vehicle = await prisma.vehicle.upsert({
            where: {
                subCompanyId_plates: {
                    subCompanyId: subCompany.id,
                    plates: `DEMO${suffix}`,
                },
            },
            create: {
                subCompanyId: subCompany.id,
                fuelId: fuel.id,
                driverId: driver?.id ?? null,
                plates: `DEMO${suffix}`,
                economicNumber: `DEMO-VEH-${suffix}`,
                model: `Demo Model ${suffix}`,
                year: 2020 + subCompany.index,
                odometerControl: true,
                odometerInitial: subCompany.index * 1000,
                status: Status.active,
            },
            update: {
                fuelId: fuel.id,
                driverId: driver?.id ?? null,
                economicNumber: `DEMO-VEH-${suffix}`,
                model: `Demo Model ${suffix}`,
                year: 2020 + subCompany.index,
                odometerControl: true,
                odometerInitial: subCompany.index * 1000,
                status: Status.active,
            },
            select: { id: true, subCompanyId: true, fuelId: true },
        });

        vehicles.push({ ...vehicle, index: subCompany.index });
    }

    return vehicles;
}

async function removeDemoCards(): Promise<void> {
    await prisma.card.deleteMany({
        where: {
            externalId: {
                startsWith: 'DEMO-CARD-',
            },
        },
    });
}

async function seedCards(vehicles: VehicleSeed[]): Promise<CardSeed[]> {
    const cards: CardSeed[] = [];

    await removeDemoCards();

    for (const vehicle of vehicles) {
        const suffix = pad(vehicle.index);
        const externalId = `DEMO-CARD-${suffix}`;
        const card = await prisma.card.create({
            data: {
                subCompanyId: vehicle.subCompanyId,
                vehicleId: vehicle.id,
                designFuelId: vehicle.fuelId,
                externalId,
                assignmentMode: CardAssignmentMode.vehicle,
                status: Status.active,
                assignedAt: new Date(),
            },
            select: { id: true, externalId: true, subCompanyId: true },
        });

        cards.push({ ...card, externalId, index: vehicle.index });
    }

    return cards;
}

async function seedCardcloudStock(cards: CardSeed[], subCompanies: SubCompanySeed[]): Promise<void> {
    for (const card of cards) {
        const suffix = pad(card.index);
        await prisma.cardcloud.upsert({
            where: { externalId: card.externalId },
            create: {
                externalId: card.externalId,
                subCompanyId: card.subCompanyId,
                assignedCardId: card.id,
                maskedPan: `XXXX-XXXX-XXXX-${String(1000 + card.index)}`,
                clientId: `DEMO-CLIENT-${suffix}`,
                balance: String(5000 + card.index * 250),
                providerStatus: 'active',
            },
            update: {
                subCompanyId: card.subCompanyId,
                assignedCardId: card.id,
                maskedPan: `XXXX-XXXX-XXXX-${String(1000 + card.index)}`,
                clientId: `DEMO-CLIENT-${suffix}`,
                balance: String(5000 + card.index * 250),
                providerStatus: 'active',
            },
        });
    }

    for (const subCompany of subCompanies) {
        const suffix = pad(subCompany.index);
        await prisma.cardcloud.upsert({
            where: { externalId: `DEMO-STOCK-${suffix}` },
            create: {
                externalId: `DEMO-STOCK-${suffix}`,
                subCompanyId: subCompany.id,
                assignedCardId: null,
                maskedPan: `XXXX-XXXX-XXXX-${String(8000 + subCompany.index)}`,
                clientId: `DEMO-STOCK-CLIENT-${suffix}`,
                balance: String(1000 + subCompany.index * 100),
                providerStatus: 'available',
            },
            update: {
                subCompanyId: subCompany.id,
                assignedCardId: null,
                maskedPan: `XXXX-XXXX-XXXX-${String(8000 + subCompany.index)}`,
                clientId: `DEMO-STOCK-CLIENT-${suffix}`,
                balance: String(1000 + subCompany.index * 100),
                providerStatus: 'available',
            },
        });
    }
}

async function seedStations(subCompanies: SubCompanySeed[]): Promise<StationSeed[]> {
    const stations: StationSeed[] = [];

    for (const subCompany of subCompanies) {
        const suffix = pad(subCompany.index);
        const station = await prisma.station.upsert({
            where: {
                subCompanyId_stationNumber: {
                    subCompanyId: subCompany.id,
                    stationNumber: `DEMO-ST-${suffix}`,
                },
            },
            create: {
                subCompanyId: subCompany.id,
                stationNumber: `DEMO-ST-${suffix}`,
                name: `Demo Station ${suffix}`,
                lat: 25.6 + subCompany.index / 100,
                lon: -100.3 - subCompany.index / 100,
                status: Status.active,
            },
            update: {
                name: `Demo Station ${suffix}`,
                lat: 25.6 + subCompany.index / 100,
                lon: -100.3 - subCompany.index / 100,
                status: Status.active,
            },
            select: { id: true, subCompanyId: true },
        });

        stations.push({ ...station, index: subCompany.index });
    }

    return stations;
}

async function seedStationFuels(stations: StationSeed[], fuels: FuelSeed[]): Promise<void> {
    for (const station of stations) {
        for (const fuel of fuels) {
            await prisma.stationFuel.upsert({
                where: {
                    stationId_fuelId: {
                        stationId: station.id,
                        fuelId: fuel.id,
                    },
                },
                create: {
                    stationId: station.id,
                    fuelId: fuel.id,
                    status: Status.active,
                },
                update: {
                    status: Status.active,
                },
            });
        }
    }
}

async function seedDocuments(users: UserSeed[], companies: CompanySeed[]): Promise<void> {
    for (const company of companies) {
        const suffix = pad(company.index);
        const user = users[(company.index - 1) % users.length];
        const storageKey = path.posix.join('seed', 'documents', `demo-document-${suffix}.txt`);
        const content = `Documento demo ${suffix}\nCompania: ${company.key}\nGenerado por prisma/seed.ts\n`;
        const storedFile = await ensureSeedDocumentFile(storageKey, content);

        await prisma.document.upsert({
            where: { storageKey },
            create: {
                uploadedByUserId: user.id,
                companyId: company.id,
                createdByUserId: user.id,
                title: `Demo Document ${suffix}`,
                description: `Documento demo ${suffix}`,
                category: 'demo',
                entityType: 'company',
                entityId: company.id,
                scopeKey: 'companyId',
                scopeId: company.id,
                originalName: `demo-document-${suffix}.txt`,
                storageKey,
                mimeType: 'text/plain',
                extension: '.txt',
                sizeBytes: storedFile.sizeBytes,
                checksumSha256: storedFile.checksumSha256,
            },
            update: {
                uploadedByUserId: user.id,
                companyId: company.id,
                updatedByUserId: user.id,
                deletedByUserId: null,
                title: `Demo Document ${suffix}`,
                description: `Documento demo ${suffix}`,
                category: 'demo',
                entityType: 'company',
                entityId: company.id,
                scopeKey: 'companyId',
                scopeId: company.id,
                originalName: `demo-document-${suffix}.txt`,
                mimeType: 'text/plain',
                extension: '.txt',
                sizeBytes: storedFile.sizeBytes,
                checksumSha256: storedFile.checksumSha256,
                deletedAt: null,
            },
        });
    }
}

async function ensureSeedDocumentFile(storageKey: string, content: string): Promise<{ sizeBytes: number; checksumSha256: string }> {
    const absolutePath = path.resolve(getDocumentsStorageDirectory(), storageKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
    const buffer = Buffer.from(content, 'utf8');

    return {
        sizeBytes: buffer.byteLength,
        checksumSha256: createHash('sha256').update(buffer).digest('hex'),
    };
}

function getDocumentsStorageDirectory(): string {
    return path.isAbsolute(DOCUMENTS_STORAGE_DIR) ? DOCUMENTS_STORAGE_DIR : path.resolve(process.cwd(), DOCUMENTS_STORAGE_DIR);
}

async function seedNotifications(users: UserSeed[]): Promise<void> {
    const types = [NotificationType.info, NotificationType.warning, NotificationType.success, NotificationType.error, NotificationType.info];

    for (const index of seedIndexes(users.length)) {
        const suffix = pad(index);
        const user = users[index - 1];
        const title = `Demo Notification ${suffix}`;
        const existing = await prisma.notification.findFirst({
            where: {
                userId: user.id,
                title,
            },
            select: { id: true },
        });

        const data = {
            message: `Mensaje demo ${suffix}`,
            detail: `Detalle demo ${suffix}`,
            type: types[(index - 1) % types.length],
            link: `/demo/notifications/${suffix}`,
            isRead: index % 2 === 0,
            readAt: index % 2 === 0 ? new Date() : null,
        };

        if (existing) {
            await prisma.notification.update({
                where: { id: existing.id },
                data,
            });
            continue;
        }

        await prisma.notification.create({
            data: {
                userId: user.id,
                title,
                ...data,
            },
        });
    }
}

async function seedDemoData(adminUser: UserSeed, adminRole: RoleSeed): Promise<void> {
    const demoRoles = await seedDemoRoles();
    const users = await seedDemoUsers();
    const companies = await seedCompanies();

    await seedSettings(adminUser.id);

    const subCompanies = await seedSubCompanies(companies);
    await seedUserAccesses(users, demoRoles, companies, subCompanies);
    const fuels = await seedFuels();
    const drivers = await seedDrivers(subCompanies, users);
    const vehicles = await seedVehicles(subCompanies, fuels, drivers);
    const cards = await seedCards(vehicles);
    await seedCardcloudStock(cards, subCompanies);
    const stations = await seedStations(subCompanies);

    await seedStationFuels(stations, fuels);
    await seedDocuments(users, companies);
    await seedNotifications(users);
    await ensureGlobalAdminAccess(adminUser.id, adminRole.id);
}

async function main(): Promise<void> {
    await seedPermissions();

    const adminRole = await upsertAdminRole();
    await syncRolePermissions(adminRole.id);

    const adminUser = await seedAdminUser(adminRole.id);
    await seedDemoData(adminUser, adminRole);

    console.log('Seed completado correctamente.');
    console.log(`Admin global: ${adminUser.username}`);
    console.log(`Usuarios demo (${DEMO_PASSWORD}): ${DEMO_USER_DEFINITIONS.map((user) => user.username).join(', ')}`);
    console.log(
        `Datos demo medium: ${DEMO_TENANT_COUNT} companias, ${DEMO_SUB_COMPANIES_PER_COMPANY} subcompanias por compania, ${FUEL_CATALOG.length} combustibles, tarjetas y stock Cardcloud locales.`
    );
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
