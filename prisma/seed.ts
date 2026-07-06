import 'dotenv/config';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { CardAssignmentMode, NotificationType, Prisma, PrismaClient, SettingScope, Status } from '@prisma/client';
import { Pool } from 'pg';
import { ALL_PERMISSION_CODES, PERMISSION_CATALOG } from './permission-catalog';

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

const ADMIN_ROLE_CODE = 'admin';
const ADMIN_ROLE_NAME = 'Administrador global';
const ADMIN_ROLE_DESCRIPTION = 'Rol inicial con acceso completo a todos los permisos del sistema.';
const DEMO_COUNT = 5;
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD?.trim() || 'Demo1234';
const DOCUMENTS_STORAGE_DIR = process.env.DOCUMENTS_STORAGE_DIR?.trim() || path.join('uploads', 'documents');

type RoleSeed = {
    id: string;
    code: string;
};

type UserSeed = {
    id: string;
    username: string;
    fullName: string;
};

type OrganizationSeed = {
    id: string;
    slug: string;
};

type CompanySeed = {
    id: string;
    key: string;
    organizationId: string;
};

type SubCompanySeed = {
    id: string;
    key: string;
    organizationId: string;
};

type DriverSeed = {
    id: string;
    name: string;
};

type FuelSeed = {
    id: string;
    code: string;
};

type VehicleSeed = {
    id: string;
    subCompanyId: string;
    fuelId: string;
};

type CardSeed = {
    id: string;
    organizationId: string;
};

type StationSeed = {
    id: string;
};

function getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`${name} es requerido para ejecutar prisma/seed.ts`);
    }

    return value;
}

function seedIndexes(): number[] {
    return Array.from({ length: DEMO_COUNT }, (_value, index) => index + 1);
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
    await syncRolePermissionsByCodes(roleId, [...ALL_PERMISSION_CODES]);
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
            organizationId: null,
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
            organizationId: null,
            scopeKey: null,
            scopeId: null,
        },
    });
}

async function seedDemoRoles(): Promise<RoleSeed[]> {
    const roleDefinitions = [
        {
            code: 'demo-operations-manager',
            name: 'Demo Operations Manager',
            description: 'Rol demo para companias, sub-companias, conductores y vehiculos.',
            prefixes: ['companies.', 'sub-companies.', 'drivers.', 'vehicles.'],
        },
        {
            code: 'demo-cards-manager',
            name: 'Demo Cards Manager',
            description: 'Rol demo para tarjetas y stock Cardcloud.',
            prefixes: ['cards.', 'cardcloud-card-stock.'],
        },
        {
            code: 'demo-stations-manager',
            name: 'Demo Stations Manager',
            description: 'Rol demo para combustibles, estaciones y combustibles por estacion.',
            prefixes: ['fuels.', 'stations.', 'station-fuels.'],
        },
        {
            code: 'demo-documents-manager',
            name: 'Demo Documents Manager',
            description: 'Rol demo para documentos y descargas.',
            prefixes: ['documents.'],
        },
        {
            code: 'demo-notifications-manager',
            name: 'Demo Notifications Manager',
            description: 'Rol demo para notificaciones de usuario.',
            prefixes: ['notifications.'],
        },
    ];

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

        const permissionCodes = [...ALL_PERMISSION_CODES].filter((code) => definition.prefixes.some((prefix) => code.startsWith(prefix)));
        await syncRolePermissionsByCodes(role.id, permissionCodes);
        roles.push(role);
    }

    return roles;
}

async function seedDemoUsers(): Promise<UserSeed[]> {
    const passwordHash = await argon2.hash(DEMO_PASSWORD);
    const users: UserSeed[] = [];

    for (const index of seedIndexes()) {
        const suffix = pad(index);
        const username = `demo.user.${suffix}`;
        const user = await prisma.user.upsert({
            where: { username },
            create: {
                username,
                email: `demo.user.${suffix}@example.com`,
                fullName: `Demo User ${suffix}`,
                passwordHash,
                preferredLanguage: 'es',
                status: Status.active,
                requiresEmailVerification: false,
                emailVerifiedAt: new Date(),
            },
            update: {
                email: `demo.user.${suffix}@example.com`,
                fullName: `Demo User ${suffix}`,
                passwordHash,
                preferredLanguage: 'es',
                status: Status.active,
                requiresEmailVerification: false,
            },
            select: { id: true, username: true, fullName: true },
        });

        users.push(user);
    }

    return users;
}

