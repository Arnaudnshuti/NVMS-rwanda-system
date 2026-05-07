/** Volunteer narrative reports per program assignment (demo: localStorage until API exists). */

import { PROGRAMS } from "./mock-data";

export type AssignmentReportReviewStatus = "pending_review" | "approved" | "rejected";

export interface AssignmentReport {
  id: string;
  volunteerId: string;
  assignmentId: string;
  programId: string;
  programTitle: string;
  date: string;
  hours: number;
  narrative: string;
  /** Mock file metadata until uploads go to object storage. */
  evidence?: { label: string; fileName: string }[];
  createdAt: string;
  reviewStatus?: AssignmentReportReviewStatus;
  coordinatorNote?: string;
  reviewedAt?: string;
}

const KEY = "nvms.assignment.reports";

function migrateRow(r: AssignmentReport): AssignmentReport {
  const status = r.reviewStatus ?? "pending_review";
  return { ...r, reviewStatus: status };
}

function readAll(): AssignmentReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as AssignmentReport[]).map(migrateRow);
  } catch {
    return [];
  }
}

function writeAll(list: AssignmentReport[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function reportsForVolunteer(volunteerId: string): AssignmentReport[] {
  return readAll()
    .filter((r) => r.volunteerId === volunteerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function reportsForAssignment(assignmentId: string): AssignmentReport[] {
  return readAll()
    .filter((r) => r.assignmentId === assignmentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Reports linked to programs in the coordinator's district(s). `null` = national (all). */
export function reportsForCoordinatorDistricts(districts: string[] | null): AssignmentReport[] {
  const all = readAll();
  if (districts === null) return all;
  if (districts.length === 0) return [];
  return all.filter((r) => {
    const p = PROGRAMS.find((x) => x.id === r.programId);
    return Boolean(p && districts.includes(p.district));
  });
}

export function appendAssignmentReport(report: Omit<AssignmentReport, "id" | "createdAt">): AssignmentReport {
  const full: AssignmentReport = {
    ...report,
    id: "rpt-" + Date.now(),
    createdAt: new Date().toISOString(),
    reviewStatus: report.reviewStatus ?? "pending_review",
  };
  writeAll([full, ...readAll()]);
  return full;
}

export function patchAssignmentReportReview(
  reportId: string,
  patch: { reviewStatus: "approved" | "rejected"; coordinatorNote?: string },
): boolean {
  const list = readAll();
  const i = list.findIndex((r) => r.id === reportId);
  if (i < 0) return false;
  list[i] = {
    ...list[i],
    reviewStatus: patch.reviewStatus,
    coordinatorNote: patch.coordinatorNote,
    reviewedAt: new Date().toISOString(),
  };
  writeAll(list);
  return true;
}

/** Reports awaiting coordinator validation in-scope (pending only). */
export function pendingReportsForCoordinatorDistricts(districts: string[] | null): AssignmentReport[] {
  return reportsForCoordinatorDistricts(districts).filter((r) => (r.reviewStatus ?? "pending_review") === "pending_review");
}
