import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { RWANDA_DISTRICTS, DISTRICT_PARTICIPATION } from "@/lib/mock-data";


function DistrictsPage() {
  const map = new Map(DISTRICT_PARTICIPATION.map((d) => [d.district, d.volunteers]));
  return (
    <PortalShell role="admin">
      <PageHeader title="Districts" description="Volunteer coverage across all 30 districts of Rwanda." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {RWANDA_DISTRICTS.map((d) => {
          const count = map.get(d) ?? Math.floor(Math.random() * 60) + 20;
          const intensity = Math.min(100, Math.round((count / 320) * 100));
          return (
            <Card key={d} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <div className="font-medium">{d}</div>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${intensity}%` }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PortalShell>
  );
}

export default DistrictsPage;
