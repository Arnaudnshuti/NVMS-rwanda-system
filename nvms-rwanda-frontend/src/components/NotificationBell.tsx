import { Bell, CheckCircle2, AlertTriangle, Info, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { listMyNotificationsApi, markAllNotificationsReadApi, markNotificationReadApi, nvmsApiEnabled } from "@/lib/nvms-api";
import { useAuth } from "@/lib/auth";
import type { UserRole } from "@/lib/mock-data";

type N = { id: string; icon: typeof Bell; title: string; desc: string; time: string; unread: boolean; tone: "info" | "success" | "warn" | "ai" };
const NOTIFICATION_REFRESH_EVENT = "nvms:notifications-refresh";

function fallbackNotifications(role?: UserRole): N[] {
  if (role === "admin") {
    return [
      { id: "admin-1", icon: AlertTriangle, tone: "warn", title: "Volunteer approvals pending", desc: "District queues have registrations waiting for review.", time: "Today", unread: true },
      { id: "admin-2", icon: Sparkles, tone: "ai", title: "Weekly report ready", desc: "National participation summary is ready for review.", time: "Yesterday", unread: false },
    ];
  }
  if (role === "coordinator") {
    return [
      { id: "coord-1", icon: CheckCircle2, tone: "success", title: "New program activity", desc: "A volunteer submitted a field report for your district.", time: "Today", unread: true },
      { id: "coord-2", icon: Sparkles, tone: "ai", title: "Smart-match suggestions", desc: "Suggested volunteers are ready for an open program.", time: "Yesterday", unread: false },
    ];
  }
  return [
    { id: "vol-1", icon: CheckCircle2, tone: "success", title: "Activity log approved", desc: "Your latest volunteer report was reviewed.", time: "Today", unread: true },
    { id: "vol-2", icon: Info, tone: "info", title: "New program available", desc: "A program matching your profile is open.", time: "Yesterday", unread: false },
  ];
}

export function NotificationBell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const apiOn = nvmsApiEnabled();
  const [items, setItems] = useState<N[]>(() => (apiOn ? [] : fallbackNotifications(user?.role)));
  const [loading, setLoading] = useState(false);
  const unread = items.filter((i) => i.unread).length;

  useEffect(() => {
    if (!apiOn) {
      setItems(fallbackNotifications(user?.role));
      return;
    }
    let cancelled = false;
    const load = async (silent = true) => {
      if (!silent) setLoading(true);
      const r = await listMyNotificationsApi();
      if (cancelled) return;
      if (!silent) setLoading(false);
      if (!r.ok) {
        setItems([]);
        return;
      }
      setItems(
        r.data.map((n) => ({
          id: n.id,
          icon: n.type === "SUCCESS" ? CheckCircle2 : n.type === "WARNING" ? AlertTriangle : n.type === "ERROR" ? AlertTriangle : Info,
          title: n.title,
          desc: n.message,
          time: new Date(n.createdAt).toLocaleString(),
          unread: !n.readAt,
          tone: n.type === "SUCCESS" ? "success" : n.type === "WARNING" ? "warn" : n.type === "ERROR" ? "warn" : "info",
        })),
      );
    };
    const refresh = () => void load(true);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    void load(false);
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATION_REFRESH_EVENT, refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NOTIFICATION_REFRESH_EVENT, refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [apiOn, user?.id, user?.role]);

  const markAll = () => {
    setItems((prev) => prev.map((i) => ({ ...i, unread: false })));
    if (apiOn) void markAllNotificationsReadApi();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("common.notifications")}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between p-3">
          <span>{t("common.notifications")}</span>
          {unread > 0 && (
            <button onClick={markAll} className="text-xs font-medium text-primary hover:underline">
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-96 overflow-y-auto">
          {loading && <div className="p-4 text-sm text-muted-foreground">Loading notifications...</div>}
          {!loading && items.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              No notifications for your {user?.role ?? "user"} account.
            </div>
          )}
          {items.map((n) => {
            const Icon = n.icon;
            const toneCls = {
              info: "bg-primary/10 text-primary",
              success: "bg-success/10 text-success",
              warn: "bg-warning/15 text-warning-foreground",
              ai: "bg-accent/10 text-accent",
            }[n.tone];
            return (
              <div
                key={n.id}
                className={cn("flex cursor-pointer gap-3 p-3 transition-colors hover:bg-muted/50", n.unread && "bg-primary/[0.03]")}
                onClick={() => {
                  if (!n.unread) return;
                  setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
                  if (apiOn) void markNotificationReadApi(n.id);
                }}
              >
                <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", toneCls)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium leading-snug">{n.title}</div>
                    {n.unread && <Badge variant="secondary" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary p-0" />}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{n.desc}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{n.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
