import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { StatCard, PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Award, Briefcase, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import type { Program } from "@/lib/mock-data";
import { ASSIGNMENTS, ACTIVITY_LOGS, PROGRAMS } from "@/lib/mock-data";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { volunteerProfileForAuthUser } from "@/lib/volunteer-profile";
import { isVolunteerVerified, resolveProfileTrustStatus } from "@/lib/portal-access";
import { complianceSnapshotForVolunteer } from "@/lib/program-compliance";
import {
  rankedOpenProgramsForVolunteer,
  volunteerTrustTierLabel,
  volunteerProfileMissingFields,
  canVolunteerApplyToPrograms,
} from "@/lib/volunteer-eligibility";
import type { ProgramApplication } from "@/lib/program-applications";
import {
  nvmsApiEnabled,
  fetchProgramsFromApi,
  fetchMyAssignmentsFromApi,
  fetchActivityLogsFromApi,
  fetchMyApplicationsFromApi,
  type ApiAssignment,
  type ApiActivityLog,
} from "@/lib/nvms-api";
import { toast } from "sonner";


function VolunteerDashboard() {
  return (
    <PortalShell role="volunteer">
      <VolunteerDashboardInner />
    </PortalShell>
  );
}

function VolunteerDashboardInner() {
  const { user } = useAuth();
  const [apiBundle, setApiBundle] = useState<{
    programs: Program[];
    assignments: ApiAssignment[];
    logs: ApiActivityLog[];
    applications: ProgramApplication[];
  } | null>(null);

  useEffect(() => {
    if (!nvmsApiEnabled() || !user) {
      setApiBundle(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [programs, assignments, logs, applications] = await Promise.all([
          fetchProgramsFromApi(),
          fetchMyAssignmentsFromApi(),
          fetchActivityLogsFromApi(),
          fetchMyApplicationsFromApi(),
        ]);
        if (!cancelled) setApiBundle({ programs, assignments, logs, applications });
      } catch {
        if (!cancelled) toast.error("Could not load dashboard data from API");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;
  const v = volunteerProfileForAuthUser(user);
  const trust = resolveProfileTrustStatus(user);
  const accountOk = isVolunteerVerified(user);
  const needsKyc = accountOk && trust !== "verified";
  const tier = volunteerTrustTierLabel(user, v);
  const eligible = canVolunteerApplyToPrograms(user, v);
  const missing = volunteerProfileMissingFields(user, v);
  const programCatalog = apiBundle?.programs ?? PROGRAMS;
  const compliance = complianceSnapshotForVolunteer(v.id, apiBundle?.applications);
  const myAssignments = apiBundle?.assignments ?? ASSIGNMENTS.filter((a) => a.volunteerId === v.id);
  const recentLogsRaw = apiBundle?.logs ?? ACTIVITY_LOGS.filter((l) => l.volunteerId === v.id);
  const recentLogs = recentLogsRaw.slice(0, 3);
  const recommended = rankedOpenProgramsForVolunteer(v, programCatalog);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]} 👋`}
        description={
          eligible
            ? `${tier.label} — ${tier.detail}`
            : accountOk && trust === "verified" && missing.length > 0
              ? `Complete ${missing.join(", ")} before applying (browse stays open once your account is approved).`
              : "Here's what's happening with your volunteer journey."
        }
      />

      {needsKyc && (
        <Card className="border-primary/25 bg-gradient-to-r from-primary/8 via-primary/5 to-transparent">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">Trusted volunteer step</div>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {trust === "pending_review"
                  ? "Your identity documents are being reviewed. You will get a badge when approved."
                  : "Sign in after district approval, then submit your ID, photo, and skills so a coordinator can mark you as trusted — required before applying to any program."}
              </p>
            </div>
            <Button asChild>
              <Link to="/volunteer/trust-profile">{trust === "pending_review" ? "View submission status" : "Complete identity & documents"}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!needsKyc && accountOk && trust === "verified" && missing.length > 0 && (
        <Card className="border-amber-500/35 bg-amber-500/5 mb-6">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Profile checklist</div>
              <p className="mt-1 text-sm text-muted-foreground">Applications unlock when these are set: {missing.join(", ")}.</p>
            </div>
            <Button variant="outline" size="sm" asChild><Link to="/volunteer/profile">Update profile</Link></Button>
          </CardContent>
        </Card>
      )}

      {compliance.activeAccepted && (
        <Card className={`mb-6 ${compliance.stage === "third" ? "border-destructive/40 bg-destructive/5" : "border-primary/25 bg-muted/40"}`}>
          <CardContent className="p-4 text-sm">
            <div className="font-semibold text-foreground">Programme compliance reminders</div>
            <p className="mt-1 text-muted-foreground">{compliance.message}</p>
            <Button variant="link" className="mt-2 h-auto p-0 text-primary" asChild>
              <Link to="/volunteer/activity">Log structured reports with proof</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hours contributed" value={v.hoursContributed} icon={<Clock className="h-5 w-5" />} accent="primary" trend={{ value: 12, label: "this month" }} />
        <StatCard label="Programs completed" value={v.programsCompleted} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Active assignments" value={myAssignments.filter((a) => a.status === "active").length} icon={<Briefcase className="h-5 w-5" />} accent="accent" />
        <StatCard label="Rating" value={v.rating > 0 ? v.rating.toFixed(1) : "—"} icon={<Award className="h-5 w-5" />} accent="warning" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My active assignments</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/volunteer/assignments">View all <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {myAssignments.filter((a) => a.status === "active").map((a) => {
              const program = programCatalog.find((p) => p.id === a.programId);
              const daysTotal = Math.max(1, Math.round((new Date(a.endDate).getTime() - new Date(a.startDate).getTime()) / 86400000));
              const daysElapsed = Math.max(0, Math.round((Date.now() - new Date(a.startDate).getTime()) / 86400000));
              const pct = Math.min(100, Math.round((daysElapsed / daysTotal) * 100));
              return (
                <div key={a.id} className="rounded-lg border border-border/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">{a.programTitle}</h4>
                      <p className="text-xs text-muted-foreground">{a.district} · {format(new Date(a.startDate), "MMM d")} – {format(new Date(a.endDate), "MMM d, yyyy")}</p>
                    </div>
                    <Badge className="bg-accent/15 text-accent hover:bg-accent/15">{program?.category ?? "Program"}</Badge>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>{a.hoursLogged}h logged</span>
                      <span>{pct}% complete</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                </div>
              );
            })}
            {myAssignments.filter((a) => a.status === "active").length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No active assignments. Browse programs to apply.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> AI-style matches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Ranked by district alignment + skill overlap until the recommendation API is live.</p>
            {recommended.map((p) => (
              <Link key={p.id} to="/volunteer/programs" className="block rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/40 hover:bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate text-sm font-semibold">{p.title}</h4>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{p.category}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.district} · {p.slotsFilled}/{p.slotsTotal} slots · matches {p.requiredSkills.filter((s) => v.skills.some((vs) => vs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(vs.toLowerCase()))).length}/{p.requiredSkills.length} requested skills</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent activity</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/volunteer/activity">Log activity <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentLogs.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                <div className="flex-1">
                  <p className="text-sm">{l.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{format(new Date(l.date), "MMM d, yyyy")} · {l.hours}h</p>
                </div>
                <Badge variant="outline" className={l.status === "approved" ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/15 text-warning-foreground"}>
                  {l.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default VolunteerDashboard;
