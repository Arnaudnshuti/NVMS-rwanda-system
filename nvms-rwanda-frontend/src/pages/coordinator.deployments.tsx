import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PROGRAMS, VOLUNTEERS } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { programsVisibleToCoordinator } from "@/lib/portal-access";
import { useEffect, useMemo, useState } from "react";
import {
  coordinatorAssignVolunteerApi,
  coordinatorListDeploymentsApi,
  coordinatorListVolunteersApi,
  nvmsApiEnabled,
  type ApiDeployment,
  type ApiCoordinatorVolunteerRow,
} from "@/lib/nvms-api";
import { toast } from "sonner";


function DeploymentsPage() {
  const { user } = useAuth();
  const apiOn = nvmsApiEnabled();
  const visible = programsVisibleToCoordinator(user, PROGRAMS);
  const active = visible.filter((p) => p.status === "in_progress" || p.status === "open");
  const [deployments, setDeployments] = useState<ApiDeployment[]>([]);
  const [volunteers, setVolunteers] = useState<ApiCoordinatorVolunteerRow[]>([]);
  const [busyProgramId, setBusyProgramId] = useState<string | null>(null);

  useEffect(() => {
    if (!apiOn) return;
    void (async () => {
      const [d, v] = await Promise.all([coordinatorListDeploymentsApi(), coordinatorListVolunteersApi({ verificationStatus: "verified" })]);
      if (d.ok) setDeployments(d.data);
      if (v.ok) setVolunteers(v.data.filter((x) => x.profileTrustStatus === "verified"));
    })();
  }, [apiOn]);

  const byProgram = useMemo(() => {
    const m = new Map<string, ApiDeployment[]>();
    for (const d of deployments) {
      const arr = m.get(d.programId) ?? [];
      arr.push(d);
      m.set(d.programId, arr);
    }
    return m;
  }, [deployments]);
  return (
    <PortalShell role="coordinator">
      <PageHeader title="Deployments" description="Assign verified volunteers to active programs." />
      <div className="space-y-4">
        {active.map((p) => {
          const deployed = apiOn
            ? (byProgram.get(p.id) ?? []).map((d) => ({
                id: d.volunteerId,
                name: d.volunteerName,
                district: d.volunteerDistrict ?? "",
                skills: [] as string[],
                status: "verified" as const,
              }))
            : VOLUNTEERS.filter((v) => v.status === "verified").slice(0, Math.min(4, p.slotsFilled));
          return (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{p.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{p.district} · {p.slotsFilled}/{p.slotsTotal} slots filled</p>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!apiOn) return toast.message("Assignment saved in API mode only.");
                    const candidate = volunteers.find((v) => v.district === p.district);
                    if (!candidate) {
                      toast.error("No verified trusted volunteer available for this district.");
                      return;
                    }
                    setBusyProgramId(p.id);
                    const r = await coordinatorAssignVolunteerApi({ programId: p.id, volunteerId: candidate.id });
                    setBusyProgramId(null);
                    if (!r.ok) return toast.error(r.error);
                    toast.success("Volunteer assigned.");
                    const d = await coordinatorListDeploymentsApi();
                    if (d.ok) setDeployments(d.data);
                  }}
                  disabled={busyProgramId === p.id}
                >
                  {busyProgramId === p.id ? "Assigning..." : "+ Assign volunteer"}
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Volunteer</TableHead>
                      <TableHead>District</TableHead>
                      <TableHead>Skills</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deployed.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{v.district}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {v.skills.slice(0, 2).map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="border-success/30 bg-success/10 text-success">Deployed</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" disabled title="Deployment management actions are tracked automatically by daily reports and strikes.">
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PortalShell>
  );
}

export default DeploymentsPage;
