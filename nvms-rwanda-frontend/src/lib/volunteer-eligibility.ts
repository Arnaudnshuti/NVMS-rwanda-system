import type { DemoUser, Program, Volunteer } from "./mock-data";
import { isVolunteerTrustedForPrograms } from "@/lib/portal-access";

function splitSkills(summary?: string): string[] {
  if (!summary?.trim()) return [];
  return summary.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
}

function skillRoughMatch(volSkill: string, required: string): boolean {
  const a = volSkill.toLowerCase();
  const b = required.toLowerCase();
  return a.includes(b) || b.includes(a);
}

/** Fields still needed before the volunteer may apply (after account + trusted KYC). */
export function volunteerProfileMissingFields(user: DemoUser, v: Volunteer): string[] {
  const missing: string[] = [];
  if (!v.phone?.trim()) missing.push("Phone number");
  if (!v.skills?.length) missing.push("Skills");
  const avail = v.availability?.trim();
  if (!avail || avail === "Not set") missing.push("Availability");
  if (!user.profession?.trim()) missing.push("Profession");
  if (!user.educationLevel?.trim()) missing.push("Education level");
  return missing;
}

export function isVolunteerProfileCompleteForPrograms(user: DemoUser, v: Volunteer): boolean {
  return volunteerProfileMissingFields(user, v).length === 0;
}

/** Short message for disabled Apply buttons and toasts. */
export function volunteerApplyBlockReason(user: DemoUser, v: Volunteer): string | null {
  if (!isVolunteerTrustedForPrograms(user)) {
    return "Finish Identity & trust (KYC) and wait for coordinator approval.";
  }
  const missing = volunteerProfileMissingFields(user, v);
  if (missing.length) return `Complete your profile: ${missing.join(", ")}.`;
  return null;
}

/** Compose gate used by Browse programs — pass resolved volunteer roster row. */
export function canVolunteerApplyToPrograms(user: DemoUser, v: Volunteer): boolean {
  if (!isVolunteerTrustedForPrograms(user)) return false;
  return isVolunteerProfileCompleteForPrograms(user, v);
}

/** Demo AI-style ranking until a recommendation API exists. */
export function rankedOpenProgramsForVolunteer(v: Volunteer, programs: Program[], limit = 3): Program[] {
  const open = programs.filter((p) => p.status === "open");
  return open
    .map((p) => {
      let score = 0;
      if (p.district === v.district) score += 35;
      const overlap = p.requiredSkills.filter((req) =>
        v.skills.some((vs) => skillRoughMatch(vs, req)),
      ).length;
      score += overlap * 18;
      if (p.requiredSkills.length && overlap === 0) score -= 8;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

export function volunteerSkillsForUi(user: DemoUser, rosterSkills: string[]): string[] {
  const fromTrust = splitSkills(user.trustSkillsSummary);
  if (fromTrust.length > 0) return fromTrust;
  return rosterSkills;
}

/** Simple trust tiers for badges (frontend preview until scoring service exists). */
export function volunteerTrustTierLabel(user: DemoUser, v: Volunteer): { label: string; detail: string } {
  const programs = v.programsCompleted;
  const hours = v.hoursContributed;
  const trusted = isVolunteerTrustedForPrograms(user);
  if (!trusted) {
    return { label: "Standard", detail: "Complete KYC after account approval." };
  }
  if (programs >= 6 && hours >= 200)
    return { label: "Distinguished volunteer", detail: "High participation and tenure." };
  if (programs >= 3 || hours >= 120)
    return { label: "Trusted contributor", detail: "Meets ministry certificate thresholds." };
  return { label: "Trusted volunteer", detail: "Identity verified; growing participation record." };
}
