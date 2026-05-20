import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader, StatCard } from "@/components/DashboardUI";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import { adminAnalyticsApi, type ApiAdminAnalytics } from "@/lib/nvms-api";
import { Clock, FolderKanban, MapPin, Users } from "lucide-react";
import { toast } from "sonner";

function formatNumber(value: number) {
  return value.toLocaleString();
}

function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<ApiAdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const monthly = analytics?.monthlyParticipation ?? [];
  const districts = analytics?.districtParticipation ?? [];
  const categories = analytics?.categoryDistribution ?? [];

  useEffect(() => {
    void adminAnalyticsApi().then((r) => {
      setLoading(false);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setAnalytics(r.data);
    });
  }, []);

  const totals = useMemo(
    () => ({
      volunteers: districts.reduce((sum, row) => sum + row.volunteers, 0),
      programs: districts.reduce((sum, row) => sum + row.programs, 0),
      hours: analytics?.totals.hours ?? 0,
      districtsWithVolunteers: districts.filter((row) => row.volunteers > 0).length,
    }),
    [analytics, districts],
  );

  const topDistricts = useMemo(
    () => [...districts].sort((a, b) => b.volunteers - a.volunteers).slice(0, 10),
    [districts],
  );

  return (
    <PortalShell role="admin">
      <PageHeader
        title="Analytics"
        description="Clear national counts from the backend database. Hours are counted only after coordinator approval."
      />

      <div className="mb-5">
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          Live database data
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered volunteers" value={loading ? "..." : formatNumber(totals.volunteers)} icon={<Users className="h-5 w-5" />} accent="primary" />
        <StatCard label="Programs created" value={loading ? "..." : formatNumber(totals.programs)} icon={<FolderKanban className="h-5 w-5" />} accent="accent" />
        <StatCard label="Approved hours" value={loading ? "..." : formatNumber(totals.hours)} icon={<Clock className="h-5 w-5" />} accent="success" />
        <StatCard label="Districts with volunteers" value={loading ? "..." : `${totals.districtsWithVolunteers} / ${analytics?.totals.districts ?? 30}`} icon={<MapPin className="h-5 w-5" />} accent="warning" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approved hours over time</CardTitle>
            <CardDescription>Only field reports approved by coordinators are counted here.</CardDescription>
          </CardHeader>
          <CardContent>
            {monthly.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="hours" name="Approved hours" stroke="var(--color-accent)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No approved reports yet, so there are no hours to chart." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly volunteer activity</CardTitle>
            <CardDescription>Shows volunteers who have approved reports in each month.</CardDescription>
          </CardHeader>
          <CardContent>
            {monthly.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="volunteers" name="Active volunteers" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No volunteer has an approved report yet." />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>District summary</CardTitle>
            <CardDescription>Volunteer registrations, programs, and approved hours by district.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[1fr_280px]">
            {topDistricts.length ? (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={topDistricts} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="district" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="volunteers" name="Registered volunteers" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No district records were returned by the backend." />
            )}

            <div className="space-y-2">
              {topDistricts.slice(0, 6).map((row) => (
                <div key={row.district} className="rounded-md border border-border/60 p-3 text-sm">
                  <div className="font-medium">{row.district}</div>
                  <div className="mt-1 text-muted-foreground">
                    {formatNumber(row.volunteers)} volunteers · {formatNumber(row.programs)} programs · {formatNumber(row.hours)} hours
                  </div>
                </div>
              ))}
              {categories.length > 0 && (
                <div className="pt-2">
                  <div className="mb-2 text-sm font-medium">Program types</div>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((category) => (
                      <Badge key={category.name} variant="secondary">{category.name}: {category.value}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default AnalyticsPage;
