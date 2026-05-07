import type { DemoUser, UserRole } from "./mock-data";

type GovStatus = "active" | "suspended" | "revoked";

/** Maps `/api/auth/login` and `/api/auth/me` payloads into `DemoUser` (password never stored from API). */
export function mapApiUserToDemoUser(raw: Record<string, unknown>): DemoUser {
  const role = raw.role as UserRole;
  const gov = raw.govStatus as GovStatus | undefined;

  return {
    id: String(raw.id),
    email: String(raw.email),
    name: String(raw.name),
    role,
    password: "",
    district: raw.district != null ? String(raw.district) : undefined,
    phone: raw.phone != null ? String(raw.phone) : undefined,
    avatar: raw.avatar != null ? String(raw.avatar) : undefined,
    verificationStatus: raw.verificationStatus as DemoUser["verificationStatus"],
    profileTrustStatus: raw.profileTrustStatus as DemoUser["profileTrustStatus"],
    nationalId: raw.nationalId != null ? String(raw.nationalId) : undefined,
    emergencyContactName: raw.emergencyContactName != null ? String(raw.emergencyContactName) : undefined,
    emergencyContactPhone: raw.emergencyContactPhone != null ? String(raw.emergencyContactPhone) : undefined,
    trustSkillsSummary: raw.trustSkillsSummary != null ? String(raw.trustSkillsSummary) : undefined,
    identityDocuments: Array.isArray(raw.identityDocuments)
      ? (raw.identityDocuments as { label: string; fileName: string }[])
      : undefined,
    contactPreference: raw.contactPreference as DemoUser["contactPreference"],
    dateOfBirth: raw.dateOfBirth != null ? String(raw.dateOfBirth) : undefined,
    profession: raw.profession != null ? String(raw.profession) : undefined,
    educationLevel: raw.educationLevel != null ? String(raw.educationLevel) : undefined,
    volunteerAvailability:
      raw.volunteerAvailability != null ? String(raw.volunteerAvailability) : undefined,
    skills: Array.isArray(raw.skills) ? (raw.skills as string[]) : undefined,
    hoursContributed: typeof raw.hoursContributed === "number" ? raw.hoursContributed : undefined,
    programsCompleted: typeof raw.programsCompleted === "number" ? raw.programsCompleted : undefined,
    rating:
      typeof raw.rating === "number"
        ? raw.rating
        : raw.rating != null && !Number.isNaN(Number(raw.rating))
          ? Number(raw.rating)
          : undefined,
    govStatus: gov,
    isActive: typeof raw.isActive === "boolean" ? raw.isActive : undefined,
    mustChangePassword:
      typeof raw.mustChangePassword === "boolean" ? raw.mustChangePassword : undefined,
  };
}
