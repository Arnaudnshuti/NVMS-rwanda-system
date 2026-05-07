import type { VolunteerStatus } from "./mock-data";

const KEY = "nvms.volunteer.status.overrides";

function readRaw(): Record<string, VolunteerStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, VolunteerStatus>) : {};
  } catch {
    return {};
  }
}

/** Demo-only: persist mock-roster status changes until backend exists. */
export function getVolunteerStatusOverride(volunteerId: string): VolunteerStatus | undefined {
  return readRaw()[volunteerId];
}

export function setVolunteerStatusOverride(volunteerId: string, status: VolunteerStatus) {
  const next = { ...readRaw(), [volunteerId]: status };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function effectiveVolunteerStatus(volunteerId: string, baseline: VolunteerStatus): VolunteerStatus {
  return getVolunteerStatusOverride(volunteerId) ?? baseline;
}