async function seedOrganizations(adminUserId: string): Promise<OrganizationSeed[]> {
    const organizations: OrganizationSeed[] = [];

    for (const index of seedIndexes()) {
        const suffix = pad(index);
        const organization = await prisma.organization.upsert({
            where: { slug: `demo-org-${suffix}` },
            create: {
                name: `Demo Organization ${suffix}`,
                slug: `demo-org-${suffix}`,
                description: `Organizacion demo ${suffix}`,
                status: Status.active,
                createdByUserId: adminUserId,
                updatedByUserId: adminUserId,
            },
            update: {
                name: `Demo Organization ${suffix}`,
                description: `Organizacion demo ${suffix}`,
                status: Status.active,
                updatedByUserId: adminUserId,
            },
            select: { id: true, slug: true },
        });

        organizations.push(organization);
    }

    return organizations;
}

async function seedOrganizationMemberships(organizations: OrganizationSeed[], users: UserSeed[]): Promise<void> {
    for (const index of seedIndexes()) {
        const organization = organizations[index - 1];
        const user = users[index - 1];

        await prisma.organizationMembership.upsert({
            where: {
                organizationId_userId: {
                    organizationId: organization.id,
                    userId: user.id,
                },
            },
            create: {
                organizationId: organization.id,
                userId: user.id,
            },
            update: {},
        });
    }
}

async function seedUserAccesses(users: UserSeed[], roles: RoleSeed[], organizations: OrganizationSeed[]): Promise<void> {
    for (const index of seedIndexes()) {
        const user = users[index - 1];
        const role = roles[index - 1];
        const organization = organizations[index - 1];
        const scopeKey = 'organizationId';

        const existing = await prisma.userAccess.findFirst({
            where: {
                userId: user.id,
                roleId: role.id,
                organizationId: organization.id,
                scopeKey,
                scopeId: organization.id,
            },
            select: { id: true },
        });

        if (existing) continue;

        await prisma.userAccess.create({
            data: {
                userId: user.id,
                roleId: role.id,
                organizationId: organization.id,
                scopeKey,
                scopeId: organization.id,
            },
        });
    }
}

async function seedSettings(adminUserId: string, organizations: OrganizationSeed[]): Promise<void> {
    const settings = [
        {
            key: 'demo.ui.theme',
            value: { theme: 'light' },
            description: 'Tema demo global.',
            scope: SettingScope.global,
            organizationId: null,
        },
        {
            key: 'demo.features.cards',
            value: { enabled: true },
            description: 'Feature flag demo para tarjetas.',
            scope: SettingScope.global,
            organizationId: null,
        },
        {
            key: 'demo.notifications.digest',
            value: { frequency: 'daily' },
            description: 'Preferencia demo de digest.',
            scope: SettingScope.global,
            organizationId: null,
        },
        {
            key: 'demo.organization.limit',
            value: { vehicles: 25 },
            description: 'Limite demo por organizacion.',
            scope: SettingScope.organization,
            organizationId: organizations[0].id,
        },
        {
            key: 'demo.documents.retention',
            value: { days: 365 },
            description: 'Retencion demo de documentos.',
            scope: SettingScope.organization,
            organizationId: organizations[1].id,
        },
    ] satisfies Array<{
        key: string;
        value: Prisma.JsonObject;
        description: string;
        scope: SettingScope;
        organizationId: string | null;
    }>;

    for (const setting of settings) {
        const existing = await prisma.setting.findFirst({
            where: {
                key: setting.key,
                scope: setting.scope,
                organizationId: setting.organizationId,
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
                organizationId: setting.organizationId,
                createdByUserId: adminUserId,
                updatedByUserId: adminUserId,
            },
        });
    }
}

async function seedCompanies(organizations: OrganizationSeed[]): Promise<CompanySeed[]> {
    const companies: CompanySeed[] = [];

    for (const index of seedIndexes()) {
        const suffix = pad(index);
        const organization = organizations[index - 1];
        const key = `DEMO-COMP-${suffix}`;
        const data = {
            organizationId: organization.id,
            externalId: `DEMO-EXT-COMP-${suffix}`,
            name: `Demo Company ${suffix}`,
            tradeName: `Demo Trade ${suffix}`,
            status: Status.active,
        };
        const existing =
            (await prisma.company.findFirst({
                where: {
                    organizationId: organization.id,
                    key,
                },
                select: { id: true },
            })) ??
            (await prisma.company.findFirst({
                where: { key },
                select: { id: true },
            }));

        const company = existing
            ? await prisma.company.update({
                  where: { id: existing.id },
                  data,
                  select: { id: true, key: true, organizationId: true },
              })
            : await prisma.company.create({
                  data: {
                      ...data,
                      key,
                  },
                  select: { id: true, key: true, organizationId: true },
              });

        companies.push(company);
    }

    return companies;
}

