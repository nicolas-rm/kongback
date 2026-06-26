-- CreateEnum
CREATE TYPE "Status" AS ENUM ('active', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "CardAssignmentMode" AS ENUM ('unassigned', 'driver', 'vehicle', 'locked');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "status" TYPE "Status" USING "status"::text::"Status";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "organizations" ALTER COLUMN "status" TYPE "Status" USING "status"::text::"Status";
ALTER TABLE "organizations" ALTER COLUMN "status" SET DEFAULT 'active';

-- DropEnum
DROP TYPE "UserStatus";

-- DropEnum
DROP TYPE "OrganizationStatus";

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "status" "Status" NOT NULL DEFAULT 'active',
    "phone" TEXT,
    "addressId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_companies" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'active',
    "phone" TEXT,
    "addressId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "subCompanyId" TEXT NOT NULL,
    "userId" TEXT,
    "addressId" TEXT,
    "name" TEXT NOT NULL,
    "externalReference" TEXT,
    "status" "Status" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuels" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "subCompanyId" TEXT NOT NULL,
    "fuelId" TEXT NOT NULL,
    "driverId" TEXT,
    "plates" TEXT NOT NULL,
    "economicNumber" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "odometerControl" BOOLEAN NOT NULL DEFAULT false,
    "odometerInitial" INTEGER,
    "odometerMaxPerLoad" INTEGER,
    "odometerVariation" INTEGER,
    "avgPerformance" DECIMAL(10,2),
    "status" "Status" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "subCompanyId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "fuelId" TEXT,
    "card_external_id" TEXT,
    "assignmentMode" "CardAssignmentMode" NOT NULL DEFAULT 'unassigned',
    "status" "Status" NOT NULL DEFAULT 'active',
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "subCompanyId" TEXT NOT NULL,
    "stationNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "sic" TEXT,
    "addressId" TEXT,
    "lat" DECIMAL(10,7),
    "lon" DECIMAL(10,7),
    "commissionPercent" DECIMAL(5,2),
    "status" "Status" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_fuels" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "fuelId" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'active',
    "price" DECIMAL(12,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "station_fuels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cardcloud_card_stock" (
    "id" TEXT NOT NULL,
    "card_external_id" TEXT NOT NULL,
    "assignedCardId" TEXT,
    "maskedPan" TEXT,
    "brand" TEXT,
    "clientId" TEXT,
    "clabe" TEXT,
    "balance" DECIMAL(14,2),
    "cardcloud_status" "Status" NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cardcloud_card_stock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_key_key" ON "companies"("key");

-- CreateIndex
CREATE UNIQUE INDEX "companies_external_id_key" ON "companies"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_addressId_key" ON "companies"("addressId");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sub_companies_external_id_key" ON "sub_companies"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "sub_companies_addressId_key" ON "sub_companies"("addressId");

-- CreateIndex
CREATE INDEX "sub_companies_companyId_idx" ON "sub_companies"("companyId");

-- CreateIndex
CREATE INDEX "sub_companies_status_idx" ON "sub_companies"("status");

-- CreateIndex
CREATE INDEX "sub_companies_name_idx" ON "sub_companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sub_companies_companyId_key_key" ON "sub_companies"("companyId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_userId_key" ON "drivers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_addressId_key" ON "drivers"("addressId");

-- CreateIndex
CREATE INDEX "drivers_subCompanyId_idx" ON "drivers"("subCompanyId");

-- CreateIndex
CREATE INDEX "drivers_status_idx" ON "drivers"("status");

-- CreateIndex
CREATE INDEX "drivers_name_idx" ON "drivers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_subCompanyId_externalReference_key" ON "drivers"("subCompanyId", "externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "fuels_code_key" ON "fuels"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fuels_name_key" ON "fuels"("name");

-- CreateIndex
CREATE INDEX "fuels_status_idx" ON "fuels"("status");

-- CreateIndex
CREATE INDEX "vehicles_subCompanyId_idx" ON "vehicles"("subCompanyId");

-- CreateIndex
CREATE INDEX "vehicles_fuelId_idx" ON "vehicles"("fuelId");

-- CreateIndex
CREATE INDEX "vehicles_driverId_idx" ON "vehicles"("driverId");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_subCompanyId_plates_key" ON "vehicles"("subCompanyId", "plates");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_subCompanyId_economicNumber_key" ON "vehicles"("subCompanyId", "economicNumber");

-- CreateIndex
CREATE UNIQUE INDEX "cards_vehicleId_key" ON "cards"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "cards_card_external_id_key" ON "cards"("card_external_id");

-- CreateIndex
CREATE INDEX "cards_subCompanyId_idx" ON "cards"("subCompanyId");

-- CreateIndex
CREATE INDEX "cards_driverId_idx" ON "cards"("driverId");

-- CreateIndex
CREATE INDEX "cards_fuelId_idx" ON "cards"("fuelId");

-- CreateIndex
CREATE INDEX "cards_assignmentMode_idx" ON "cards"("assignmentMode");

-- CreateIndex
CREATE INDEX "cards_status_idx" ON "cards"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stations_addressId_key" ON "stations"("addressId");

-- CreateIndex
CREATE INDEX "stations_subCompanyId_idx" ON "stations"("subCompanyId");

-- CreateIndex
CREATE INDEX "stations_taxId_idx" ON "stations"("taxId");

-- CreateIndex
CREATE INDEX "stations_name_idx" ON "stations"("name");

-- CreateIndex
CREATE INDEX "stations_status_idx" ON "stations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stations_subCompanyId_stationNumber_key" ON "stations"("subCompanyId", "stationNumber");

-- CreateIndex
CREATE INDEX "station_fuels_stationId_idx" ON "station_fuels"("stationId");

-- CreateIndex
CREATE INDEX "station_fuels_fuelId_idx" ON "station_fuels"("fuelId");

-- CreateIndex
CREATE INDEX "station_fuels_status_idx" ON "station_fuels"("status");

-- CreateIndex
CREATE UNIQUE INDEX "station_fuels_stationId_fuelId_key" ON "station_fuels"("stationId", "fuelId");

-- CreateIndex
CREATE UNIQUE INDEX "cardcloud_card_stock_card_external_id_key" ON "cardcloud_card_stock"("card_external_id");

-- CreateIndex
CREATE UNIQUE INDEX "cardcloud_card_stock_assignedCardId_key" ON "cardcloud_card_stock"("assignedCardId");

-- CreateIndex
CREATE INDEX "cardcloud_card_stock_cardcloud_status_assignedCardId_idx" ON "cardcloud_card_stock"("cardcloud_status", "assignedCardId");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_companies" ADD CONSTRAINT "sub_companies_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_companies" ADD CONSTRAINT "sub_companies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_subCompanyId_fkey" FOREIGN KEY ("subCompanyId") REFERENCES "sub_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_fuelId_fkey" FOREIGN KEY ("fuelId") REFERENCES "fuels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_subCompanyId_fkey" FOREIGN KEY ("subCompanyId") REFERENCES "sub_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_fuelId_fkey" FOREIGN KEY ("fuelId") REFERENCES "fuels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_subCompanyId_fkey" FOREIGN KEY ("subCompanyId") REFERENCES "sub_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_subCompanyId_fkey" FOREIGN KEY ("subCompanyId") REFERENCES "sub_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_fuels" ADD CONSTRAINT "station_fuels_fuelId_fkey" FOREIGN KEY ("fuelId") REFERENCES "fuels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_fuels" ADD CONSTRAINT "station_fuels_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardcloud_card_stock" ADD CONSTRAINT "cardcloud_card_stock_assignedCardId_fkey" FOREIGN KEY ("assignedCardId") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
