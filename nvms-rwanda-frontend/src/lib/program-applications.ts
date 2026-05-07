/** Volunteer program applications (demo: localStorage until API exists). */

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "accepted"
  | "waitlisted"
  | "rejected"
  | "withdrawn";

export interface ProgramApplication {
  id: string;
  volunteerId: string;
  volunteerEmail: string;
  volunteerName: string;
  volunteerDistrict?: string;
  programId: string;
  status: ApplicationStatus;
  submittedAt: string;
  coordinatorNote?: string;
  reviewedAt?: string;
}

const KEY = "nvms.program.applications";

function readAll(): ProgramApplication[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ProgramApplication[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: ProgramApplication[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function applicationsForVolunteer(volunteerId: string): ProgramApplication[] {
  return readAll()
    .filter((a) => a.volunteerId === volunteerId)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

export function applicationsForCoordinatorPrograms(programIds: string[]): ProgramApplication[] {
  const set = new Set(programIds);
  return readAll()
    .filter((a) => set.has(a.programId))
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

/** True if volunteer already has a non-terminal application for program. */
export function hasPendingOrActiveApplication(volunteerId: string, programId: string): boolean {
  return readAll().some(
    (a) =>
      a.volunteerId === volunteerId &&
      a.programId === programId &&
      ["submitted", "under_review", "accepted", "waitlisted"].includes(a.status),
  );
}

export function submitApplication(
  payload: Omit<ProgramApplication, "id" | "submittedAt" | "status">,
): { ok: true; app: ProgramApplication } | { ok: false; reason: string } {
  const exists = readAll().some(
    (a) =>
      a.volunteerId === payload.volunteerId &&
      a.programId === payload.programId &&
      ["submitted", "under_review", "accepted", "waitlisted"].includes(a.status),
  );
  if (exists) {
    return { ok: false, reason: "You already have an active application for this program." };
  }
  const app: ProgramApplication = {
    ...payload,
    id: "app-" + Date.now(),
    submittedAt: new Date().toISOString(),
    status: "submitted",
  };
  writeAll([app, ...readAll()]);
  return { ok: true, app };
}

export function patchApplicationStatus(id: string, patch: Partial<Pick<ProgramApplication, "status" | "coordinatorNote" | "reviewedAt">>): boolean {
  const list = readAll();
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return false;
  list[i] = {
    ...list[i],
    ...patch,
    reviewedAt: patch.reviewedAt ?? (patch.status ? new Date().toISOString() : list[i].reviewedAt),
  };
  writeAll(list);
  return true;
}