async function seedSubCompanies(companies: CompanySeed[]): Promise<SubCompanySeed[]> {
    const subCompanies: SubCompanySeed[] = [];

    for (const index of seedIndexes()) {
        const suffix = pad(index);
        const company = companies[index - 1];
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
                externalId: `DEMO-EXT-SUB-${suffix}`,
                name: `Demo Sub Company ${suffix}`,
                status: Status.active,
                isDefault: index === 1,
            },
            update: {
                externalId: `DEMO-EXT-SUB-${suffix}`,
                name: `Demo Sub Company ${suffix}`,
                status: Status.active,
                isDefault: index === 1,
            },
            select: { id: true, key: true },
        });

        subCompanies.push({ ...subCompany, organizationId: company.organizationId });
    }

    return subCompanies;
}

async function seedFuels(): Promise<FuelSeed[]> {
    const fuels: FuelSeed[] = [];

    for (const index of seedIndexes()) {
        const suffix = pad(index);
        const fuel = await prisma.fuel.upsert({
            where: { code: `DEMO-FUEL-${suffix}` },
            create: {
                code: `DEMO-FUEL-${suffix}`,
                name: `Demo Fuel ${suffix}`,
                status: Status.active,
            },
            update: {
                name: `Demo Fuel ${suffix}`,
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

    for (const index of seedIndexes()) {
        const suffix = pad(index);
        const subCompany = subCompanies[index - 1];
        const user = users[index - 1];
        const driver = await prisma.driver.upsert({
            where: {
                subCompanyId_externalReference: {
                    subCompanyId: subCompany.id,
                    externalReference: `DEMO-DRV-${suffix}`,
                },
            },
            create: {
                subCompanyId: subCompany.id,
                userId: user.id,
                name: `Demo Driver ${suffix}`,
                externalReference: `DEMO-DRV-${suffix}`,
                status: Status.active,
            },
            update: {
                userId: user.id,
                name: `Demo Driver ${suffix}`,
                status: Status.active,
            },
            select: { id: true, name: true },
        });

        drivers.push(driver);
    }

    return drivers;
}

async function seedVehicles(subCompanies: SubCompanySeed[], fuels: FuelSeed[], drivers: DriverSeed[]): Promise<VehicleSeed[]> {
    const vehicles: VehicleSeed[] = [];

    for (const index of seedIndexes()) {
        const suffix = pad(index);
        const subCompany = subCompanies[index - 1];
        const fuel = fuels[index - 1];
        const driver = drivers[index - 1];
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
                driverId: driver.id,
                plates: `DEMO${suffix}`,
                economicNumber: `DEMO-VEH-${suffix}`,
                model: `Demo Model ${suffix}`,
                year: 2020 + index,
                odometerControl: true,
                odometerInitial: index * 1000,
                status: Status.active,
            },
            update: {
                fuelId: fuel.id,
                driverId: driver.id,
                economicNumber: `DEMO-VEH-${suffix}`,
                model: `Demo Model ${suffix}`,
                year: 2020 + index,
                odometerControl: true,
                odometerInitial: index * 1000,
                status: Status.active,
            },
            select: { id: true, subCompanyId: true, fuelId: true },
        });

        vehicles.push(vehicle);
    }

    return vehicles;
}

async function seedCards(subCompanies: SubCompanySeed[], vehicles: VehicleSeed[]): Promise<CardSeed[]> {
    const cards: CardSeed[] = [];

    for (const index of seedIndexes()) {
        const suffix = pad(index);
        const subCompany = subCompanies[index - 1];
        const vehicle = vehicles[index - 1];
        const card = await prisma.card.upsert({
            where: { externalId: `DEMO-CARD-${suffix}` },
            create: {
                subCompanyId: subCompany.id,
                vehicleId: vehicle.id,
                designFuelId: vehicle.fuelId,
                externalId: `DEMO-CARD-${suffix}`,
                assignmentMode: CardAssignmentMode.vehicle,
                status: Status.active,
                assignedAt: new Date(),
            },
            update: {
                subCompanyId: subCompany.id,
                vehicleId: vehicle.id,
                designFuelId: vehicle.fuelId,
                assignmentMode: CardAssignmentMode.vehicle,
                status: Status.active,
                assignedAt: new Date(),
            },
            select: { id: true },
        });

        cards.push({ ...card, organizationId: subCompany.organizationId });
    }

    return cards;
}

async function seedStations(subCompanies: SubCompanySeed[]): Promise<StationSeed[]> {
    const stations: StationSeed[] = [];

    for (const index of seedIndexes()) {
        const suffix = pad(index);
        const subCompany = subCompanies[index - 1];
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
                lat: 25.6 + index / 100,
                lon: -100.3 - index / 100,
                status: Status.active,
            },
            update: {
                name: `Demo Station ${suffix}`,
                lat: 25.6 + index / 100,
                lon: -100.3 - index / 100,
                status: Status.active,
            },
            select: { id: true },
        });

        stations.push(station);
    }

    return stations;
}

