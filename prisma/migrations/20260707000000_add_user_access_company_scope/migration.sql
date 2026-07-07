ALTER TABLE "user_accesses"
    ADD COLUMN IF NOT EXISTS "companyId" TEXT;

UPDATE "user_accesses" AS ua
SET "companyId" = ua."scopeId"
FROM "companies" AS c
WHERE ua."companyId" IS NULL
    AND ua."scopeKey" = 'companyId'
    AND ua."scopeId" = c."id"
    AND ua."organizationId" = c."organizationId";

CREATE INDEX IF NOT EXISTS "user_accesses_companyId_idx"
    ON "user_accesses" ("companyId");

CREATE INDEX IF NOT EXISTS "user_accesses_userId_organizationId_companyId_idx"
    ON "user_accesses" ("userId", "organizationId", "companyId");

ALTER TABLE "user_accesses"
    DROP CONSTRAINT IF EXISTS "user_accesses_companyId_fkey";

ALTER TABLE "user_accesses"
    ADD CONSTRAINT "user_accesses_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "user_accesses_organization_active_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "user_accesses_organization_active_unique"
    ON "user_accesses" ("userId", "roleId", "organizationId")
    WHERE "organizationId" IS NOT NULL
        AND "companyId" IS NULL
        AND "scopeKey" IS NULL
        AND "scopeId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_accesses_company_active_unique"
    ON "user_accesses" ("userId", "roleId", "organizationId", "companyId")
    WHERE "organizationId" IS NOT NULL
        AND "companyId" IS NOT NULL
        AND "scopeKey" IS NULL
        AND "scopeId" IS NULL;
