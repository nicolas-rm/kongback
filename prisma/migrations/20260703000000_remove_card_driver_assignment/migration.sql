ALTER TABLE "cards" DROP CONSTRAINT IF EXISTS "cards_driverId_fkey";

DROP INDEX IF EXISTS "cards_driverId_idx";

ALTER TABLE "cards" DROP COLUMN IF EXISTS "driverId";

ALTER TABLE "cards" ALTER COLUMN "assignmentMode" DROP DEFAULT;

UPDATE "cards"
SET "assignmentMode" = 'unassigned'
WHERE "assignmentMode"::text = 'driver';

ALTER TYPE "CardAssignmentMode" RENAME TO "CardAssignmentMode_old";

CREATE TYPE "CardAssignmentMode" AS ENUM ('unassigned', 'vehicle');

ALTER TABLE "cards"
ALTER COLUMN "assignmentMode" TYPE "CardAssignmentMode"
USING ("assignmentMode"::text::"CardAssignmentMode");

ALTER TABLE "cards" ALTER COLUMN "assignmentMode" SET DEFAULT 'unassigned';

DROP TYPE "CardAssignmentMode_old";
