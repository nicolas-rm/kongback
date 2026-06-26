-- Add partial unique indexes for soft-deletable records.
-- Prisma schema cannot express unique constraints filtered by deletedAt.

CREATE UNIQUE INDEX IF NOT EXISTS users_username_active_unique
    ON users (username)
    WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_unique
    ON users (email)
    WHERE "deletedAt" IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_active_unique
    ON organizations (slug)
    WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS roles_code_active_unique
    ON roles (code)
    WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS permissions_code_active_unique
    ON permissions (code)
    WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_active_unique
    ON organization_memberships ("organizationId", "userId")
    WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_accesses_global_active_unique
    ON user_accesses ("userId", "roleId")
    WHERE "deletedAt" IS NULL
        AND "organizationId" IS NULL
        AND "scopeKey" IS NULL
        AND "scopeId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_accesses_scoped_active_unique
    ON user_accesses ("userId", "roleId", "scopeKey", "scopeId")
    WHERE "deletedAt" IS NULL
        AND "scopeKey" IS NOT NULL
        AND "scopeId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS settings_global_key_active_unique
    ON settings (key)
    WHERE "deletedAt" IS NULL
        AND scope = 'global'
        AND "organizationId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS settings_organization_key_active_unique
    ON settings ("organizationId", key)
    WHERE "deletedAt" IS NULL
        AND scope = 'organization'
        AND "organizationId" IS NOT NULL;
