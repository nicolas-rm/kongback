-- Collapse workspace tenancy into companies. Company is now the tenant scope.

ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_organizationId_fkey";
ALTER TABLE "user_accesses" DROP CONSTRAINT IF EXISTS "user_accesses_organizationId_fkey";
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_organizationId_fkey";
ALTER TABLE "settings" DROP CONSTRAINT IF EXISTS "settings_organizationId_fkey";
ALTER TABLE "companies" DROP CONSTRAINT IF EXISTS "companies_organizationId_fkey";
ALTER TABLE "cardcloud_card_stock" DROP CONSTRAINT IF EXISTS "cardcloud_card_stock_organizationId_fkey";

ALTER TABLE "organization_invitations" DROP CONSTRAINT IF EXISTS "organization_invitations_organizationId_fkey";
ALTER TABLE "organization_invitations" DROP CONSTRAINT IF EXISTS "organization_invitations_roleId_fkey";
ALTER TABLE "organization_invitations" DROP CONSTRAINT IF EXISTS "organization_invitations_invitedByUserId_fkey";
ALTER TABLE "organization_invitations" DROP CONSTRAINT IF EXISTS "organization_invitations_acceptedByUserId_fkey";
ALTER TABLE "organization_memberships" DROP CONSTRAINT IF EXISTS "organization_memberships_organizationId_fkey";
ALTER TABLE "organization_memberships" DROP CONSTRAINT IF EXISTS "organization_memberships_userId_fkey";
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_createdByUserId_fkey";
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_updatedByUserId_fkey";

DROP INDEX IF EXISTS "companies_organizationId_idx";
DROP INDEX IF EXISTS "companies_organizationId_key_key";
DROP INDEX IF EXISTS "companies_organizationId_external_id_key";
DROP INDEX IF EXISTS "cardcloud_card_stock_organizationId_idx";
DROP INDEX IF EXISTS "user_accesses_organizationId_idx";
DROP INDEX IF EXISTS "user_accesses_userId_organizationId_companyId_idx";
DROP INDEX IF EXISTS "user_accesses_organization_active_unique";
DROP INDEX IF EXISTS "user_accesses_company_active_unique";
DROP INDEX IF EXISTS "user_accesses_global_active_unique";
DROP INDEX IF EXISTS "settings_scope_organizationId_idx";
DROP INDEX IF EXISTS "settings_organizationId_idx";
DROP INDEX IF EXISTS "settings_global_key_active_unique";
DROP INDEX IF EXISTS "settings_organization_key_active_unique";
DROP INDEX IF EXISTS "documents_organizationId_idx";

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

UPDATE "documents" AS document
SET "companyId" = company."id"
FROM "companies" AS company
WHERE document."companyId" IS NULL
    AND (
        (document."scopeKey" = 'companyId' AND document."scopeId" = company."id")
        OR (document."entityType" = 'company' AND document."entityId" = company."id")
    );

ALTER TABLE "cardcloud_card_stock" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

UPDATE "cardcloud_card_stock" AS stock
SET "companyId" = sub_company."companyId"
FROM "cards" AS card
INNER JOIN "sub_companies" AS sub_company ON sub_company."id" = card."subCompanyId"
WHERE stock."companyId" IS NULL
    AND stock."assignedCardId" = card."id";

DELETE FROM "cardcloud_card_stock"
WHERE "companyId" IS NULL;

ALTER TABLE "cardcloud_card_stock" ALTER COLUMN "companyId" SET NOT NULL;

INSERT INTO "user_accesses" ("id", "userId", "roleId", "companyId", "scopeKey", "scopeId", "assignedAt", "createdAt", "updatedAt")
SELECT md5(access."id" || company."id"), access."userId", access."roleId", company."id", access."scopeKey", access."scopeId", access."assignedAt", access."createdAt", CURRENT_TIMESTAMP
FROM "user_accesses" AS access
INNER JOIN "companies" AS company ON company."organizationId" = access."organizationId"
WHERE access."organizationId" IS NOT NULL
    AND access."companyId" IS NULL
    AND NOT EXISTS (
        SELECT 1
        FROM "user_accesses" AS existing
        WHERE existing."userId" = access."userId"
            AND existing."roleId" = access."roleId"
            AND existing."companyId" = company."id"
            AND existing."scopeKey" IS NOT DISTINCT FROM access."scopeKey"
            AND existing."scopeId" IS NOT DISTINCT FROM access."scopeId"
    );

DELETE FROM "user_accesses"
WHERE "organizationId" IS NOT NULL
    AND "companyId" IS NULL;

DELETE FROM "settings"
WHERE "scope"::text <> 'global';

ALTER TABLE "sessions" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "user_accesses" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "documents" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "settings" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "cardcloud_card_stock" DROP COLUMN IF EXISTS "organizationId";

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SettingScope') THEN
        ALTER TABLE "settings" ALTER COLUMN "scope" DROP DEFAULT;
        ALTER TYPE "SettingScope" RENAME TO "SettingScope_old";
        CREATE TYPE "SettingScope" AS ENUM ('global');
        ALTER TABLE "settings" ALTER COLUMN "scope" TYPE "SettingScope" USING ("scope"::text::"SettingScope");
        ALTER TABLE "settings" ALTER COLUMN "scope" SET DEFAULT 'global';
        DROP TYPE "SettingScope_old";
    END IF;
END $$;

DROP TABLE IF EXISTS "organization_invitations" CASCADE;
DROP TABLE IF EXISTS "organization_memberships" CASCADE;
DROP TABLE IF EXISTS "organizations" CASCADE;

DROP TYPE IF EXISTS "OrganizationInvitationStatus";
DROP TYPE IF EXISTS "OrganizationStatus";

CREATE UNIQUE INDEX IF NOT EXISTS "companies_key_key" ON "companies"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "companies_external_id_key" ON "companies"("external_id");

CREATE INDEX IF NOT EXISTS "documents_companyId_idx" ON "documents"("companyId");
CREATE INDEX IF NOT EXISTS "cardcloud_card_stock_companyId_idx" ON "cardcloud_card_stock"("companyId");
CREATE INDEX IF NOT EXISTS "user_accesses_userId_companyId_idx" ON "user_accesses"("userId", "companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "user_accesses_global_active_unique"
    ON "user_accesses" ("userId", "roleId")
    WHERE "companyId" IS NULL
        AND "scopeKey" IS NULL
        AND "scopeId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_accesses_company_active_unique"
    ON "user_accesses" ("userId", "roleId", "companyId")
    WHERE "companyId" IS NOT NULL
        AND "scopeKey" IS NULL
        AND "scopeId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "settings_global_key_active_unique"
    ON "settings" ("key")
    WHERE "scope" = 'global';

ALTER TABLE "documents"
    ADD CONSTRAINT "documents_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cardcloud_card_stock"
    ADD CONSTRAINT "cardcloud_card_stock_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
