import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { StatCard, PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Briefcase, CheckCircle2, Clock, ArrowRight, FileText } from "lucide-react";
import { VOLUNTEERS, PROGRAMS, ACTIVITY_LOGS } from "@/lib/mock-data";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { programsVisibleToCoordinator, coordinatorDistrictScope } from "@/lib/portal-access";
import { reportsForCoordinatorDistricts } from "@/lib/assignment-reports";


function CoordinatorDashboard() {
  const { user } = useAuth();
  const scopedPrograms = programsVisibleToCoordinator(user, PROGRAMS);
  const scope = coordinatorDistrictScope(user);

  const volunteersInDistrict = useMemo(() => {
    if (scope === null) return VOLUNTEERS;
    if (!scope.length) return [];
    return VOLUNTEERS.filter((v) => scope.includes(v.district));
  }, [scope]);

  const pending = useMemo(
    () => volunteersInDistrict.filter((v) => v.status === "pending"),
    [volunteersInDistrict],
  );

  const activePrograms = scopedPrograms.filter((p) => p.status === "open" || p.status === "in_progress");

  const pendingLogs = useMemo(() => {
    const inScope = new Set(volunteersInDistrict.map((v) => v.id));
    return ACTIVITY_LOGS.filter((l) => inScope.has(l.volunteerId) && l.status === "pending");
  }, [volunteersInDistrict]);

  const fieldReports = useMemo(() => reportsForCoordinatorDistricts(scope), [scope]);

  return (
    <PortalShell role="coordinator">
      <PageHeader
        title="Coordinator Dashboard"
        description={
          user?.district
            ? `Programs, verifications, and field reports for ${user.district} only — volunteers registered in other districts are not in your queue.`
            : "Manage programs and volunteers in your assigned district once your profile lists a district."
        }
        actions={<Button asChild><Link to="/coordinator/programs">Programs</Link></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active programs" value={activePrograms.length} icon={<Briefcase className="h-5 w-5" />} accent="primary" />
        <StatCard label="Volunteers (your district)" value={volunteersInDistrict.length} icon={<Users className="h-5 w-5" />} accent="accent" />
        <StatCard label="Pending verifications" value={pending.length} icon={<Clock className="h-5 w-5" />} accent="warning" />
        <StatCard label="Pending log approvals" value={pendingLogs.length} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending verifications</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/coordinator/volunteers">View all <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.slice(0, 6).map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md border border-border/60 p-3">
                <div>
                  <div className="font-medium">{v.name}</div>
                  <div className="text-xs text-muted-foreground">{v.district} · joined {format(new Date(v.joinedAt), "MMM d")}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild><Link to="/coordinator/volunteers">Open</Link></Button>
                </div>
              </div>
            ))}
            {pending.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No pending verifications in your district.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Active programs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {activePrograms.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-border/60 p-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.district} · {p.slotsFilled}/{p.slotsTotal} filled</div>
                </div>
                <Badge variant="outline" className="shrink-0">{p.category}</Badge>
              </div>
            ))}
            {activePrograms.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No programs in your district.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Program activity reports
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/coordinator/reports">Review &amp; validate</Link>
            </Button>
            <span className="text-xs text-muted-foreground">Demo: stored in browser</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {fieldReports.slice(0, 8).map((r) => (
            <div key={r.id} className="rounded-md border border-border/60 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2 font-medium">
                <span>{r.programTitle}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {format(new Date(r.date), "MMM d, yyyy")}
                  {" · "}
                  {r.hours}h
                  {typeof r.evidence?.length === "number" && r.evidence.length > 0 && (
                    <>{" · "}{r.evidence.length} file(s)</>
                  )}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">{r.narrative}</p>
              <div className="mt-2">
                <Badge variant="outline" className={((r.reviewStatus ?? "pending_review") === "approved" ? "border-success/30 bg-success/10 text-success" : (r.reviewStatus ?? "pending_review") === "rejected" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-warning/30 bg-warning/15 text-warning-foreground")}>
                  {(r.reviewStatus ?? "pending_review").replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          ))}
          {fieldReports.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No field reports yet for programs in {user?.district ?? "your district"}. Volunteers submit them from My assignments.
            </p>
          )}
        </CardContent>
      </Card>
    </PortalShell>
  );
}

export default CoordinatorDashboard;
