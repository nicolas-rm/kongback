-- Drop station fields that are outside the MVP scope.
DROP INDEX IF EXISTS "stations_taxId_idx";

ALTER TABLE "stations"
    DROP COLUMN "legalName",
    DROP COLUMN "taxId",
    DROP COLUMN "sic",
    DROP COLUMN "commissionPercent";
