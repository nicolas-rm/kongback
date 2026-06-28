-- Drop advanced odometer/performance fields that are outside the MVP scope.
ALTER TABLE "vehicles"
    DROP COLUMN "odometerMaxPerLoad",
    DROP COLUMN "odometerVariation",
    DROP COLUMN "avgPerformance";
