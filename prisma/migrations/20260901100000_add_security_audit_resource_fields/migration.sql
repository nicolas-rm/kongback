-- AlterTable
ALTER TABLE "security_audit_logs"
ADD COLUMN "resourceType" TEXT,
ADD COLUMN "resourceId" TEXT;

-- CreateIndex
CREATE INDEX "security_audit_logs_resourceType_resourceId_idx" ON "security_audit_logs"("resourceType", "resourceId");
