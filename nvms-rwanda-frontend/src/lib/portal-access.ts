import type { DemoUser, Program, ProfileTrustStatus, UserRole } from "./mock-data";

/** MINALOC admins can open volunteer/coordinator portals for national oversight (UI-level in this demo). */
export function canAccessPortal(user: DemoUser, portalRole: UserRole): boolean {
  if (user.role === "admin") return true;
  return user.role === portalRole;
}

export function isVolunteerVerified(user: DemoUser): boolean {
  if (user.role !== "volunteer") return true;
  return (user.verificationStatus ?? "verified") === "verified";
}

/**
 * Trusted identity / KYC state. Registry users start `unsubmitted` after account approval;
 * legacy demo accounts (non `new-*` id) without an explicit field are treated as verified.
 */
export function resolveProfileTrustStatus(user: DemoUser): ProfileTrustStatus {
  if (user.role !== "volunteer") return "verified";
  if (user.profileTrustStatus) return user.profileTrustStatus;
  if ((user.verificationStatus ?? "pending") !== "verified") return "unsubmitted";
  if (!String(user.id).startsWith("new-")) return "verified";
  return "unsubmitted";
}

/** Eligible to apply to programs and be deployed (account + trusted profile). */
export function isVolunteerTrustedForPrograms(user: DemoUser): boolean {
  if (!isVolunteerVerified(user)) return false;
  return resolveProfileTrustStatus(user) === "verified";
}

/**
 * Districts a coordinator may act in (programs, deployments, volunteer verification).
 * Coordinators are assigned to one district only. `null` = all districts (MINALOC admin).
 */
export function coordinatorDistrictScope(user: DemoUser | null): string[] | null {
  if (!user) return null;
  if (user.role === "admin") return null;
  if (user.role !== "coordinator") return null;
  if (user.district) return [user.district];
  return [];
}

export function isVolunteerInCoordinatorDistrictScope(actor: DemoUser | null, volunteerDistrict: string): boolean {
  const scope = coordinatorDistrictScope(actor);
  if (scope === null) return true;
  if (scope.length === 0) return false;
  return scope.includes(volunteerDistrict);
}

/** Coordinator may verify/reject only volunteers registered in their assigned districts (admins: all). */
export function canCoordinatorVerifyVolunteer(actor: DemoUser | null, volunteerDistrict: string): boolean {
  if (!actor) return false;
  if (actor.role === "admin") return true;
  if (actor.role !== "coordinator") return false;
  return isVolunteerInCoordinatorDistrictScope(actor, volunteerDistrict);
}

/** Coordinators see only programs in their single assigned district; empty district = none. */
export function programsVisibleToCoordinator(user: DemoUser | null, programs: Program[]): Program[] {
  if (!user) return programs;
  if (user.role === "admin") return programs;
  if (user.role !== "coordinator") return programs;
  const scope = coordinatorDistrictScope(user);
  if (scope === null) return programs;
  if (scope.length === 0) return [];
  return programs.filter((p) => scope.includes(p.district));
}
