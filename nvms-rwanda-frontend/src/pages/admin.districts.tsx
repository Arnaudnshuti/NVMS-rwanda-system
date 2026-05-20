import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { adminAnalyticsApi, listDistrictsApi, type ApiDistrict } from "@/lib/nvms-api";
import { toast } from "sonner";


function DistrictsPage() {
  const [districts, setDistricts] = useState<ApiDistrict[]>([]);
  const [counts, setCounts] = useState<Array<{ district: string; volunteers: number }>>([]);
  const districtNames = districts.map((d) => d.name);
  const map = useMemo(() => new Map(counts.map((d) => [d.district, d.volunteers])), [counts]);

  useEffect(() => {
    void Promise.all([listDistrictsApi(), adminAnalyticsApi()]).then(([d, a]) => {
      if (d.ok) setDistricts(d.data);
      else toast.error(d.error);
      if (a.ok) setCounts(a.data.districtParticipation);
      else toast.error(a.error);
    });
  }, []);

  return (
    <PortalShell role="admin">
      <PageHeader title="Districts" description="Volunteer coverage across all 30 districts of Rwanda." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {districtNames.map((d) => {
          const count = map.get(d) ?? 0;
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
        {districtNames.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No districts found in the backend database.
            </CardContent>
          </Card>
        )}
      </div>
    </PortalShell>
  );
}

export default DistrictsPage;
