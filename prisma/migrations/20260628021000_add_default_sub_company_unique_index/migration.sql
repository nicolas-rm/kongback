-- Enforce a single default sub-company per company.
-- Prisma schema cannot express partial unique indexes.
CREATE UNIQUE INDEX IF NOT EXISTS sub_companies_default_per_company_unique
    ON "sub_companies" ("companyId")
    WHERE "isDefault" = true;
