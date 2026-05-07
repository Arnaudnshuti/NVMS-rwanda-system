import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Program } from "@/lib/mock-data";
import { PROGRAMS } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { volunteerProfileForAuthUser } from "@/lib/volunteer-profile";
import { applicationsForVolunteer, patchApplicationStatus } from "@/lib/program-applications";
import { fetchProgramsFromApi, fetchMyApplicationsFromApi, nvmsApiEnabled, patchApplicationApi } from "@/lib/nvms-api";
import { format } from "date-fns";
import { toast } from "sonner";

function VolunteerApplicationsPage() {
  return (
    <PortalShell role="volunteer">
      <VolunteerApplicationsInner />
    </PortalShell>
  );
}

function VolunteerApplicationsInner() {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const [programCatalog, setProgramCatalog] = useState<Program[]>(PROGRAMS);
  const [remoteList, setRemoteList] = useState<ReturnType<typeof applicationsForVolunteer> | null>(null);

  useEffect(() => {
    if (!nvmsApiEnabled()) {
      setRemoteList(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [apps, progs] = await Promise.all([fetchMyApplicationsFromApi(), fetchProgramsFromApi()]);
        if (!cancelled) {
          setRemoteList(apps);
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

  if (!user) return null;
  const v = volunteerProfileForAuthUser(user);

  const list = nvmsApiEnabled() ? remoteList ?? [] : applicationsForVolunteer(v.id);
  const title = (id: string) => programCatalog.find((p) => p.id === id)?.title ?? id;

  const withdraw = (id: string) => {
    void (async () => {
      if (nvmsApiEnabled()) {
        const res = await patchApplicationApi(id, { status: "withdrawn" });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.message("Withdrawn");
        setVersion((n) => n + 1);
        return;
      }
      patchApplicationStatus(id, { status: "withdrawn" });
      toast.message("Withdrawn");
      setVersion((n) => n + 1);
    })();
  };

  return (
    <>
      <PageHeader
        title="My applications"
        description="Track submitted program applications and coordinator decisions."
        actions={
          <Button variant="outline" asChild>
            <Link to="/volunteer/programs">Browse programs</Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {list.map((a) => (
            <div key={a.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  {title(a.programId)}
                  <Badge variant="outline" className="capitalize">
                    {a.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Applied {format(new Date(a.submittedAt), "MMM d, yyyy")}
                </p>
                {a.coordinatorNote && <p className="text-xs text-destructive mt-1">{a.coordinatorNote}</p>}
              </div>
              {(a.status === "submitted" || a.status === "under_review") && (
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => withdraw(a.id)}>
                  Withdraw
                </Button>
              )}
            </div>
          ))}
          {list.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No applications yet. Browse programs and submit one when your profile is eligible.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default VolunteerApplicationsPage;
