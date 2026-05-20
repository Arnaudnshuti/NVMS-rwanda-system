import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Program } from "@/lib/mock-data";
import {
  applicationsForCoordinatorPrograms,
  patchApplicationStatus,
  type ApplicationStatus,
} from "@/lib/program-applications";
import {
  nvmsApiEnabled,
  fetchAdminProgramsFromApi,
  fetchMyApplicationsFromApi,
  patchApplicationApi,
} from "@/lib/nvms-api";
import { format } from "date-fns";
import { toast } from "sonner";

const decisionOptions: ApplicationStatus[] = ["submitted", "under_review", "accepted", "waitlisted", "rejected"];

export default function CoordinatorApplicationsPage() {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((n) => n + 1);
  const [programCatalog, setProgramCatalog] = useState<Program[]>([]);
  const [remoteApps, setRemoteApps] = useState<ReturnType<typeof applicationsForCoordinatorPrograms> | null>(null);

  useEffect(() => {
    if (!nvmsApiEnabled()) {
      setRemoteApps(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [apps, progs] = await Promise.all([fetchMyApplicationsFromApi(), fetchAdminProgramsFromApi()]);
        if (!cancelled) {
          setRemoteApps(apps);
          setProgramCatalog(progs);
        }
      } catch {
        if (!cancelled) toast.error("Could not load applications");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  const apps = useMemo(() => {
    if (nvmsApiEnabled()) return (remoteApps ?? []).filter((a) => a.status !== "withdrawn");
    const programIds = programCatalog.map((p) => p.id);
    return applicationsForCoordinatorPrograms(programIds).filter((a) => a.status !== "withdrawn");
  }, [programCatalog, version, remoteApps]);

  const programTitle = (id: string) => programCatalog.find((p) => p.id === id)?.title ?? id;

  const setStatus = (id: string, status: ApplicationStatus) => {
    void (async () => {
      if (nvmsApiEnabled()) {
        const res = await patchApplicationApi(id, { status });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        bump();
        toast.success("Application updated");
        return;
      }
      patchApplicationStatus(id, { status });
      bump();
      toast.success("Application updated");
    })();
  };

  return (
    <PortalShell role="coordinator">
      <PageHeader
        title="Program applications"
        description="Accepting an application automatically creates the volunteer assignment. Use Smart Match when you need help ranking applicants."
      />
      <Card>
        <CardContent className="p-0">
          {apps.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{programTitle(a.programId)}</span>
                  <Badge variant="outline" className="capitalize">
                    {a.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {a.volunteerName} ({a.volunteerEmail})
                  {a.volunteerDistrict ? ` · ${a.volunteerDistrict}` : ""}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Submitted {format(new Date(a.submittedAt), "MMM d, yyyy HH:mm")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Select value={a.status} onValueChange={(v) => setStatus(a.id, v as ApplicationStatus)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {decisionOptions.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          {apps.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No applications for programs in your district yet.
            </p>
          )}
        </CardContent>
      </Card>
    </PortalShell>
  );
}
