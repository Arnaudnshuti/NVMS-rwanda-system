/**
 * Demo scaffolding for attendance / reporting compliance after acceptance.
 * Production: cron + notification service emits 1st–3rd reminders then auto-removes from program roster.
 */

import { applicationsForVolunteer, type ProgramApplication } from "@/lib/program-applications";

export type ComplianceReminderStage = "none" | "first" | "second" | "third" | "removed";

/** Placeholder heuristic: accepted applications older than synthetic windows “need attention”. */
export function complianceSnapshotForVolunteer(
  volunteerId: string,
  preloaded?: ProgramApplication[],
): {
  activeAccepted: boolean;
  message: string;
  stage: ComplianceReminderStage;
} {
  const apps = (preloaded ?? applicationsForVolunteer(volunteerId)).filter((a) => a.status === "accepted");
  if (apps.length === 0) {
    return {
      activeAccepted: false,
      stage: "none",
      message: "",
    };
  }

  const oldest = apps.reduce((acc, cur) =>
    new Date(cur.submittedAt).getTime() < new Date(acc.submittedAt).getTime() ? cur : acc,
  );

  const days = Math.floor((Date.now() - new Date(oldest.submittedAt).getTime()) / 86400000);
  let stage: ComplianceReminderStage = "none";
  if (days >= 21) stage = "third";
  else if (days >= 14) stage = "second";
  else if (days >= 7) stage = "first";

  const message =
    stage === "none"
      ? "Attendance and structured field reports keep your enrolment compliant. Coordinators escalate non-compliance automatically when the scheduler is enabled."
      : stage === "first"
        ? "Reminder 1 (demo timeline): Submit field reports after each session. Backend will send SMS/email reminders."
        : stage === "second"
          ? "Reminder 2 (demo): Missing attendance/report flags may escalate to your district coordinator."
          : "Reminder 3 (demo): Repeated non-compliance triggers automatic programme removal pending production configuration.";

  return { activeAccepted: true, stage, message };
}
