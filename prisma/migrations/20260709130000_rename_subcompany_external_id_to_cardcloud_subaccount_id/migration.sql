ALTER TABLE "sub_companies" RENAME COLUMN "external_id" TO "cardcloud_subaccount_id";

ALTER INDEX IF EXISTS "sub_companies_external_id_key" RENAME TO "sub_companies_cardcloud_subaccount_id_key";
