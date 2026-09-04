import 'dotenv/config';

import * as argon2 from 'argon2';
import { createCipheriv, randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { CardAssignmentMode, PrismaClient, Status } from '@prisma/client';
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

const ADMIN_ROLE_CODE = 'administrador-global';
const ADMIN_ROLE_NAME = 'Administrador global';
const ADMIN_ROLE_DESCRIPTION = 'Rol inicial con acceso a los permisos administrativos del sistema.';
const ADMIN_EXCLUDED_PERMISSION_PREFIXES = ['cardholder.'] as const;
const NOTIFICATION_INBOX_PERMISSION_CODES = [
    'notifications.module',
    'notifications.read-list',
    'notifications.unread-count.read',
    'notifications.mark-read',
    'notifications.mark-read-all',
] as const satisfies readonly PermissionCode[];

// =============================================================================
// Default company
// =============================================================================

const DEFAULT_COMPANY_KEY = 'DEFAULT';
const DEFAULT_COMPANY_NAME = 'Compañía por defecto';
const DEFAULT_SUB_COMPANY_KEY = 'DEFAULT';
const DEFAULT_SUB_COMPANY_NAME = 'Subcompañía por defecto';

// =============================================================================
// Cardcloud
// =============================================================================

const CARDCLOUD_DEFAULT_BASE_URL = 'https://cardcloud.setpay.net/api';
const CARDCLOUD_PAGE_BATCH_SIZE = 5;
const CARDCLOUD_PAGE_BATCH_DELAY_MS = 300;
const CARDCLOUD_DB_CHUNK_SIZE = 50;
const CARDCLOUD_SUB_COMPANY_KEY_PREFIX = 'CC';
const BALANCE_ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const BALANCE_ENCRYPTION_IV_LENGTH = 12;
const ENCRYPTION_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

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

type SyncedSubCompanySeed = SubCompanySeed & {
    cardcloudSubaccountId: string;
};

type CardcloudCredentials = {
    baseUrl: string;
    username: string;
    password: string;
};

type CardcloudRequestOptions = {
    method?: string;
    token?: string;
    query?: Record<string, string | number | boolean | null | undefined>;
    body?: unknown;
};

type CardcloudTokenResponse = {
    access_token?: string;
};

type CardcloudSubaccountSeed = {
    id: string;
    key: string;
    name: string;
};

type CardcloudCardSeed = {
    externalId: string;
    clientId?: string | null;
    maskedPan?: string | null;
    balance?: string | number | null;
    providerStatus?: string | null;
};

type CardcloudStockSyncStats = {
    stockSynced: number;
    cardsCreated: number;
    cardsMoved: number;
    cardsLinked: number;
    cardsSkipped: number;
};

type CardcloudSeedResult = {
    enabled: boolean;
    skippedReason?: string;
    subaccountsFetched: number;
    subCompaniesSynced: number;
    accountCardsFetched: number;
    subaccountCardsFetched: number;
    stockSynced: number;
    cardsCreated: number;
    cardsMoved: number;
    cardsLinked: number;
    cardsSkipped: number;
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
        code: 'usuarios-administrador',
        name: 'Administrador de usuarios',
        description: 'Administra usuarios, accesos y consulta roles/permisos disponibles.',
        prefixes: ['users.'],
        extraPermissionCodes: ['roles.read-list', 'roles.read-one', 'permissions.read-list', 'permissions.read-one'],
    },
    {
        code: 'roles-permisos-administrador',
        name: 'Administrador de roles y permisos',
        description: 'Administra el catálogo de roles, permisos y asignaciones de permisos por rol.',
        prefixes: ['roles.', 'permissions.'],
    },
    {
        code: 'operador-compania',
        name: 'Operador de compañía',
        description: 'Administra la operación diaria de una compañía sin permisos globales de seguridad.',
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
        code: 'consulta-compania',
        name: 'Consulta de compañía',
        description: 'Consulta los módulos operativos principales dentro de una compañía sin permisos de escritura.',
        prefixes: ['companies.', 'sub-companies.', 'drivers.', 'vehicles.', 'fuels.', 'stations.', 'station-fuels.', 'cards.', 'documents.', 'cardholders.', 'cardcloud-stock.', 'notifications.'],
        extraPermissionCodes: ['users.read-list', 'users.read-one', 'notifications.mark-read', 'notifications.mark-read-all'],
        readOnly: true,
    },
    {
        code: 'flota-administrador',
        name: 'Administrador de flota',
        description: 'Administra conductores, vehículos y asignaciones de chofer dentro de una compañía.',
        prefixes: ['drivers.', 'vehicles.'],
        extraPermissionCodes: ['fuels.read-list', 'fuels.read-one', 'sub-companies.read-list', 'sub-companies.read-one', 'users.read-list', 'users.read-one'],
    },
    {
        code: 'tarjetas-administrador',
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
        code: 'cardcloud-administrador',
        name: 'Administrador Cardcloud',
        description: 'Administra cuenta, subcuentas, tarjetas externas, transferencias y stock Cardcloud.',
        prefixes: ['cardcloud.', 'cardcloud-stock.'],
        extraPermissionCodes: ['sub-companies.read-list', 'sub-companies.read-one', 'cards.read-list', 'cards.read-one'],
    },
    {
        code: 'tarjetahabientes-administrador',
        name: 'Administrador de tarjetahabientes',
        description: 'Consulta usuarios con perfil tarjetahabiente y su contexto operativo.',
        prefixes: ['cardholders.'],
        extraPermissionCodes: ['sub-companies.read-list', 'sub-companies.read-one'],
    },
    {
        code: 'tarjetahabiente',
        name: 'Tarjetahabiente',
        description: 'Acceso propio para usuarios conductores que consultan y operan sus tarjetas asignadas.',
        prefixes: ['cardholder.'],
    },
    {
        code: 'combustibles-administrador',
        name: 'Administrador de combustibles',
        description: 'Administra el catálogo de combustibles.',
        prefixes: ['fuels.'],
    },
    {
        code: 'estaciones-administrador',
        name: 'Administrador de estaciones',
        description: 'Administra estaciones y combustibles disponibles por estación.',
        prefixes: ['stations.', 'station-fuels.'],
        extraPermissionCodes: ['fuels.read-list', 'fuels.read-one', 'sub-companies.read-list', 'sub-companies.read-one'],
    },
    {
        code: 'documentos-administrador',
        name: 'Administrador de documentos',
        description: 'Administra documentos de la compañía seleccionada.',
        prefixes: ['documents.'],
        extraPermissionCodes: ['sub-companies.read-list', 'sub-companies.read-one'],
    },
    {
        code: 'notificaciones-administrador',
        name: 'Administrador de notificaciones',
        description: 'Administra notificaciones y consulta la bandeja del usuario.',
        prefixes: ['notifications.'],
    },
    {
        code: 'consulta-auditoria',
        name: 'Consulta de auditoría',
        description: 'Consulta eventos de auditoría del sistema sin permisos de escritura.',
        prefixes: ['audit.'],
        readOnly: true,
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
    await syncRolePermissions(roleId, resolveAdminPermissionCodes());
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

function resolveAdminPermissionCodes(): PermissionCode[] {
    const permissionCodes = new Set<PermissionCode>(ALL_PERMISSION_CODES.filter((code) => !ADMIN_EXCLUDED_PERMISSION_PREFIXES.some((prefix) => code.startsWith(prefix))));

    for (const code of NOTIFICATION_INBOX_PERMISSION_CODES) {
        permissionCodes.add(code);
    }

    return [...permissionCodes];
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

    for (const code of NOTIFICATION_INBOX_PERMISSION_CODES) {
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
// Cardcloud sync
// =============================================================================

async function seedCardcloudSubaccounts(company: CompanySeed): Promise<CardcloudSeedResult> {
    const credentials = resolveCardcloudCredentials();
    const result = emptyCardcloudSeedResult(Boolean(credentials));

    if (!credentials) {
        return { ...result, skippedReason: 'faltan CARDCLOUD_USERNAME o CARDCLOUD_PASSWORD' };
    }

    const token = await authenticateCardcloud(credentials);
    const accountCards = await fetchAllCardcloudCards(credentials, token, '/v1/account/cards');
    const accountStockStats = await syncCardcloudStockCards(accountCards);
    addCardcloudStockStats(result, accountStockStats);
    result.accountCardsFetched = accountCards.length;

    const subaccounts = await fetchCardcloudSubaccounts(credentials, token, company);
    result.subaccountsFetched = subaccounts.length;

    for (const subaccount of subaccounts) {
        const subCompany = await upsertCardcloudSubCompany(company, subaccount);
        result.subCompaniesSynced++;

        const subaccountCards = await fetchAllCardcloudCards(credentials, token, `/v1/subaccounts/${encodeURIComponent(subaccount.id)}/cards`);
        const subaccountStockStats = await syncCardcloudStockCards(subaccountCards, subCompany.id);

        result.subaccountCardsFetched += subaccountCards.length;
        addCardcloudStockStats(result, subaccountStockStats);
    }

    return result;
}

function emptyCardcloudSeedResult(enabled: boolean): CardcloudSeedResult {
    return {
        enabled,
        subaccountsFetched: 0,
        subCompaniesSynced: 0,
        accountCardsFetched: 0,
        subaccountCardsFetched: 0,
        stockSynced: 0,
        cardsCreated: 0,
        cardsMoved: 0,
        cardsLinked: 0,
        cardsSkipped: 0,
    };
}

function addCardcloudStockStats(target: CardcloudSeedResult, source: CardcloudStockSyncStats): void {
    target.stockSynced += source.stockSynced;
    target.cardsCreated += source.cardsCreated;
    target.cardsMoved += source.cardsMoved;
    target.cardsLinked += source.cardsLinked;
    target.cardsSkipped += source.cardsSkipped;
}

function resolveCardcloudCredentials(): CardcloudCredentials | null {
    const username = process.env.CARDCLOUD_USERNAME?.trim();
    const password = process.env.CARDCLOUD_PASSWORD?.trim();

    if (!username || !password) {
        return null;
    }

    return {
        baseUrl: process.env.CARDCLOUD_BASE_URL?.trim() || CARDCLOUD_DEFAULT_BASE_URL,
        username,
        password,
    };
}

async function authenticateCardcloud(credentials: CardcloudCredentials): Promise<string> {
    const response = await cardcloudRequest<CardcloudTokenResponse>(credentials, '/auth/login', {
        method: 'POST',
        body: {
            email: credentials.username,
            password: credentials.password,
        },
    });

    const token = cleanText(response.access_token);
    if (!token) {
        throw new Error('Cardcloud no devolvió access_token al autenticar.');
    }

    return token;
}

async function fetchCardcloudSubaccounts(credentials: CardcloudCredentials, token: string, company: CompanySeed): Promise<CardcloudSubaccountSeed[]> {
    const response = await cardcloudRequest<unknown>(credentials, '/v1/subaccounts', { token });
    const items = extractResponseItems(response, ['subaccounts', 'data', 'items', 'records', 'results']);
    const seen = new Set<string>();
    const subaccounts: CardcloudSubaccountSeed[] = [];

    for (const item of items) {
        const id = resolveSubaccountId(item);
        if (!id || seen.has(id)) continue;

        seen.add(id);
        subaccounts.push({
            id,
            key: resolveSubCompanyKey(company.key, id, item),
            name: resolveSubCompanyName(id, item),
        });
    }

    return subaccounts;
}

async function fetchAllCardcloudCards(credentials: CardcloudCredentials, token: string, path: string): Promise<CardcloudCardSeed[]> {
    const first = await cardcloudRequest<unknown>(credentials, path, { token, query: { page: 1 } });
    const all = extractResponseItems(first, ['cards', 'data', 'items', 'records', 'results']);
    const totalPages = resolveTotalPages(first);

    for (let start = 2; start <= totalPages; start += CARDCLOUD_PAGE_BATCH_SIZE) {
        const end = Math.min(start + CARDCLOUD_PAGE_BATCH_SIZE - 1, totalPages);
        const pages = Array.from({ length: end - start + 1 }, (_value, index) => start + index);
        const responses = await Promise.all(pages.map((page) => cardcloudRequest<unknown>(credentials, path, { token, query: { page } })));

        for (const response of responses) {
            all.push(...extractResponseItems(response, ['cards', 'data', 'items', 'records', 'results']));
        }

        if (end < totalPages) {
            await delay(CARDCLOUD_PAGE_BATCH_DELAY_MS);
        }
    }

    return dedupeCardcloudCards(all.map(normalizeCardcloudCard).filter((card): card is CardcloudCardSeed => Boolean(card)));
}

async function upsertCardcloudSubCompany(company: CompanySeed, subaccount: CardcloudSubaccountSeed): Promise<SyncedSubCompanySeed> {
    const existingBySubaccount = await prisma.subCompany.findUnique({
        where: {
            cardcloudSubaccountId: subaccount.id,
        },
        select: {
            id: true,
            key: true,
            name: true,
        },
    });

    if (existingBySubaccount) {
        const updated = await prisma.subCompany.update({
            where: {
                id: existingBySubaccount.id,
            },
            data: {
                name: subaccount.name,
                status: Status.active,
            },
            select: {
                id: true,
                key: true,
                name: true,
                cardcloudSubaccountId: true,
            },
        });

        return {
            id: updated.id,
            key: updated.key,
            name: updated.name,
            cardcloudSubaccountId: updated.cardcloudSubaccountId ?? subaccount.id,
        };
    }

    const existingByKey = await prisma.subCompany.findUnique({
        where: {
            companyId_key: {
                companyId: company.id,
                key: subaccount.key,
            },
        },
        select: {
            id: true,
            key: true,
            name: true,
            cardcloudSubaccountId: true,
        },
    });

    if (existingByKey && (!existingByKey.cardcloudSubaccountId || existingByKey.cardcloudSubaccountId === subaccount.id)) {
        const updated = await prisma.subCompany.update({
            where: {
                id: existingByKey.id,
            },
            data: {
                cardcloudSubaccountId: subaccount.id,
                name: subaccount.name,
                status: Status.active,
            },
            select: {
                id: true,
                key: true,
                name: true,
                cardcloudSubaccountId: true,
            },
        });

        return {
            id: updated.id,
            key: updated.key,
            name: updated.name,
            cardcloudSubaccountId: updated.cardcloudSubaccountId ?? subaccount.id,
        };
    }

    const key = existingByKey ? await resolveAvailableSubCompanyKey(company.id, subaccount.key) : subaccount.key;
    const created = await prisma.subCompany.create({
        data: {
            companyId: company.id,
            key,
            cardcloudSubaccountId: subaccount.id,
            name: subaccount.name,
            status: Status.active,
            isDefault: false,
        },
        select: {
            id: true,
            key: true,
            name: true,
            cardcloudSubaccountId: true,
        },
    });

    return {
        id: created.id,
        key: created.key,
        name: created.name,
        cardcloudSubaccountId: created.cardcloudSubaccountId ?? subaccount.id,
    };
}

async function resolveAvailableSubCompanyKey(companyId: string, baseKey: string): Promise<string> {
    const normalizedBase = normalizeSubCompanyKey(baseKey) || CARDCLOUD_SUB_COMPANY_KEY_PREFIX;

    for (let attempt = 2; attempt <= 100; attempt++) {
        const suffix = `-${attempt}`;
        const key = `${normalizedBase.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
        const existing = await prisma.subCompany.findUnique({
            where: {
                companyId_key: {
                    companyId,
                    key,
                },
            },
            select: {
                id: true,
            },
        });

        if (!existing) return key;
    }

    throw new Error(`No se encontró una clave disponible para la subcuenta Cardcloud ${baseKey}.`);
}

async function syncCardcloudStockCards(cards: CardcloudCardSeed[], subCompanyId?: string): Promise<CardcloudStockSyncStats> {
    const stats: CardcloudStockSyncStats = {
        stockSynced: 0,
        cardsCreated: 0,
        cardsMoved: 0,
        cardsLinked: 0,
        cardsSkipped: 0,
    };

    for (let index = 0; index < cards.length; index += CARDCLOUD_DB_CHUNK_SIZE) {
        const chunk = cards.slice(index, index + CARDCLOUD_DB_CHUNK_SIZE);
        const chunkStats = await prisma.$transaction(async (tx) => {
            const current: CardcloudStockSyncStats = {
                stockSynced: 0,
                cardsCreated: 0,
                cardsMoved: 0,
                cardsLinked: 0,
                cardsSkipped: 0,
            };

            for (const card of chunk) {
                if (!card.externalId) {
                    current.cardsSkipped++;
                    continue;
                }

                let assignedCardId: string | null | undefined;

                if (subCompanyId) {
                    const existingCard = await tx.card.findUnique({
                        where: {
                            externalId: card.externalId,
                        },
                        select: {
                            id: true,
                            subCompanyId: true,
                        },
                    });

                    if (existingCard) {
                        assignedCardId = existingCard.id;

                        if (existingCard.subCompanyId !== subCompanyId) {
                            await tx.card.update({
                                where: {
                                    id: existingCard.id,
                                },
                                data: {
                                    subCompanyId,
                                    vehicleId: null,
                                    assignmentMode: CardAssignmentMode.unassigned,
                                    assignedAt: null,
                                },
                                select: {
                                    id: true,
                                },
                            });
                            current.cardsMoved++;
                        }
                    } else {
                        const createdCard = await tx.card.create({
                            data: {
                                subCompanyId,
                                externalId: card.externalId,
                                assignmentMode: CardAssignmentMode.unassigned,
                                status: Status.active,
                                assignedAt: null,
                            },
                            select: {
                                id: true,
                            },
                        });

                        assignedCardId = createdCard.id;
                        current.cardsCreated++;
                    }

                    await tx.cardcloud.updateMany({
                        where: {
                            assignedCardId,
                            externalId: {
                                not: card.externalId,
                            },
                        },
                        data: {
                            assignedCardId: null,
                        },
                    });
                }

                const stockData = buildCardcloudStockData(card);
                const existingStock = await tx.cardcloud.findUnique({
                    where: {
                        externalId: card.externalId,
                    },
                    select: {
                        id: true,
                    },
                });

                if (existingStock) {
                    await tx.cardcloud.update({
                        where: {
                            id: existingStock.id,
                        },
                        data: {
                            ...stockData,
                            ...(subCompanyId ? { subCompanyId, assignedCardId: assignedCardId ?? null } : {}),
                        },
                    });
                } else {
                    await tx.cardcloud.create({
                        data: {
                            externalId: card.externalId,
                            subCompanyId: subCompanyId ?? null,
                            assignedCardId: assignedCardId ?? null,
                            maskedPan: stockData.maskedPan ?? null,
                            clientId: stockData.clientId ?? null,
                            balance: 'balance' in stockData ? (stockData.balance ?? null) : null,
                            providerStatus: stockData.providerStatus ?? null,
                        },
                    });
                }

                current.stockSynced++;
                if (subCompanyId) current.cardsLinked++;
            }

            return current;
        });

        stats.stockSynced += chunkStats.stockSynced;
        stats.cardsCreated += chunkStats.cardsCreated;
        stats.cardsMoved += chunkStats.cardsMoved;
        stats.cardsLinked += chunkStats.cardsLinked;
        stats.cardsSkipped += chunkStats.cardsSkipped;
    }

    return stats;
}

function buildCardcloudStockData(card: CardcloudCardSeed): {
    maskedPan?: string | null;
    clientId?: string | null;
    balance?: string | null;
    providerStatus?: string | null;
} {
    return {
        ...(card.maskedPan !== undefined ? { maskedPan: card.maskedPan } : {}),
        ...(card.clientId !== undefined ? { clientId: card.clientId } : {}),
        ...(card.balance !== undefined ? { balance: encryptBalance(card.balance) } : {}),
        ...(card.providerStatus !== undefined ? { providerStatus: card.providerStatus } : {}),
    };
}

async function cardcloudRequest<T>(credentials: CardcloudCredentials, path: string, options: CardcloudRequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };

    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`;
    }

    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    if (body) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(buildCardcloudUrl(credentials.baseUrl, path, options.query), {
        method,
        headers,
        body,
    });

    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Cardcloud ${method} ${path} respondió ${response.status}: ${text.slice(0, 300)}`);
    }

    if (!text) {
        return {} as T;
    }

    return JSON.parse(text) as T;
}

function buildCardcloudUrl(baseUrl: string, path: string, query?: CardcloudRequestOptions['query']): string {
    const url = new URL(`${baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`);

    for (const [key, value] of Object.entries(query ?? {})) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
    }

    return url.toString();
}

function extractResponseItems(value: unknown, preferredKeys: readonly string[]): unknown[] {
    if (Array.isArray(value)) return value;
    if (!isRecord(value)) return [];

    for (const key of preferredKeys) {
        const nested = value[key];
        const items = extractResponseItems(nested, preferredKeys);
        if (items.length > 0 || Array.isArray(nested)) return items;
    }

    for (const nested of Object.values(value)) {
        if (!Array.isArray(nested)) continue;
        return nested;
    }

    return [];
}

function normalizeCardcloudCard(value: unknown): CardcloudCardSeed | null {
    const externalId = resolveCardExternalId(value);
    if (!externalId) return null;
    if (!isRecord(value)) return { externalId };

    return {
        externalId,
        clientId: extractOptionalStringField(value, ['client_id', 'clientId']),
        maskedPan: maskPanKeepingLastFour(extractOptionalStringField(value, ['masked_pan', 'maskedPan'])),
        balance: extractOptionalValueField(value, ['balance', 'available_balance', 'availableBalance']),
        providerStatus: extractOptionalStringField(value, ['status', 'cardcloud_status', 'providerStatus']),
    };
}

function dedupeCardcloudCards(cards: CardcloudCardSeed[]): CardcloudCardSeed[] {
    const uniqueCards = new Map<string, CardcloudCardSeed>();

    for (const card of cards) {
        if (!uniqueCards.has(card.externalId)) {
            uniqueCards.set(card.externalId, card);
        }
    }

    return [...uniqueCards.values()];
}

function resolveSubaccountId(value: unknown): string | null {
    const primitive = cleanText(value);
    if (primitive) return primitive;

    const direct = extractStringField(value, ['subaccount_id', 'uuid', 'id']);
    if (direct) return direct;

    if (!isRecord(value)) return null;

    return resolveSubaccountId(value.data) ?? resolveSubaccountId(value.subaccount);
}

function resolveCardExternalId(value: unknown): string | null {
    const primitive = cleanText(value);
    if (primitive) return primitive;

    return extractStringField(value, ['card_id', 'card_external_id', 'externalId', 'external_id', 'uuid', 'id']);
}

function resolveSubCompanyKey(companyKey: string, subaccountId: string, value: unknown): string {
    const externalReference = extractStringField(value, ['ExternalId', 'external_id', 'externalId']);
    const prefix = `${companyKey}__`;

    if (externalReference?.startsWith(prefix)) {
        return normalizeSubCompanyKey(externalReference.slice(prefix.length));
    }

    return normalizeSubCompanyKey(externalReference ?? subaccountId) || `${CARDCLOUD_SUB_COMPANY_KEY_PREFIX}-${normalizeSubCompanyKey(subaccountId)}`;
}

function resolveSubCompanyName(subaccountId: string, value: unknown): string {
    return extractStringField(value, ['Description', 'description', 'name', 'Name', 'business_name', 'businessName', 'alias']) ?? `Subcuenta Cardcloud ${subaccountId}`;
}

function resolveTotalPages(value: unknown): number {
    const direct = extractNumberField(value, ['total_pages', 'totalPages', 'total_page', 'pages', 'last_page', 'lastPage']);
    if (direct) return direct;

    if (!isRecord(value)) return 1;

    return resolveTotalPages(value.meta);
}

function extractStringField(value: unknown, fields: readonly string[]): string | null {
    if (!isRecord(value)) return null;

    for (const field of fields) {
        const clean = cleanText(value[field]);
        if (clean) return clean;
    }

    return null;
}

function extractOptionalStringField(value: Record<string, unknown>, fields: readonly string[]): string | null | undefined {
    for (const field of fields) {
        if (field in value) return cleanText(value[field]);
    }

    return undefined;
}

function extractOptionalValueField(value: Record<string, unknown>, fields: readonly string[]): string | number | null | undefined {
    for (const field of fields) {
        if (field in value) {
            const fieldValue = value[field];
            if (typeof fieldValue === 'string' || typeof fieldValue === 'number' || fieldValue === null) return fieldValue;
            return undefined;
        }
    }

    return undefined;
}

function extractNumberField(value: unknown, fields: readonly string[]): number | null {
    if (!isRecord(value)) return null;

    for (const field of fields) {
        const raw = value[field];
        const parsed = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
        if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
    }

    return null;
}

function normalizeSubCompanyKey(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
}

function cleanText(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;

    const clean = String(value).trim();
    return clean || null;
}

function maskPanKeepingLastFour(value?: string | null): string | null | undefined {
    if (value === undefined) return undefined;

    const token = value?.replace(/[^0-9Xx]/g, '');
    const digits = token?.replace(/\D/g, '');
    if (!digits) return null;

    const lastFour = digits.slice(-4);
    const maskedLength = Math.max((token?.length ?? 0) - lastFour.length, 12);
    return `${'X'.repeat(maskedLength)}${lastFour}`;
}

function encryptBalance(value: unknown): string | null {
    const normalized = normalizeBalance(value);
    if (!normalized) return null;

    const encryptionKey = getRequiredEncryptionKey();
    const key = Buffer.from(encryptionKey, 'hex');
    const iv = randomBytes(BALANCE_ENCRYPTION_IV_LENGTH);
    const cipher = createCipheriv(BALANCE_ENCRYPTION_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function normalizeBalance(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;

    const parsed = Number(String(value).replace(/,/g, '').trim());
    if (!Number.isFinite(parsed)) return null;

    return parsed.toFixed(2);
}

function getRequiredEncryptionKey(): string {
    const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
    if (!encryptionKey || !ENCRYPTION_KEY_PATTERN.test(encryptionKey)) {
        throw new Error('ENCRYPTION_KEY debe tener 64 caracteres hexadecimales para sincronizar saldos Cardcloud.');
    }

    return encryptionKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

    const cardcloudResult = await seedCardcloudSubaccounts(company);

    const adminUser = await seedAdminUser(adminRole.id, company.id);

    console.log('Seed completado correctamente.');

    console.log(`Compañía: ${company.name} (${company.key})`);

    console.log(`Subcompañía: ${subCompany.name} (${subCompany.key})`);

    console.log(`Combustibles: ${fuelCount}`);

    if (cardcloudResult.enabled) {
        console.log(
            [
                `Cardcloud: ${cardcloudResult.subaccountsFetched} subcuentas consultadas`,
                `${cardcloudResult.subCompaniesSynced} subempresas vinculadas`,
                `${cardcloudResult.accountCardsFetched} tarjetas de cuenta`,
                `${cardcloudResult.subaccountCardsFetched} tarjetas en subcuentas`,
                `${cardcloudResult.stockSynced} stock sincronizado`,
                `${cardcloudResult.cardsCreated} tarjetas locales creadas`,
                `${cardcloudResult.cardsMoved} tarjetas locales movidas`,
            ].join(', ')
        );
    } else {
        console.log(`Cardcloud: omitido (${cardcloudResult.skippedReason}).`);
    }

    console.log(`Administrador: ${adminUser.username}`);

    console.log(`Roles: ${[adminRole.code, ...roles.map(({ code }) => code)].join(', ')}`);

    console.log('Datos creados: permisos, roles, usuarios, compañía, subcompañía por defecto, combustibles y vínculos Cardcloud cuando hay credenciales.');
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
