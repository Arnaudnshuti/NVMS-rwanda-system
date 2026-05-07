import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PROGRAMS, VOLUNTEERS } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { programsVisibleToCoordinator } from "@/lib/portal-access";


function DeploymentsPage() {
  const { user } = useAuth();
  const visible = programsVisibleToCoordinator(user, PROGRAMS);
  const active = visible.filter((p) => p.status === "in_progress" || p.status === "open");
  return (
    <PortalShell role="coordinator">
      <PageHeader title="Deployments" description="Assign verified volunteers to active programs." />
      <div className="space-y-4">
        {active.map((p) => {
          const deployed = VOLUNTEERS.filter((v) => v.status === "verified").slice(0, Math.min(4, p.slotsFilled));
          return (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{p.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{p.district} · {p.slotsFilled}/{p.slotsTotal} slots filled</p>
                </div>
                <Button size="sm">+ Assign volunteer</Button>
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
                        <TableCell className="text-right"><Button size="sm" variant="ghost">Manage</Button></TableCell>
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
