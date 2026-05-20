import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader, StatCard } from "@/components/DashboardUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  coordinatorResourcesApi,
  type ApiCoordinatorResourceProgram,
  type ApiCoordinatorResources,
} from "@/lib/nvms-api";
import { CheckCircle2, ClipboardList, FileText, PackageCheck, RefreshCw, Truck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

const statusStyle: Record<ApiCoordinatorResourceProgram["readiness"], string> = {
  ready: "border-success/30 bg-success/10 text-success",
  needs_volunteers: "border-warning/30 bg-warning/15 text-warning-foreground",
  reports_pending: "border-accent/30 bg-accent/10 text-accent",
};

function simpleStatus(program: ApiCoordinatorResourceProgram) {
  if (program.openSlots > 0) return `${program.openSlots} volunteer${program.openSlots === 1 ? "" : "s"} needed`;
  if (program.pendingReports > 0) return `${program.pendingReports} report${program.pendingReports === 1 ? "" : "s"} to review`;
  return "Ready";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-RW", { month: "short", day: "numeric" });
}

function CoordinatorResources() {
  const [data, setData] = useState<ApiCoordinatorResources | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await coordinatorResourcesApi();
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setData(res.data);
  };

  useEffect(() => {
    void load();
  }, []);

  const programs = data?.programs ?? [];
  const programsNeedingHelp = useMemo(
    () => programs.filter((program) => program.openSlots > 0 || program.pendingReports > 0),
    [programs],
  );

  return (
    <PortalShell role="coordinator">
      <PageHeader
        title="Resources"
        description="A simple view of what each active program needs before volunteers go to the field."
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            {loading ? "Loading..." : "Refresh"}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Programs" value={data?.totals.activePrograms ?? 0} icon={<ClipboardList className="h-5 w-5" />} accent="primary" />
        <StatCard label="Ready volunteers" value={data?.totals.trustedVolunteers ?? 0} icon={<Users className="h-5 w-5" />} accent="success" />
        <StatCard label="Volunteers needed" value={data?.totals.openSlots ?? 0} icon={<UserPlus className="h-5 w-5" />} accent="warning" />
        <StatCard label="Reports to review" value={data?.totals.pendingReports ?? 0} icon={<FileText className="h-5 w-5" />} accent="accent" />
      </div>

      {programsNeedingHelp.length > 0 && (
        <Card className="mt-6 border-warning/30 bg-warning/10">
          <CardHeader>
            <CardTitle className="text-base">Needs your attention</CardTitle>
            <CardDescription>Start with these programs first.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {programsNeedingHelp.slice(0, 4).map((program) => (
              <div key={program.id} className="rounded-md border bg-background p-3">
                <div className="font-medium">{program.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{program.district}{program.sector ? ` / ${program.sector}` : ""}</div>
                <div className="mt-2 text-sm font-medium">{simpleStatus(program)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {programs.map((program) => (
            <Card key={program.id}>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{program.title}</CardTitle>
                    <Badge variant="outline" className={statusStyle[program.readiness]}>{simpleStatus(program)}</Badge>
                  </div>
                  <CardDescription className="mt-1">
                    {program.district}{program.sector ? ` / ${program.sector}` : ""} · {formatDate(program.startDate)} to {formatDate(program.endDate)}
                  </CardDescription>
                </div>
                <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                  <strong>{program.assignedCount}</strong> of <strong>{program.slotsTotal}</strong> volunteers assigned
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <PackageCheck className="h-4 w-4 text-primary" />
                    What to prepare
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {program.resourceKit.slice(0, 6).map((item) => (
                      <div key={`${program.id}-${item.item}`} className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3 text-sm">
                        <span>{item.item}</span>
                        <strong className="shrink-0">{item.quantity} {item.unit}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {program.openSlots > 0 ? (
                    <Button asChild size="sm">
                      <Link to="/coordinator/smart-match"><UserPlus className="mr-1.5 h-4 w-4" /> Find volunteers</Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/coordinator/deployments"><CheckCircle2 className="mr-1.5 h-4 w-4" /> View assigned volunteers</Link>
                    </Button>
                  )}
                  {program.pendingReports > 0 && (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/coordinator/reports"><FileText className="mr-1.5 h-4 w-4" /> Review reports</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {!loading && programs.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No active programs found for your district.
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Common tasks for preparing programs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickAction title="Approve volunteers" text="Review new volunteers and trusted profiles." to="/coordinator/volunteers" icon={<Users className="h-4 w-4" />} />
            <QuickAction title="Assign volunteers" text="Accept applicants or add a trusted volunteer." to="/coordinator/deployments" icon={<Truck className="h-4 w-4" />} />
            <QuickAction title="Check reports" text="Approve submitted work reports." to="/coordinator/reports" icon={<FileText className="h-4 w-4" />} />
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

function QuickAction({ title, text, to, icon }: { title: string; text: string; to: string; icon: ReactNode }) {
  return (
    <Button asChild variant="outline" className="h-auto w-full justify-start gap-3 p-3 text-left">
      <Link to={to}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</span>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block whitespace-normal text-xs font-normal text-muted-foreground">{text}</span>
        </span>
      </Link>
    </Button>
  );
}

export default CoordinatorResources;
