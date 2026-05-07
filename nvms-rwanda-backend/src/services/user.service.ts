import type { User } from "@prisma/client";
import { prisma } from "./prisma.service.js";

export function serializeUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    district: u.district ?? undefined,
    phone: u.phone ?? undefined,
    avatar: u.avatarUrl ?? undefined,
    verificationStatus: u.verificationStatus ?? undefined,
    profileTrustStatus: u.profileTrustStatus ?? undefined,
    nationalId: u.nationalId ?? undefined,
    emergencyContactName: u.emergencyContactName ?? undefined,
    emergencyContactPhone: u.emergencyContactPhone ?? undefined,
    trustSkillsSummary: u.trustSkillsSummary ?? undefined,
    identityDocuments: undefined as { label: string; fileName: string }[] | undefined,
    contactPreference: (u.contactPreference as "email" | "sms" | "both" | undefined) ?? undefined,
    dateOfBirth: u.dateOfBirth ? u.dateOfBirth.toISOString().slice(0, 10) : undefined,
    profession: u.profession ?? undefined,
    educationLevel: u.educationLevel ?? undefined,
    volunteerAvailability: u.volunteerAvailability ?? undefined,
    skills: u.skills?.length ? u.skills : undefined,
    hoursContributed: u.hoursContributed,
    programsCompleted: u.programsCompleted,
    rating: Number(u.rating ?? 0),
    govStatus: u.govStatus,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
  };
}

export async function serializeUserWithDocs(u: User) {
  const base = serializeUser(u);
  base.identityDocuments = await prisma.identityDocument.findMany({
    where: { userId: u.id },
    select: { label: true, fileName: true },
    orderBy: { createdAt: "asc" },
  });
  return base;
}
