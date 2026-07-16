-- CreateTable
CREATE TABLE "InvitationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL CHECK ("maxUses" > 0),
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "bonusQuota" INTEGER NOT NULL CHECK ("bonusQuota" > 0),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InvitationRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invitationCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bonusQuota" INTEGER NOT NULL,
    "redeemedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvitationRedemption_invitationCodeId_fkey" FOREIGN KEY ("invitationCodeId") REFERENCES "InvitationCode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InvitationRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InvitationCode_code_key" ON "InvitationCode"("code");

-- CreateIndex
CREATE INDEX "InvitationRedemption_userId_redeemedAt_idx" ON "InvitationRedemption"("userId", "redeemedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationRedemption_invitationCodeId_userId_key" ON "InvitationRedemption"("invitationCodeId", "userId");
