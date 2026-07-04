import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Status } from '@prisma/client';
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

type RoleSeed = {
    id: string;
    code: string;
};

type UserSeed = {
    id: string;
    username: string;
    fullName: string;
};

function getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`${name} es requerido para ejecutar prisma/seed.ts`);
    }

    return value;
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
    const permissions = await prisma.permission.findMany({
        where: { code: { in: [...ALL_PERMISSION_CODES] } },
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

async function main(): Promise<void> {
    await seedPermissions();

    const adminRole = await upsertAdminRole();
    await syncRolePermissions(adminRole.id);

    const adminUser = await seedAdminUser(adminRole.id);

    console.log('Seed completado correctamente.');
    console.log(`Admin global: ${adminUser.username}`);
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
