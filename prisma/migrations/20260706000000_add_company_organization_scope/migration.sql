INSERT INTO "organizations" ("id", "name", "slug", "description", "status", "createdAt", "updatedAt")
SELECT
    '00000000-0000-4000-8000-000000000001',
    'Default Organization',
    'default-organization',
    'Backfilled tenant for existing companies.',
    'active',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "organizations");

ALTER TABLE "companies" ADD COLUMN "organizationId" TEXT;

UPDATE "companies"
SET "organizationId" = (
    SELECT "id"
    FROM "organizations"
    ORDER BY "createdAt" ASC
    LIMIT 1
)
WHERE "organizationId" IS NULL;

ALTER TABLE "companies" ALTER COLUMN "organizationId" SET NOT NULL;

DROP INDEX IF EXISTS "companies_key_key";
DROP INDEX IF EXISTS "companies_external_id_key";

CREATE INDEX "companies_organizationId_idx" ON "companies"("organizationId");
CREATE UNIQUE INDEX "companies_organizationId_key_key" ON "companies"("organizationId", "key");
CREATE UNIQUE INDEX "companies_organizationId_external_id_key" ON "companies"("organizationId", "external_id");

ALTER TABLE "companies"
ADD CONSTRAINT "companies_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cardcloud_card_stock" ADD COLUMN "organizationId" TEXT;

UPDATE "cardcloud_card_stock" AS stock
SET "organizationId" = companies."organizationId"
FROM "cards" AS cards
INNER JOIN "sub_companies" AS sub_companies ON sub_companies."id" = cards."subCompanyId"
INNER JOIN "companies" AS companies ON companies."id" = sub_companies."companyId"
WHERE stock."assignedCardId" = cards."id";

UPDATE "cardcloud_card_stock"
SET "organizationId" = (
    SELECT "id"
    FROM "organizations"
    ORDER BY "createdAt" ASC
    LIMIT 1
)
WHERE "organizationId" IS NULL;

ALTER TABLE "cardcloud_card_stock" ALTER COLUMN "organizationId" SET NOT NULL;

CREATE INDEX "cardcloud_card_stock_organizationId_idx" ON "cardcloud_card_stock"("organizationId");

ALTER TABLE "cardcloud_card_stock"
ADD CONSTRAINT "cardcloud_card_stock_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
