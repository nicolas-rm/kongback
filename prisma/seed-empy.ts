import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Status } from '@prisma/client';
import { Pool } from 'pg';
import { ALL_PERMISSION_CODES, PERMISSION_CATALOG } from './permission-catalog';

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
        throw new Error(`${name} es requerido para ejecutar prisma/seed-empy.ts`);
    }

    return value;
}

async function seedPermissions(): Promise<void> {
    for (const permission of PERMISSION_CATALOG) {
        await prisma.permission.upsert({
            where: { code: permission.code },
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

async function upsertAdminRole(): Promise<RoleSeed> {
    return prisma.role.upsert({
        where: { code: ADMIN_ROLE_CODE },
        create: {
            code: ADMIN_ROLE_CODE,
            name: ADMIN_ROLE_NAME,
            description: ADMIN_ROLE_DESCRIPTION,
        },
        update: {
            name: ADMIN_ROLE_NAME,
            description: ADMIN_ROLE_DESCRIPTION,
        },
        select: { id: true, code: true },
    });
}

async function syncAdminRolePermissions(roleId: string): Promise<void> {
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
        where: { username },
        select: { id: true },
    });

    const user = existing
        ? await prisma.user.update({
              where: { id: existing.id },
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
              select: { id: true, username: true, fullName: true },
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
              select: { id: true, username: true, fullName: true },
          });

    await ensureGlobalAdminAccess(user.id, roleId);

    return user;
}

async function ensureGlobalAdminAccess(userId: string, roleId: string): Promise<void> {
    const existing = await prisma.userAccess.findFirst({
        where: {
            userId,
            roleId,
            companyId: null,
            scopeKey: null,
            scopeId: null,
        },
        select: { id: true },
    });

    if (existing) return;

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

async function main(): Promise<void> {
    await seedPermissions();

    const adminRole = await upsertAdminRole();
    await syncAdminRolePermissions(adminRole.id);

    const adminUser = await seedAdminUser(adminRole.id);

    console.log('Seed empty completado correctamente.');
    console.log(`Admin global: ${adminUser.username}`);
    console.log('Datos creados: permisos, rol admin, usuario admin y acceso global.');
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
