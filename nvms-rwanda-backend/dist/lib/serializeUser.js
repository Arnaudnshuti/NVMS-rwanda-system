import { prisma } from "./prisma.js";
/** Shape consumed by the React app (`DemoUser` without password). */
export function serializeUser(u) {
    const ratingNum = u.rating != null ? Number(u.rating) : 0;
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
        identityDocuments: undefined,
        contactPreference: u.contactPreference ?? undefined,
        dateOfBirth: u.dateOfBirth ? u.dateOfBirth.toISOString().slice(0, 10) : undefined,
        profession: u.profession ?? undefined,
        educationLevel: u.educationLevel ?? undefined,
        volunteerAvailability: u.volunteerAvailability ?? undefined,
        skills: u.skills?.length ? u.skills : undefined,
        hoursContributed: u.hoursContributed,
        programsCompleted: u.programsCompleted,
        rating: ratingNum,
        govStatus: u.govStatus,
    };
}
export async function serializeUserWithDocs(u) {
    const base = serializeUser(u);
    const docs = await prisma.identityDocument.findMany({
        where: { userId: u.id },
        select: { label: true, fileName: true },
        orderBy: { createdAt: "asc" },
    });
    base.identityDocuments = docs;
    return base;
}
