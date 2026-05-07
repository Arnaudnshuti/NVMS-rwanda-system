import type { DemoUser, Volunteer, VolunteerStatus } from "./mock-data";
import { VOLUNTEERS } from "./mock-data";
import { effectiveVolunteerStatus } from "./volunteer-status-overrides";
import { volunteerSkillsForUi } from "@/lib/volunteer-eligibility";

/**
 * Resolves the volunteer record shown in the volunteer portal for the signed-in user.
 * Matches mock roster by email; otherwise synthesizes a profile for newly registered users.
 */
export function volunteerProfileForAuthUser(user: DemoUser): Volunteer {
  const match = VOLUNTEERS.find((v) => v.email.toLowerCase() === user.email.toLowerCase());
  const rosterSkills = match?.skills ?? user.skills ?? [];
  const skills = volunteerSkillsForUi(user, rosterSkills);

  if (match) {
    const st = effectiveVolunteerStatus(match.id, match.status);
    const statusAdjusted: VolunteerStatus = st === match.status ? match.status : st;
    const availability =
      user.volunteerAvailability?.trim() || match.availability;
    return {
      ...match,
      id: user.id,
      skills,
      availability,
      status: statusAdjusted,
      hoursContributed: user.hoursContributed ?? match.hoursContributed,
      programsCompleted: user.programsCompleted ?? match.programsCompleted,
      rating: user.rating ?? match.rating,
    };
  }

  const vs = user.verificationStatus ?? "verified";
  const status: VolunteerStatus =
    vs === "verified" ? "verified" : vs === "rejected" ? "rejected" : "pending";
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    district: user.district ?? "—",
    skills,
    availability: user.volunteerAvailability?.trim() || "Not set",
    status,
    joinedAt: new Date().toISOString().slice(0, 10),
    hoursContributed: user.hoursContributed ?? 0,
    programsCompleted: user.programsCompleted ?? 0,
    rating: user.rating ?? 0,
  };
}
