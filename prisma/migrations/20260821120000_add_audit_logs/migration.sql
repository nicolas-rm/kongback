-- CreateTable
CREATE TABLE "request_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "companyId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "origin" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "hasCookie" BOOLEAN NOT NULL DEFAULT false,
    "query" JSONB,
    "body" JSONB,
    "cookies" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audit_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "actorUserId" TEXT,
    "actorUsername" TEXT,
    "companyId" TEXT,
    "scopeKey" TEXT,
    "scopeId" TEXT,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "statusCode" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_audit_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "actorUserId" TEXT,
    "actorUsername" TEXT,
    "companyId" TEXT,
    "scopeKey" TEXT,
    "scopeId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "result" TEXT NOT NULL,
    "statusCode" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_audit_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "actorUserId" TEXT,
    "actorUsername" TEXT,
    "companyId" TEXT,
    "scopeKey" TEXT,
    "scopeId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "result" TEXT NOT NULL,
    "statusCode" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_audit_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "actorUserId" TEXT,
    "actorUsername" TEXT,
    "companyId" TEXT,
    "scopeKey" TEXT,
    "scopeId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "result" TEXT NOT NULL,
    "statusCode" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cardcloud_audit_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "actorUserId" TEXT,
    "actorUsername" TEXT,
    "companyId" TEXT,
    "scopeKey" TEXT,
    "scopeId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "result" TEXT NOT NULL,
    "statusCode" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "externalPath" TEXT,
    "metadata" JSONB,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cardcloud_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_logs_requestId_idx" ON "request_logs"("requestId");
CREATE INDEX "request_logs_actorUserId_idx" ON "request_logs"("actorUserId");
CREATE INDEX "request_logs_companyId_idx" ON "request_logs"("companyId");
CREATE INDEX "request_logs_method_path_idx" ON "request_logs"("method", "path");
CREATE INDEX "request_logs_statusCode_idx" ON "request_logs"("statusCode");
CREATE INDEX "request_logs_createdAt_idx" ON "request_logs"("createdAt");

-- CreateIndex
CREATE INDEX "security_audit_logs_requestId_idx" ON "security_audit_logs"("requestId");
CREATE INDEX "security_audit_logs_actorUserId_idx" ON "security_audit_logs"("actorUserId");
CREATE INDEX "security_audit_logs_companyId_idx" ON "security_audit_logs"("companyId");
CREATE INDEX "security_audit_logs_action_idx" ON "security_audit_logs"("action");
CREATE INDEX "security_audit_logs_result_idx" ON "security_audit_logs"("result");
CREATE INDEX "security_audit_logs_createdAt_idx" ON "security_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "access_audit_logs_requestId_idx" ON "access_audit_logs"("requestId");
CREATE INDEX "access_audit_logs_actorUserId_idx" ON "access_audit_logs"("actorUserId");
CREATE INDEX "access_audit_logs_companyId_idx" ON "access_audit_logs"("companyId");
CREATE INDEX "access_audit_logs_action_idx" ON "access_audit_logs"("action");
CREATE INDEX "access_audit_logs_resourceType_resourceId_idx" ON "access_audit_logs"("resourceType", "resourceId");
CREATE INDEX "access_audit_logs_result_idx" ON "access_audit_logs"("result");
CREATE INDEX "access_audit_logs_createdAt_idx" ON "access_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "business_audit_logs_requestId_idx" ON "business_audit_logs"("requestId");
CREATE INDEX "business_audit_logs_actorUserId_idx" ON "business_audit_logs"("actorUserId");
CREATE INDEX "business_audit_logs_companyId_idx" ON "business_audit_logs"("companyId");
CREATE INDEX "business_audit_logs_action_idx" ON "business_audit_logs"("action");
CREATE INDEX "business_audit_logs_resourceType_resourceId_idx" ON "business_audit_logs"("resourceType", "resourceId");
CREATE INDEX "business_audit_logs_result_idx" ON "business_audit_logs"("result");
CREATE INDEX "business_audit_logs_createdAt_idx" ON "business_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "card_audit_logs_requestId_idx" ON "card_audit_logs"("requestId");
CREATE INDEX "card_audit_logs_actorUserId_idx" ON "card_audit_logs"("actorUserId");
CREATE INDEX "card_audit_logs_companyId_idx" ON "card_audit_logs"("companyId");
CREATE INDEX "card_audit_logs_action_idx" ON "card_audit_logs"("action");
CREATE INDEX "card_audit_logs_resourceType_resourceId_idx" ON "card_audit_logs"("resourceType", "resourceId");
CREATE INDEX "card_audit_logs_result_idx" ON "card_audit_logs"("result");
CREATE INDEX "card_audit_logs_createdAt_idx" ON "card_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "cardcloud_audit_logs_requestId_idx" ON "cardcloud_audit_logs"("requestId");
CREATE INDEX "cardcloud_audit_logs_actorUserId_idx" ON "cardcloud_audit_logs"("actorUserId");
CREATE INDEX "cardcloud_audit_logs_companyId_idx" ON "cardcloud_audit_logs"("companyId");
CREATE INDEX "cardcloud_audit_logs_action_idx" ON "cardcloud_audit_logs"("action");
CREATE INDEX "cardcloud_audit_logs_resourceType_resourceId_idx" ON "cardcloud_audit_logs"("resourceType", "resourceId");
CREATE INDEX "cardcloud_audit_logs_result_idx" ON "cardcloud_audit_logs"("result");
CREATE INDEX "cardcloud_audit_logs_externalPath_idx" ON "cardcloud_audit_logs"("externalPath");
CREATE INDEX "cardcloud_audit_logs_createdAt_idx" ON "cardcloud_audit_logs"("createdAt");