async function seedStationFuels(stations: StationSeed[], fuels: FuelSeed[]): Promise<void> {
    for (const index of seedIndexes()) {
        const station = stations[index - 1];
        const fuel = fuels[index - 1];

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

async function seedCardcloudCardStock(cards: CardSeed[]): Promise<void> {
    for (const index of seedIndexes()) {
        const suffix = pad(index);
        const card = cards[index - 1];

        await prisma.cardcloudCardStock.upsert({
            where: { externalId: `DEMO-STOCK-${suffix}` },
            create: {
                organizationId: card.organizationId,
                externalId: `DEMO-STOCK-${suffix}`,
                assignedCardId: card.id,
                maskedPan: `**** **** **** 10${suffix}`,
                clientId: `DEMO-CLIENT-${suffix}`,
                balance: 1000 + index * 100,
                providerStatus: Status.active,
                syncedAt: new Date(),
            },
            update: {
                organizationId: card.organizationId,
                assignedCardId: card.id,
                maskedPan: `**** **** **** 10${suffix}`,
                clientId: `DEMO-CLIENT-${suffix}`,
                balance: 1000 + index * 100,
                providerStatus: Status.active,
                syncedAt: new Date(),
            },
        });
    }
}

async function seedDocuments(users: UserSeed[], organizations: OrganizationSeed[]): Promise<void> {
    for (const index of seedIndexes()) {
        const suffix = pad(index);
        const user = users[index - 1];
        const organization = organizations[index - 1];
        const storageKey = path.posix.join('seed', 'documents', `demo-document-${suffix}.txt`);
        const content = `Documento demo ${suffix}\nGenerado por prisma/seed.ts\n`;
        const storedFile = await ensureSeedDocumentFile(storageKey, content);

        await prisma.document.upsert({
            where: { storageKey },
            create: {
                uploadedByUserId: user.id,
                organizationId: organization.id,
                createdByUserId: user.id,
                title: `Demo Document ${suffix}`,
                description: `Documento demo ${suffix}`,
                category: 'demo',
                entityType: 'organization',
                entityId: organization.id,
                scopeKey: 'organizationId',
                scopeId: organization.id,
                originalName: `demo-document-${suffix}.txt`,
                storageKey,
                mimeType: 'text/plain',
                extension: '.txt',
                sizeBytes: storedFile.sizeBytes,
                checksumSha256: storedFile.checksumSha256,
            },
            update: {
                uploadedByUserId: user.id,
                organizationId: organization.id,
                updatedByUserId: user.id,
                deletedByUserId: null,
                title: `Demo Document ${suffix}`,
                description: `Documento demo ${suffix}`,
                category: 'demo',
                entityType: 'organization',
                entityId: organization.id,
                scopeKey: 'organizationId',
                scopeId: organization.id,
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

    for (const index of seedIndexes()) {
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
            type: types[index - 1],
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
    const organizations = await seedOrganizations(adminUser.id);

    await seedOrganizationMemberships(organizations, users);
    await seedUserAccesses(users, demoRoles, organizations);
    await seedSettings(adminUser.id, organizations);

    const companies = await seedCompanies(organizations);
    const subCompanies = await seedSubCompanies(companies);
    const fuels = await seedFuels();
    const drivers = await seedDrivers(subCompanies, users);
    const vehicles = await seedVehicles(subCompanies, fuels, drivers);
    const cards = await seedCards(subCompanies, vehicles);
    const stations = await seedStations(subCompanies);

    await seedStationFuels(stations, fuels);
    await seedCardcloudCardStock(cards);
    await seedDocuments(users, organizations);
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
    console.log(`Datos demo: ${DEMO_COUNT} registros por modulo principal.`);
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
