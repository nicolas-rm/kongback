ALTER TABLE "cardcloud_card_stock" ALTER COLUMN "cardcloud_status" DROP DEFAULT;
ALTER TABLE "cardcloud_card_stock" ALTER COLUMN "cardcloud_status" TYPE TEXT USING "cardcloud_status"::text;
ALTER TABLE "cardcloud_card_stock" ALTER COLUMN "cardcloud_status" DROP NOT NULL;
ALTER TABLE "cardcloud_card_stock" DROP COLUMN IF EXISTS "syncedAt";
