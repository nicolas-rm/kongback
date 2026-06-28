-- Rename card fuel relation to clarify it represents the card design fuel type, not a usage restriction.
ALTER TABLE "cards" DROP CONSTRAINT IF EXISTS "cards_fuelId_fkey";
DROP INDEX IF EXISTS "cards_fuelId_idx";

ALTER TABLE "cards" RENAME COLUMN "fuelId" TO "designFuelId";

CREATE INDEX "cards_designFuelId_idx" ON "cards"("designFuelId");
ALTER TABLE "cards" ADD CONSTRAINT "cards_designFuelId_fkey" FOREIGN KEY ("designFuelId") REFERENCES "fuels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove CardAssignmentMode.locked; locked cards become suspended while preserving their assignment mode.
UPDATE "cards" SET "status" = 'suspended' WHERE "assignmentMode" = 'locked';

ALTER TYPE "CardAssignmentMode" RENAME TO "CardAssignmentMode_old";
CREATE TYPE "CardAssignmentMode" AS ENUM ('unassigned', 'driver', 'vehicle');

ALTER TABLE "cards" ALTER COLUMN "assignmentMode" DROP DEFAULT;
ALTER TABLE "cards"
    ALTER COLUMN "assignmentMode" TYPE "CardAssignmentMode"
    USING (
        CASE
            WHEN "assignmentMode"::text = 'locked' AND "vehicleId" IS NOT NULL THEN 'vehicle'
            WHEN "assignmentMode"::text = 'locked' AND "driverId" IS NOT NULL THEN 'driver'
            WHEN "assignmentMode"::text = 'locked' THEN 'unassigned'
            ELSE "assignmentMode"::text
        END
    )::"CardAssignmentMode";
ALTER TABLE "cards" ALTER COLUMN "assignmentMode" SET DEFAULT 'unassigned';

DROP TYPE "CardAssignmentMode_old";
