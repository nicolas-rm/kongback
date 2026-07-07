-- Partial unique indexes for nullable scoped records.
-- Prisma schema cannot express these PostgreSQL filtered unique indexes.

CREATE UNIQUE INDEX IF NOT EXISTS user_accesses_global_active_unique
    ON user_accesses ("userId", "roleId")
    WHERE "companyId" IS NULL
        AND "scopeKey" IS NULL
        AND "scopeId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_accesses_company_active_unique
    ON user_accesses ("userId", "roleId", "companyId")
    WHERE "companyId" IS NOT NULL
        AND "scopeKey" IS NULL
        AND "scopeId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_accesses_scoped_active_unique
    ON user_accesses ("userId", "roleId", "scopeKey", "scopeId")
    WHERE "scopeKey" IS NOT NULL
        AND "scopeId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS settings_global_key_active_unique
    ON settings (key)
    WHERE scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS sub_companies_default_per_company_unique
    ON sub_companies ("companyId")
    WHERE "isDefault" = true;
