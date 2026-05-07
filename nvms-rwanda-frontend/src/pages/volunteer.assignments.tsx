import { useMemo, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ASSIGNMENTS, PROGRAMS } from "@/lib/mock-data";
import { format } from "date-fns";
import { MapPin, Calendar, FileText, ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { volunteerProfileForAuthUser } from "@/lib/volunteer-profile";
import { appendAssignmentReport, reportsForAssignment, reportsForVolunteer } from "@/lib/assignment-reports";
import { isVolunteerTrustedForPrograms } from "@/lib/portal-access";
import { toast } from "sonner";
import type { AssignmentReportReviewStatus } from "@/lib/assignment-reports";

function reportReviewCls(s: AssignmentReportReviewStatus | undefined) {
  if (s === "approved") return "border-success/30 bg-success/10 text-success";
  if (s === "rejected") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-warning/30 bg-warning/15 text-warning-foreground";
}


function MyAssignments() {
  return (
    <PortalShell role="volunteer">
      <MyAssignmentsInner />
    </PortalShell>
  );
}

function MyAssignmentsInner() {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  if (!user) return null;
  const v = volunteerProfileForAuthUser(user);
  const trusted = isVolunteerTrustedForPrograms(user);
  const mine = ASSIGNMENTS.filter((a) => a.volunteerId === v.id);

  const allReports = useMemo(() => reportsForVolunteer(v.id), [v.id, version]);

  const bump = () => setVersion((n) => n + 1);

  return (
    <>
      <PageHeader
        title="My Assignments"
        description="Each program you are deployed to requires periodic activity reports for your district coordinator and MINALOC oversight."
      />

      {!trusted && (
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <ClipboardList className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <p className="text-muted-foreground">
              After you become a <strong>trusted volunteer</strong> (identity approved in your district), you can submit official field reports here. Complete KYC under Identity &amp; trust first.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {mine.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No assignments yet. Once a coordinator deploys you to a program, it will appear here.
          </p>
        )}
        {mine.map((a) => {
          const program = PROGRAMS.find((p) => p.id === a.programId);
          const reports = reportsForAssignment(a.id);
          return (
            <Card key={a.id} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold">{a.programTitle}</h3>
                      <Badge variant="outline" className={a.status === "active" ? "border-success/30 bg-success/10 text-success" : a.status === "completed" ? "bg-muted text-muted-foreground" : "border-accent/30 bg-accent/10 text-accent"}>
                        {a.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{program?.description}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {a.district}</span>
                      <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {format(new Date(a.startDate), "MMM d")} – {format(new Date(a.endDate), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <div className="min-w-[180px] text-right">
                    <div className="font-display text-2xl font-bold">{a.hoursLogged}h</div>
                    <div className="text-xs text-muted-foreground">logged (official)</div>
                    <ReportDialog
                      assignment={a}
                      volunteerId={v.id}
                      programTitle={a.programTitle}
                      disabled={!trusted}
                      onSubmitted={bump}
                    />
                  </div>
                </div>
                {a.status === "active" && (
                  <div className="mt-4">
                    <Progress value={40} className="h-1.5" />
                  </div>
                )}

                <div className="mt-6 border-t border-border pt-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-primary" />
                    Activity reports for this program
                  </div>
                  {reports.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No reports filed yet for this assignment.</p>
                  ) : (
                    <ul className="space-y-2">
                      {reports.map((r) => {
                        const rev = r.reviewStatus ?? "pending_review";
                        return (
                          <li key={r.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>{format(new Date(r.date), "MMM d, yyyy")}</span>
                              <span className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={reportReviewCls(rev)}>
                                  {rev.replace(/_/g, " ")}
                                </Badge>
                                {typeof r.evidence?.length === "number" && r.evidence.length > 0 && (
                                  <span>{r.evidence.length} file(s)</span>
                                )}
                                <span>{r.hours}h</span>
                              </span>
                            </div>
                            <p className="mt-1 text-foreground">{r.narrative}</p>
                            {rev === "rejected" && r.coordinatorNote ? (
                              <p className="mt-2 text-xs text-destructive">Coordinator: {r.coordinatorNote}</p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {allReports.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">All reports (chronological)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {allReports.slice(0, 8).map((r) => (
              <div key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-border/50 py-2 last:border-0">
                <span className="font-medium">{r.programTitle}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(r.date), "MMM d, yyyy")} · {r.hours}h</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ReportDialog({
  assignment,
  volunteerId,
  programTitle,
  disabled,
  onSubmitted,
}: {
  assignment: (typeof ASSIGNMENTS)[0];
  volunteerId: string;
  programTitle: string;
  disabled: boolean;
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("");
  const [narrative, setNarrative] = useState("");
  const [proof, setProof] = useState<FileList | null>(null);

  const evidenceMeta = (files: FileList | null, label: string) => {
    if (!files?.length) return [];
    return Array.from(files).map((f) => ({ label, fileName: f.name }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const h = Number(hours);
    if (!narrative.trim() || !hours || h <= 0) {
      toast.error("Add what you accomplished and valid hours.");
      return;
    }
    appendAssignmentReport({
      volunteerId,
      assignmentId: assignment.id,
      programId: assignment.programId,
      programTitle,
      date,
      hours: h,
      narrative: narrative.trim(),
      evidence: evidenceMeta(proof, "Field proof"),
    });
    toast.success("Report submitted", { description: "Your district coordinator can review it in the dashboard (demo: stored in this browser)." });
    setNarrative("");
    setHours("");
    setProof(null);
    setOpen(false);
    onSubmitted();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="mt-3 w-full sm:w-auto" disabled={disabled}>
          Submit activity report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Program activity report</DialogTitle>
          <DialogDescription>
            Describe what you did on <strong>{programTitle}</strong>. This supports district monitoring and national accountability.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`d-${assignment.id}`}>Date</Label>
              <Input id={`d-${assignment.id}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor={`h-${assignment.id}`}>Hours this session</Label>
              <Input id={`h-${assignment.id}`} type="number" step="0.5" min="0.5" value={hours} onChange={(e) => setHours(e.target.value)} required />
            </div>
          </div>
          <div>
            <Label htmlFor={`n-${assignment.id}`}>What you did (required)</Label>
            <Textarea id={`n-${assignment.id}`} rows={5} value={narrative} onChange={(e) => setNarrative(e.target.value)} required placeholder="Tasks completed, people reached, materials used, issues flagged…" />
          </div>
          <div>
            <Label htmlFor={`p-${assignment.id}`}>Proof (optional)</Label>
            <Input
              id={`p-${assignment.id}`}
              type="file"
              multiple
              accept="image/*,.pdf"
              className="cursor-pointer"
              onChange={(e) => setProof(e.target.files)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Attach photos or PDFs (attendance sheet, signed forms, field photos). In this demo we store file names only; backend will store encrypted files and hashes.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Submit report</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default MyAssignments;
