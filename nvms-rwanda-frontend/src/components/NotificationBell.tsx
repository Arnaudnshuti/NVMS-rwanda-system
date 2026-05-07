import { Bell, CheckCircle2, AlertTriangle, Info, Sparkles } from "lucide-react";
import { useState } from "react";
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

type N = { id: string; icon: typeof Bell; title: string; desc: string; time: string; unread: boolean; tone: "info" | "success" | "warn" | "ai" };

const SEED: N[] = [
  { id: "n1", icon: Sparkles, tone: "ai", title: "Smart Match found 3 candidates", desc: "For 'Umuganda Digital Literacy Drive' in Gasabo.", time: "2m ago", unread: true },
  { id: "n2", icon: CheckCircle2, tone: "success", title: "Activity log approved", desc: "Your 4h log on 25 Apr was approved.", time: "1h ago", unread: true },
  { id: "n3", icon: AlertTriangle, tone: "warn", title: "Verification pending", desc: "142 volunteers awaiting district verification.", time: "Today", unread: false },
  { id: "n4", icon: Info, tone: "info", title: "New program in Bugesera", desc: "Smart Agriculture Support is now open.", time: "Yesterday", unread: false },
];

export function NotificationBell() {
  const { t } = useTranslation();
  const [items, setItems] = useState<N[]>(SEED);
  const unread = items.filter((i) => i.unread).length;

  const markAll = () => setItems((prev) => prev.map((i) => ({ ...i, unread: false })));

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
          {items.map((n) => {
            const Icon = n.icon;
            const toneCls = {
              info: "bg-primary/10 text-primary",
              success: "bg-success/10 text-success",
              warn: "bg-warning/15 text-warning-foreground",
              ai: "bg-accent/10 text-accent",
            }[n.tone];
            return (
              <div key={n.id} className={cn("flex gap-3 p-3 transition-colors hover:bg-muted/50", n.unread && "bg-primary/[0.03]")}>
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
