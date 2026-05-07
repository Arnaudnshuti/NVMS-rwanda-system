import { useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { coordinatorDistrictScope } from "@/lib/portal-access";
import { reportsForCoordinatorDistricts, pendingReportsForCoordinatorDistricts, patchAssignmentReportReview, type AssignmentReport } from "@/lib/assignment-reports";
import { VOLUNTEERS } from "@/lib/mock-data";
import { format } from "date-fns";
import { toast } from "sonner";

function CoordinatorReportsPage() {
  const { user } = useAuth();
  const scope = coordinatorDistrictScope(user);

  const [version, setVersion] = useState(0);
  const bump = () => setVersion((n) => n + 1);

  const pending = useMemo(() => pendingReportsForCoordinatorDistricts(scope), [scope, version]);
  const allScoped = useMemo(() => reportsForCoordinatorDistricts(scope), [scope, version]);

  const volunteerLabel = (id: string) => VOLUNTEERS.find((v) => v.id === id)?.name ?? id;

  return (
    <PortalShell role="coordinator">
      <PageHeader
        title="Field report review"
        description={
          user?.district
            ? `Validate official activity reports for programs in ${user.district}. Approve or return with feedback for corrections.`
            : "Approve or reject volunteer field reports within your jurisdiction."
        }
      />

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Awaiting validation</CardTitle>
          <CardDescription>{pending.length} report(s) need a decision.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.map((r) => (
            <ReportRow key={r.id} r={r} volunteerName={volunteerLabel(r.volunteerId)} onDecision={bump} />
          ))}
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending reports. Volunteers submit under My assignments.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent history</CardTitle>
          <CardDescription>Latest reports in your district (approved, rejected, and pending).</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {allScoped.slice(0, 25).map((r) => {
            const st = r.reviewStatus ?? "pending_review";
            return (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{r.programTitle}</div>
                  <div className="text-xs text-muted-foreground">
                    {volunteerLabel(r.volunteerId)} · {format(new Date(r.date), "MMM d, yyyy")} · {r.hours}h
                    {typeof r.evidence?.length === "number" && r.evidence.length > 0 ? ` · ${r.evidence.length} file(s)` : ""}
                  </div>
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{r.narrative}</p>
                  {st === "rejected" && r.coordinatorNote && (
                    <p className="mt-1 text-xs text-destructive">Coordinator: {r.coordinatorNote}</p>
                  )}
                </div>
                <Badge variant="outline" className={statusCls(st)}>
                  {st.replace(/_/g, " ")}
                </Badge>
              </div>
            );
          })}
          {allScoped.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No reports in district yet.</p>}
        </CardContent>
      </Card>
    </PortalShell>
  );
}

function statusCls(st: AssignmentReport["reviewStatus"]) {
  if (st === "approved") return "border-success/30 bg-success/10 text-success";
  if (st === "rejected") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-warning/30 bg-warning/15 text-warning-foreground";
}

function ReportRow({ r, volunteerName, onDecision }: { r: AssignmentReport; volunteerName: string; onDecision: () => void }) {
  const [open, setOpen] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");

  const finalize = () => {
    if (open === "reject" && !note.trim()) {
      toast.error("Add a short reason so the volunteer can correct the report.");
      return;
    }
    const ok =
      open === "approve"
        ? patchAssignmentReportReview(r.id, { reviewStatus: "approved" })
        : patchAssignmentReportReview(r.id, { reviewStatus: "rejected", coordinatorNote: note.trim() });
    if (!ok) {
      toast.error("Could not update report.");
      return;
    }
    toast.success(open === "approve" ? "Report approved" : "Report returned for corrections");
    setOpen(null);
    setNote("");
    onDecision();
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <div className="font-semibold">{r.programTitle}</div>
          <div className="text-xs text-muted-foreground">
            {volunteerName} · {format(new Date(r.date), "MMM d, yyyy")} · {r.hours}h
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setOpen("approve")}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => setOpen("reject")}>Reject</Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{r.narrative}</p>
      {r.evidence?.length ? (
        <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
          {r.evidence.map((e, i) => (
            <li key={i}>{e.label}: {e.fileName}</li>
          ))}
        </ul>
      ) : null}

      <Dialog open={Boolean(open)} onOpenChange={() => setOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{open === "approve" ? "Approve report" : "Reject report"}</DialogTitle>
            <DialogDescription>
              {open === "approve"
                ? "Marks this report valid for aggregation to district and national dashboards (backend)."
                : "Volunteer sees your note and should resubmit a corrected report."}
            </DialogDescription>
          </DialogHeader>
          {open === "reject" && (
            <div className="space-y-2">
              <Label htmlFor="rn">Reason (required)</Label>
              <Textarea id="rn" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. missing attendance proof…" />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
            <Button onClick={finalize}>{open === "approve" ? "Confirm approve" : "Confirm reject"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CoordinatorReportsPage;
