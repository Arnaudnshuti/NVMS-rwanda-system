import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle2, AlertTriangle, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

type N = {
  id: string;
  icon: typeof Bell;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
  tone: "info" | "success" | "warn" | "ai";
  cta?: { label: string; to: string };
};

const SEED: N[] = [
  { id: "n1", icon: Sparkles, tone: "ai", title: "Smart Match found 3 candidates", desc: "For 'Umuganda Digital Literacy Drive' in Gasabo.", time: "2m ago", unread: true, cta: { label: "Open Smart Match", to: "/coordinator/smart-match" } },
  { id: "n2", icon: CheckCircle2, tone: "success", title: "Activity log approved", desc: "Your 4h log on 25 Apr was approved.", time: "1h ago", unread: true, cta: { label: "View activity log", to: "/volunteer/activity" } },
  { id: "n3", icon: AlertTriangle, tone: "warn", title: "Verification pending", desc: "Some volunteers are awaiting district verification.", time: "Today", unread: false, cta: { label: "Open volunteers", to: "/coordinator/volunteers" } },
  { id: "n4", icon: Info, tone: "info", title: "New program published", desc: "A new community program is now open for applications.", time: "Yesterday", unread: false, cta: { label: "Browse programs", to: "/volunteer/programs" } },
];

function toneClass(tone: N["tone"]) {
  return {
    info: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warn: "bg-warning/15 text-warning-foreground",
    ai: "bg-accent/10 text-accent",
  }[tone];
}

function NotificationsPage() {
  const { user } = useAuth();
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  return <NotificationsCenter role={user.role} />;
}

export function NotificationsCenter({ role }: { role: "volunteer" | "coordinator" | "admin" }) {
  const [items, setItems] = useState<N[]>(SEED);
  const unread = useMemo(() => items.filter((i) => i.unread).length, [items]);
  const markAll = () => setItems((prev) => prev.map((i) => ({ ...i, unread: false })));
  const markOne = (id: string) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, unread: false } : i)));

  return (
    <PortalShell role={role}>
      <PageHeader
        title="Notifications"
        description="In-app notifications are the primary channel. Email and SMS will be added once the backend notification service is connected."
        actions={unread > 0 ? <Button variant="outline" onClick={markAll}>Mark all read</Button> : undefined}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Inbox</CardTitle>
          <span className="text-xs text-muted-foreground">{unread > 0 ? `${unread} unread` : "All caught up"}</span>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((n) => {
            const Icon = n.icon;
            return (
              <div
                key={n.id}
                className={cn("rounded-md border border-border/60 p-3 transition-colors", n.unread ? "bg-primary/[0.03]" : "bg-background", "hover:bg-muted/40")}
                onMouseEnter={() => markOne(n.id)}
              >
                <div className="flex gap-3">
                  <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", toneClass(n.tone))}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-semibold">{n.title}</div>
                          {n.unread && <Badge variant="secondary" className="h-1.5 w-1.5 rounded-full bg-primary p-0" />}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{n.desc}</div>
                      </div>
                      <div className="shrink-0 text-[11px] text-muted-foreground">{n.time}</div>
                    </div>
                    {n.cta && (
                      <div className="mt-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={n.cta.to}>{n.cta.label}</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No notifications.</p>
          )}
        </CardContent>
      </Card>
    </PortalShell>
  );
}

export default NotificationsPage;

