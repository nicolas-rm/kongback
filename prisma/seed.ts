import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { NotificationType, PrismaClient, UserStatus } from '@prisma/client';
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
const ADMIN_ROLE_DESCRIPTION = 'Rol bootstrap con acceso completo a todos los permisos del sistema.';
const ORGANIZATION_ADMIN_ROLE_CODE = 'organization-admin';
const ORGANIZATION_ADMIN_ROLE_NAME = 'Administrador de organización';
const ORGANIZATION_ADMIN_ROLE_DESCRIPTION = 'Rol scoped para gestionar usuarios, documentos y notificaciones dentro de una organización.';
const ORGANIZATION_SCOPE_KEY = 'organization';

const DEMO_OPERATOR_DEFAULTS = {
    username: 'demo.operator',
    password: 'ChangeMe123!',
    fullName: 'Demo Operator',
    email: 'demo.operator@example.com',
};

const DEMO_ORGANIZATION_DEFINITIONS = [
    {
        name: 'Demo Workspace Norte',
        slug: 'demo-workspace-norte',
        description: 'Workspace demo para validar acceso multi-tenant, documentos y notificaciones.',
        document: {
            title: 'Guia de onboarding Norte',
            originalName: 'guia-onboarding-norte.txt',
            description: 'Documento demo para validar scoping por organización en el workspace Norte.',
            category: 'demo-onboarding',
            content: ['Demo Workspace Norte', '', '1. Inicia sesión con el usuario demo.', '2. Envía el header x-organization-id con el ID del workspace Norte.', '3. Consulta /api/documents y valida que solo veas recursos de este tenant.', '4. Revisa /api/notifications y el namespace /notifications.'].join('\n'),
        },
        notificationId: '0fbb3d46-29d2-4f57-8e62-04531d4d0001',
        notificationTitle: 'Workspace Norte listo',
        notificationMessage: 'El tenant Norte ya tiene documentos y permisos demo para validar aislamiento.',
    },
    {
        name: 'Demo Workspace Sur',
        slug: 'demo-workspace-sur',
        description: 'Workspace demo alterno para probar cambio de contexto usando x-organization-id.',
        document: {
            title: 'Checklist operativo Sur',
            originalName: 'checklist-operativo-sur.txt',
            description: 'Documento demo para validar cambio de contexto entre workspaces.',
            category: 'demo-operations',
            content: ['Demo Workspace Sur', '', '1. Cambia el valor de x-organization-id al ID del workspace Sur.', '2. Repite la consulta a /api/documents.', '3. Verifica que ahora solo aparezcan documentos del Sur.', '4. Confirma que el acceso sigue restringido al mismo usuario demo.'].join('\n'),
        },
        notificationId: '0fbb3d46-29d2-4f57-8e62-04531d4d0002',
        notificationTitle: 'Workspace Sur listo',
        notificationMessage: 'Cambia el header tenant para validar el aislamiento de datos entre Norte y Sur.',
    },
] as const;

const ADMIN_NOTIFICATION_ID = '0fbb3d46-29d2-4f57-8e62-04531d4d0003';

type RoleSeed = {
    id: string;
    code: string;
};

type OrganizationSeed = {
    id: string;
    name: string;
    slug: string;
};

type UserSeed = {
    id: string;
    username: string;
    fullName: string;
    password: string;
};

function getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`${name} es requerido para ejecutar prisma/seed.ts`);
    }

    return value;
}

function getOptionalEnv(name: string, fallback: string): string {
    const value = process.env[name]?.trim();
    return value && value.length > 0 ? value : fallback;
}

function getDocumentsStorageDir(): string {
    const configuredDir = process.env.DOCUMENTS_STORAGE_DIR?.trim() || 'uploads/documents';

    if (path.isAbsolute(configuredDir)) {
        return configuredDir;
    }

    return path.resolve(process.cwd(), configuredDir);
}

function resolveDocumentAbsolutePath(storageKey: string): string {
    const normalized = path.posix.normalize(storageKey.replace(/\\/g, '/'));

    if (normalized.startsWith('..') || path.posix.isAbsolute(normalized)) {
        throw new Error(`storageKey inválido para seed: ${storageKey}`);
    }

    const baseDirectory = getDocumentsStorageDir();
    const absolutePath = path.resolve(baseDirectory, normalized);
    const baseWithSeparator = `${baseDirectory}${path.sep}`;

    if (absolutePath !== baseDirectory && !absolutePath.startsWith(baseWithSeparator)) {
        throw new Error(`storageKey inválido para seed: ${storageKey}`);
    }

    return absolutePath;
}

