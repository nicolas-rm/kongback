-- Simplify soft delete usage.
-- Keep soft delete only for documents; use status, hard deletes, cascade, set null, or restrict elsewhere.

-- Drop old partial unique indexes that depended on deletedAt.
DROP INDEX IF EXISTS "users_username_active_unique";
DROP INDEX IF EXISTS "users_email_active_unique";
DROP INDEX IF EXISTS "organizations_slug_active_unique";
DROP INDEX IF EXISTS "roles_code_active_unique";
DROP INDEX IF EXISTS "permissions_code_active_unique";
DROP INDEX IF EXISTS "organization_memberships_active_unique";
DROP INDEX IF EXISTS "user_accesses_global_active_unique";
DROP INDEX IF EXISTS "user_accesses_organization_active_unique";
DROP INDEX IF EXISTS "user_accesses_scoped_active_unique";
DROP INDEX IF EXISTS "settings_global_key_active_unique";
DROP INDEX IF EXISTS "settings_organization_key_active_unique";

-- Drop regular indexes that become redundant or reference removed columns.
DROP INDEX IF EXISTS "users_username_idx";
DROP INDEX IF EXISTS "users_email_idx";
DROP INDEX IF EXISTS "users_deletedAt_createdAt_idx";
DROP INDEX IF EXISTS "organizations_slug_idx";
DROP INDEX IF EXISTS "organizations_deletedByUserId_idx";
DROP INDEX IF EXISTS "organizations_deletedAt_createdAt_idx";
DROP INDEX IF EXISTS "organization_memberships_organizationId_userId_idx";
DROP INDEX IF EXISTS "organization_memberships_deletedAt_createdAt_idx";
DROP INDEX IF EXISTS "roles_code_idx";
DROP INDEX IF EXISTS "roles_deletedByUserId_idx";
DROP INDEX IF EXISTS "roles_deletedAt_createdAt_idx";
DROP INDEX IF EXISTS "permissions_code_idx";
DROP INDEX IF EXISTS "permissions_deletedByUserId_idx";
DROP INDEX IF EXISTS "permissions_deletedAt_createdAt_idx";
DROP INDEX IF EXISTS "user_accesses_deletedAt_createdAt_idx";
DROP INDEX IF EXISTS "notifications_deletedByUserId_idx";
DROP INDEX IF EXISTS "notifications_userId_deletedAt_createdAt_idx";
DROP INDEX IF EXISTS "settings_deletedByUserId_idx";
DROP INDEX IF EXISTS "settings_deletedAt_createdAt_idx";

-- Drop foreign keys owned by removed deletedByUserId columns.
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_deletedByUserId_fkey";
ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_deletedByUserId_fkey";
ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "permissions_deletedByUserId_fkey";
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_deletedByUserId_fkey";
ALTER TABLE "settings" DROP CONSTRAINT IF EXISTS "settings_deletedByUserId_fkey";

-- Remove soft-delete columns from models that now use another lifecycle strategy.
ALTER TABLE "users" DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "deletedByUserId";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "organization_memberships" DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "roles" DROP COLUMN IF EXISTS "deletedByUserId";
ALTER TABLE "roles" DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "permissions" DROP COLUMN IF EXISTS "deletedByUserId";
ALTER TABLE "permissions" DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "user_accesses" DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "deletedByUserId";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "settings" DROP COLUMN IF EXISTS "deletedByUserId";
ALTER TABLE "settings" DROP COLUMN IF EXISTS "deletedAt";

-- Direct unique constraints now that soft-delete reuse is gone.
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users" ("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_key" ON "organizations" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "organization_memberships_organizationId_userId_key" ON "organization_memberships" ("organizationId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "roles_code_key" ON "roles" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_code_key" ON "permissions" ("code");

-- Scoped uniqueness still needs PostgreSQL partial indexes because of nullable fields.
CREATE UNIQUE INDEX IF NOT EXISTS "user_accesses_global_active_unique"
    ON "user_accesses" ("userId", "roleId")
    WHERE "organizationId" IS NULL
        AND "scopeKey" IS NULL
        AND "scopeId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_accesses_organization_active_unique"
    ON "user_accesses" ("userId", "roleId", "organizationId")
    WHERE "organizationId" IS NOT NULL
        AND "scopeKey" IS NULL
        AND "scopeId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_accesses_scoped_active_unique"
    ON "user_accesses" ("userId", "roleId", "scopeKey", "scopeId")
    WHERE "scopeKey" IS NOT NULL
        AND "scopeId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "settings_global_key_active_unique"
    ON "settings" ("key")
    WHERE scope = 'global'
        AND "organizationId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "settings_organization_key_active_unique"
    ON "settings" ("organizationId", "key")
    WHERE scope = 'organization'
        AND "organizationId" IS NOT NULL;
