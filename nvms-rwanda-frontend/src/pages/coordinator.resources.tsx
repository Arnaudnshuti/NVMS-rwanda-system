import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck } from "lucide-react";
import { useAuth } from "@/lib/auth";

const DEMO_ROUTES = [
  { sector: "Kinyinya", item: "Hygiene kits (Umuganda support)", qty: "120 kits", status: "Allocated", notes: "Program p1 linkage" },
  { sector: "Remera", item: "First aid backpacks", qty: "24", status: "In transit", notes: "Flood preparedness" },
  { sector: "Gisozi", item: "Training manuals (digital literacy)", qty: "80", status: "Delivered", notes: "Confirm receipt signatures" },
  { sector: "Jali", item: "Seeds — community agriculture drive", qty: "4.5 t", status: "Planned", notes: "Coordinate with agronome sector lead" },
];

function CoordinatorResources() {
  const { user } = useAuth();
  return (
    <PortalShell role="coordinator">
      <PageHeader
        title="Resource distribution"
        description={
          user?.district
            ? `Track sector-level allocations and movements within ${user.district}. Logistics integrations are placeholders until treasury & warehouse APIs connect.`
            : "Set your coordinator district profile to scope resource plans to your jurisdiction."
        }
      />

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start gap-3">
          <Truck className="mt-1 h-5 w-5 text-primary" aria-hidden />
          <div>
            <CardTitle className="text-base">Cross-sector coordination</CardTitle>
            <CardDescription>
              Volunteers report consumption through structured activity logs with proof attachments; coordinators consolidate figures into district packages before national roll-up (Volunteer → Coordinator → Ministry pipeline).
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">District allocation board (demo)</CardTitle>
          <CardDescription>Sample rows illustrate how manifests could appear once inventory services are wired.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sector</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_ROUTES.map((row) => (
                <TableRow key={row.sector + row.item}>
                  <TableCell className="font-medium">{row.sector}</TableCell>
                  <TableCell>{row.item}</TableCell>
                  <TableCell>{row.qty}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden max-w-[240px] text-muted-foreground md:table-cell">{row.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PortalShell>
  );
}

export default CoordinatorResources;
