-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('volunteer', 'coordinator', 'admin');

-- CreateEnum
CREATE TYPE "VolunteerVerificationStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "ProfileTrustStatus" AS ENUM ('unsubmitted', 'pending_review', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "GovStatus" AS ENUM ('active', 'suspended', 'revoked');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('open', 'in_progress', 'completed', 'draft');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('submitted', 'under_review', 'accepted', 'waitlisted', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('active', 'completed', 'upcoming');

-- CreateEnum
CREATE TYPE "ActivityLogReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILURE', 'AUTH_PASSWORD_CHANGED', 'ADMIN_COORDINATOR_CREATED', 'ADMIN_PASSWORD_RESET', 'COORDINATOR_VOLUNTEER_APPROVED', 'COORDINATOR_VOLUNTEER_REJECTED', 'EMAIL_SENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "district" TEXT,
    "districtId" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "govStatus" "GovStatus" NOT NULL DEFAULT 'active',
    "mfaResetPending" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VolunteerVerificationStatus",
    "profileTrustStatus" "ProfileTrustStatus",
    "nationalId" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "trustSkillsSummary" TEXT,
    "contactPreference" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "profession" TEXT,
    "educationLevel" TEXT,
    "volunteerAvailability" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hoursContributed" INTEGER NOT NULL DEFAULT 0,
    "programsCompleted" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,1) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT,
    "contentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "districtId" TEXT,
    "sector" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "slotsTotal" INTEGER NOT NULL,
    "slotsFilled" INTEGER NOT NULL DEFAULT 0,
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ProgramStatus" NOT NULL,
    "coordinatorDisplayName" TEXT,
    "coordinatorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramApplication" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coordinatorNote" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ProgramApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "programTitle" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AssignmentStatus" NOT NULL,
    "hoursLogged" INTEGER NOT NULL DEFAULT 0,
    "strikes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ActivityLogReviewStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityAttachment" (
    "id" TEXT NOT NULL,
    "activityLogId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "volunteerCategories" JSONB NOT NULL,
    "programTypes" JSONB NOT NULL,
    "organizationName" TEXT,
    "contactEmail" TEXT,
    "supportPhone" TEXT,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actionType" "AuditActionType" NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_district_idx" ON "User"("district");

-- CreateIndex
CREATE INDEX "User_districtId_idx" ON "User"("districtId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");

-- CreateIndex
CREATE UNIQUE INDEX "District_name_key" ON "District"("name");

-- CreateIndex
CREATE INDEX "District_name_idx" ON "District"("name");

-- CreateIndex
CREATE INDEX "District_code_idx" ON "District"("code");

-- CreateIndex
CREATE INDEX "IdentityDocument_userId_idx" ON "IdentityDocument"("userId");

-- CreateIndex
CREATE INDEX "Program_district_idx" ON "Program"("district");

-- CreateIndex
CREATE INDEX "Program_districtId_idx" ON "Program"("districtId");

-- CreateIndex
CREATE INDEX "Program_status_idx" ON "Program"("status");

-- CreateIndex
CREATE INDEX "ProgramApplication_volunteerId_idx" ON "ProgramApplication"("volunteerId");

-- CreateIndex
CREATE INDEX "ProgramApplication_programId_idx" ON "ProgramApplication"("programId");

-- CreateIndex
CREATE INDEX "ProgramApplication_status_idx" ON "ProgramApplication"("status");

-- CreateIndex
CREATE INDEX "Assignment_volunteerId_idx" ON "Assignment"("volunteerId");

-- CreateIndex
CREATE INDEX "ActivityLog_volunteerId_idx" ON "ActivityLog"("volunteerId");

-- CreateIndex
CREATE INDEX "ActivityAttachment_activityLogId_idx" ON "ActivityAttachment"("activityLogId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");

-- CreateIndex
CREATE INDEX "AuditLog_actionType_idx" ON "AuditLog"("actionType");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_idx" ON "AuditLog"("targetUserId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDocument" ADD CONSTRAINT "IdentityDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_coordinatorUserId_fkey" FOREIGN KEY ("coordinatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramApplication" ADD CONSTRAINT "ProgramApplication_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramApplication" ADD CONSTRAINT "ProgramApplication_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttachment" ADD CONSTRAINT "ActivityAttachment_activityLogId_fkey" FOREIGN KEY ("activityLogId") REFERENCES "ActivityLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
