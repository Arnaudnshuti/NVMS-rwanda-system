import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Users } from "lucide-react";
import type { Program } from "@/lib/mock-data";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const statusStyles: Record<Program["status"], string> = {
  open: "bg-success/15 text-success border-success/30",
  in_progress: "bg-accent/15 text-accent border-accent/30",
  completed: "bg-muted text-muted-foreground border-border",
  draft: "bg-warning/15 text-warning-foreground border-warning/30",
};

const categoryColor: Record<Program["category"], string> = {
  Education: "bg-chart-2/15 text-chart-2",
  Health: "bg-chart-4/15 text-chart-4",
  Environment: "bg-success/15 text-success",
  Agriculture: "bg-chart-5/15 text-chart-5",
  Community: "bg-chart-3/15 text-chart-3",
  Emergency: "bg-destructive/15 text-destructive",
};

export function ProgramCard({ program, footer }: { program: Program; footer?: ReactNode }) {
  const fillPct = Math.round((program.slotsFilled / program.slotsTotal) * 100);
  return (
    <Card className="flex h-full flex-col border-border/60 transition-all hover:shadow-elegant">
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={cn("font-medium", categoryColor[program.category])}>
            {program.category}
          </Badge>
          <Badge variant="outline" className={cn("capitalize", statusStyles[program.status])}>
            {program.status.replace("_", " ")}
          </Badge>
        </div>
        <h3 className="mt-3 font-display text-lg font-semibold leading-tight">{program.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{program.description}</p>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{program.district}{program.sector ? ` · ${program.sector}` : ""}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{format(new Date(program.startDate), "MMM d")} – {format(new Date(program.endDate), "MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{program.slotsFilled} / {program.slotsTotal} volunteers</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${fillPct}%` }} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {program.requiredSkills.slice(0, 3).map((s) => (
            <Badge key={s} variant="secondary" className="text-[10px] font-medium">{s}</Badge>
          ))}
        </div>

        {footer && <div className="mt-5">{footer}</div>}
      </CardContent>
    </Card>
  );
}
