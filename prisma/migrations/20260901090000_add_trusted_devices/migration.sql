-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "platform" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_tokenHash_key" ON "trusted_devices"("tokenHash");

-- CreateIndex
CREATE INDEX "trusted_devices_userId_idx" ON "trusted_devices"("userId");

-- CreateIndex
CREATE INDEX "trusted_devices_userId_revokedAt_idx" ON "trusted_devices"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "trusted_devices_expiresAt_idx" ON "trusted_devices"("expiresAt");

-- CreateIndex
CREATE INDEX "trusted_devices_lastUsedAt_idx" ON "trusted_devices"("lastUsedAt");

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
