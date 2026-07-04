DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "users" WHERE "email" IS NULL) THEN
        RAISE EXCEPTION 'No se puede hacer users.email obligatorio mientras existan usuarios sin email';
    END IF;
END $$;

ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
