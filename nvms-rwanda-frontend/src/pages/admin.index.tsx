import { useEffect, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader, StatCard } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Briefcase, Clock, MapPin } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { adminAnalyticsApi, adminReportSummaryApi, type ApiAdminAnalytics, type ApiReportSummary } from "@/lib/nvms-api";
import { toast } from "sonner";


const PIE_COLORS = ["var(--color-primary)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)", "var(--color-accent)"];

function AdminDashboard() {
  const [summary, setSummary] = useState<ApiReportSummary | null>(null);
  const [analytics, setAnalytics] = useState<ApiAdminAnalytics | null>(null);
  const monthly = analytics?.monthlyParticipation ?? [];
  const districts = analytics?.districtParticipation ?? [];
  const categories = analytics?.categoryDistribution ?? [];
  const metrics = summary?.metrics;

  useEffect(() => {
    void Promise.all([adminReportSummaryApi(), adminAnalyticsApi()]).then(([s, a]) => {
      if (s.ok) setSummary(s.data);
      else toast.error(s.error);
      if (a.ok) setAnalytics(a.data);
      else toast.error(a.error);
    });
  }, []);

  return (
    <PortalShell role="admin">
      <PageHeader title="National Overview" description="Real-time insights on volunteer activity across Rwanda." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total volunteers" value={(metrics?.volunteers ?? 0).toLocaleString()} icon={<Users className="h-5 w-5" />} accent="primary" />
        <StatCard label="Active programs" value={metrics?.activePrograms ?? 0} icon={<Briefcase className="h-5 w-5" />} accent="accent" />
        <StatCard label="Hours contributed" value={(analytics?.totals.hours ?? 0).toLocaleString()} icon={<Clock className="h-5 w-5" />} accent="success" />
        <StatCard label="Districts covered" value={`${summary?.byDistrict.length ?? 0} / 30`} icon={<MapPin className="h-5 w-5" />} accent="warning" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Volunteer participation trend</CardTitle></CardHeader>
          <CardContent>
            {monthly.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="gradVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradHrs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="volunteers" stroke="var(--color-primary)" fill="url(#gradVol)" strokeWidth={2} />
                  <Area type="monotone" dataKey="hours" stroke="var(--color-accent)" fill="url(#gradHrs)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No monthly activity has been recorded yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Program categories</CardTitle></CardHeader>
          <CardContent>
            {categories.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={categories} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {categories.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No program categories found in the database." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Top districts by volunteer count</CardTitle></CardHeader>
        <CardContent>
          {districts.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={districts}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis dataKey="district" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="volunteers" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No district data found in the database." />
          )}
        </CardContent>
      </Card>
    </PortalShell>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default AdminDashboard;
