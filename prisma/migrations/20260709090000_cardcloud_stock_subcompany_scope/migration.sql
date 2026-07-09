ALTER TABLE "cardcloud_card_stock" DROP CONSTRAINT IF EXISTS "cardcloud_card_stock_companyId_fkey";

ALTER TABLE "cardcloud_card_stock" ADD COLUMN IF NOT EXISTS "subCompanyId" TEXT;

UPDATE "cardcloud_card_stock" AS stock
SET "subCompanyId" = card."subCompanyId"
FROM "cards" AS card
WHERE stock."subCompanyId" IS NULL
  AND stock."assignedCardId" = card."id";

DROP INDEX IF EXISTS "cardcloud_card_stock_companyId_idx";
CREATE INDEX IF NOT EXISTS "cardcloud_card_stock_subCompanyId_idx" ON "cardcloud_card_stock"("subCompanyId");

ALTER TABLE "cardcloud_card_stock" DROP CONSTRAINT IF EXISTS "cardcloud_card_stock_subCompanyId_fkey";
ALTER TABLE "cardcloud_card_stock"
    ADD CONSTRAINT "cardcloud_card_stock_subCompanyId_fkey"
    FOREIGN KEY ("subCompanyId") REFERENCES "sub_companies"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cardcloud_card_stock" DROP COLUMN IF EXISTS "companyId";
