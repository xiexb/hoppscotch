-- DropIndex
DROP INDEX "TeamCollection_title_trgm_idx";

-- DropIndex
DROP INDEX "TeamRequest_title_trgm_idx";

-- DropIndex
DROP INDEX "idx_mock_examples_team_requests_gin";

-- DropIndex
DROP INDEX "idx_mock_examples_user_requests_gin";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userUid" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresOn" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userUid_fkey" FOREIGN KEY ("userUid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;