async function writeDemoDocumentFile(storageKey: string, content: string) {
    const buffer = Buffer.from(content, 'utf8');
    const absolutePath = resolveDocumentAbsolutePath(storageKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);

    const extension = path.posix.extname(storageKey).toLowerCase() || null;

    return {
        sizeBytes: buffer.byteLength,
        checksumSha256: createHash('sha256').update(buffer).digest('hex'),
        extension,
    };
}

async function seedPermissions(): Promise<void> {
    await prisma.permission.createMany({
        data: PERMISSION_CATALOG.map((permission) => ({
            code: permission.code,
            name: permission.name,
            description: permission.description,
        })),
        skipDuplicates: true,
    });
}

async function upsertRole(code: string, name: string, description: string): Promise<RoleSeed> {
    return prisma.role.upsert({
        where: { code },
        update: {
            name,
            description,
        },
        create: {
            code,
            name,
            description,
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
        if (permissionIds.length === 0) {
            await tx.rolePermission.deleteMany({ where: { roleId } });
            return;
        }

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
    const password = getRequiredEnv('ADMIN_PASSWORD');
    const fullName = getRequiredEnv('ADMIN_FULL_NAME');
    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.upsert({
        where: { username },
        update: {
            fullName,
            passwordHash,
            status: UserStatus.active,
        },
        create: {
            username,
            email: null,
            fullName,
            passwordHash,
            status: UserStatus.active,
        },
        select: { id: true, username: true, fullName: true },
    });

    const globalAccess = await prisma.userAccess.findFirst({
        where: {
            userId: user.id,
            roleId,
            scopeKey: null,
            scopeId: null,
        },
        select: { id: true },
    });

    if (!globalAccess) {
        await prisma.userAccess.create({
            data: {
                userId: user.id,
                roleId,
                organizationId: null,
                scopeKey: null,
                scopeId: null,
            },
        });
    }

    return {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        password,
    };
}

async function seedOrganizations(): Promise<OrganizationSeed[]> {
    const organizations: OrganizationSeed[] = [];

    for (const definition of DEMO_ORGANIZATION_DEFINITIONS) {
        const organization = await prisma.organization.upsert({
            where: { slug: definition.slug },
            update: {
                name: definition.name,
                description: definition.description,
                status: 'active',
            },
            create: {
                name: definition.name,
                slug: definition.slug,
                description: definition.description,
                status: 'active',
            },
            select: {
                id: true,
                name: true,
                slug: true,
            },
        });

        organizations.push(organization);
    }

    return organizations;
}

async function seedDemoOperator(roleId: string, organizations: OrganizationSeed[]): Promise<UserSeed> {
    const username = getOptionalEnv('DEMO_USERNAME', DEMO_OPERATOR_DEFAULTS.username);
    const password = getOptionalEnv('DEMO_PASSWORD', DEMO_OPERATOR_DEFAULTS.password);
    const fullName = getOptionalEnv('DEMO_FULL_NAME', DEMO_OPERATOR_DEFAULTS.fullName);
    const email = getOptionalEnv('DEMO_EMAIL', DEMO_OPERATOR_DEFAULTS.email);
    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.upsert({
        where: { username },
        update: {
            email,
            fullName,
            passwordHash,
            status: UserStatus.active,
        },
        create: {
            username,
            email,
            fullName,
            passwordHash,
            status: UserStatus.active,
        },
        select: {
            id: true,
            username: true,
            fullName: true,
        },
    });

    await prisma.organizationMembership.createMany({
        data: organizations.map((organization) => ({
            userId: user.id,
            organizationId: organization.id,
        })),
        skipDuplicates: true,
    });

    await prisma.userAccess.createMany({
        data: organizations.map((organization) => ({
            userId: user.id,
            roleId,
            organizationId: organization.id,
            scopeKey: ORGANIZATION_SCOPE_KEY,
            scopeId: organization.id,
        })),
        skipDuplicates: true,
    });

    return {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        password,
    };
}

async function seedDemoDocuments(organizations: OrganizationSeed[], uploadedByUserId: string) {
    const documents: Array<{ id: string; title: string | null; organizationId: string | null }> = [];

    for (const definition of DEMO_ORGANIZATION_DEFINITIONS) {
        const organization = organizations.find((candidate) => candidate.slug === definition.slug);

        if (!organization) {
            continue;
        }

        const storageKey = path.posix.join('seed', organization.slug, definition.document.originalName);
        const storedFile = await writeDemoDocumentFile(storageKey, definition.document.content);

        const document = await prisma.document.upsert({
            where: { storageKey },
            update: {
                title: definition.document.title,
                originalName: definition.document.originalName,
                description: definition.document.description,
                category: definition.document.category,
                mimeType: 'text/plain',
                extension: storedFile.extension,
                sizeBytes: storedFile.sizeBytes,
                checksumSha256: storedFile.checksumSha256,
                organizationId: organization.id,
                scopeKey: ORGANIZATION_SCOPE_KEY,
                scopeId: organization.id,
                entityType: 'organization',
                entityId: organization.id,
                uploadedByUserId,
            },
            create: {
                title: definition.document.title,
                originalName: definition.document.originalName,
                description: definition.document.description,
                category: definition.document.category,
                mimeType: 'text/plain',
                extension: storedFile.extension,
                sizeBytes: storedFile.sizeBytes,
                checksumSha256: storedFile.checksumSha256,
                storageKey,
                organizationId: organization.id,
                scopeKey: ORGANIZATION_SCOPE_KEY,
                scopeId: organization.id,
                entityType: 'organization',
                entityId: organization.id,
                uploadedByUserId,
            },
            select: {
                id: true,
                title: true,
                organizationId: true,
            },
        });

        documents.push(document);
    }

    return documents;
}

async function seedDemoNotifications(adminUser: UserSeed, demoUser: UserSeed, organizations: OrganizationSeed[], documents: Array<{ id: string; title: string | null; organizationId: string | null }>) {
    for (const definition of DEMO_ORGANIZATION_DEFINITIONS) {
        const organization = organizations.find((candidate) => candidate.slug === definition.slug);
        const document = documents.find((candidate) => candidate.organizationId === organization?.id);

        if (!organization) {
            continue;
        }

        await prisma.notification.upsert({
            where: { id: definition.notificationId },
            update: {
                userId: demoUser.id,
                title: definition.notificationTitle,
                message: definition.notificationMessage,
                detail: `Envía x-organization-id: ${organization.id} para consultar únicamente los recursos de ${organization.name}.`,
                type: NotificationType.success,
                link: document ? `/documents/${document.id}` : `/organizations/${organization.id}`,
                isRead: false,
                readAt: null,
            },
            create: {
                id: definition.notificationId,
                userId: demoUser.id,
                title: definition.notificationTitle,
                message: definition.notificationMessage,
                detail: `Envía x-organization-id: ${organization.id} para consultar únicamente los recursos de ${organization.name}.`,
                type: NotificationType.success,
                link: document ? `/documents/${document.id}` : `/organizations/${organization.id}`,
                isRead: false,
                readAt: null,
            },
        });
    }

    await prisma.notification.upsert({
        where: { id: ADMIN_NOTIFICATION_ID },
        update: {
            userId: adminUser.id,
            title: 'Seed demo completado',
            message: 'Se crearon organizaciones, accesos scoped, documentos demo y notificaciones para validar multi-tenant.',
            detail: `Usuario demo: ${demoUser.username}. Organizaciones: ${organizations.map((organization) => `${organization.name} (${organization.id})`).join(', ')}`,
            type: NotificationType.info,
            link: '/organizations',
            isRead: true,
            readAt: new Date(),
        },
        create: {
            id: ADMIN_NOTIFICATION_ID,
            userId: adminUser.id,
            title: 'Seed demo completado',
            message: 'Se crearon organizaciones, accesos scoped, documentos demo y notificaciones para validar multi-tenant.',
            detail: `Usuario demo: ${demoUser.username}. Organizaciones: ${organizations.map((organization) => `${organization.name} (${organization.id})`).join(', ')}`,
            type: NotificationType.info,
            link: '/organizations',
            isRead: true,
            readAt: new Date(),
        },
    });
}

async function main(): Promise<void> {
    await seedPermissions();
    const adminRole = await upsertRole(ADMIN_ROLE_CODE, ADMIN_ROLE_NAME, ADMIN_ROLE_DESCRIPTION);
    const organizationAdminRole = await upsertRole(ORGANIZATION_ADMIN_ROLE_CODE, ORGANIZATION_ADMIN_ROLE_NAME, ORGANIZATION_ADMIN_ROLE_DESCRIPTION);
    await syncAdminRolePermissions(adminRole.id);
    await syncAdminRolePermissions(organizationAdminRole.id);

    const adminUser = await seedAdminUser(adminRole.id);
    const organizations = await seedOrganizations();
    const demoUser = await seedDemoOperator(organizationAdminRole.id, organizations);
    const documents = await seedDemoDocuments(organizations, demoUser.id);
    await seedDemoNotifications(adminUser, demoUser, organizations, documents);

    console.log('Seed completado correctamente.');
    console.log(`Admin global: ${adminUser.username} / ${adminUser.password}`);
    console.log(`Usuario demo multi-tenant: ${demoUser.username} / ${demoUser.password}`);
    console.log('Organizaciones demo disponibles:');
    for (const organization of organizations) {
        console.log(`- ${organization.name} | slug=${organization.slug} | id=${organization.id}`);
    }
    console.log('Usa x-organization-id o x-workspace-id con cualquiera de esos IDs para validar el scoping tenant-aware.');
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
