import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/DashboardUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2 } from "lucide-react";
import { PROGRAMS, SMART_MATCHES, VOLUNTEERS } from "@/lib/mock-data";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { programsVisibleToCoordinator } from "@/lib/portal-access";


function SmartMatchPage() {
  const { user } = useAuth();
  const visiblePrograms = useMemo(() => programsVisibleToCoordinator(user, PROGRAMS), [user]);
  const [programId, setProgramId] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<typeof SMART_MATCHES | null>(null);

  useEffect(() => {
    if (!visiblePrograms.length) return;
    if (!programId || !visiblePrograms.some((p) => p.id === programId)) {
      setProgramId(visiblePrograms[0].id);
    }
  }, [visiblePrograms, programId]);

  const program = visiblePrograms.find((p) => p.id === programId);

  const runMatch = () => {
    setRunning(true);
    setResults(null);
    setTimeout(() => {
      setRunning(false);
      setResults(SMART_MATCHES);
      toast.success("AI generated 3 high-match candidates");
    }, 1400);
  };

  if (!program) {
    return (
      <PortalShell role="coordinator">
        <PageHeader title="Smart Match" description="AI-powered volunteer matching by skills, district and availability." />
        <p className="text-sm text-muted-foreground">No programs in your assigned districts. Adjust scope or create a program first.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell role="coordinator">
      <PageHeader title="Smart Match" description="AI-powered volunteer matching by skills, district and availability." />

      <Card className="border-accent/30 bg-gradient-to-br from-accent/5 to-transparent">
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select program</label>
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {visiblePrograms.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={runMatch} disabled={running} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {running ? "Analyzing…" : "Run AI match"}
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Program details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Title</div><div className="font-medium">{program.title}</div></div>
            <div><div className="text-xs text-muted-foreground">District</div><div>{program.district}</div></div>
            <div><div className="text-xs text-muted-foreground">Required skills</div>
              <div className="mt-1 flex flex-wrap gap-1">{program.requiredSkills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
            </div>
            <div><div className="text-xs text-muted-foreground">Slots</div><div>{program.slotsFilled} / {program.slotsTotal}</div></div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-accent" /> AI match results</CardTitle></CardHeader>
          <CardContent>
            {!results && !running && (
              <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Click "Run AI match" to generate top candidates.
              </div>
            )}
            {running && (
              <div className="space-y-3">
                <Progress value={60} className="h-1.5" />
                <p className="text-sm text-muted-foreground">Scoring volunteers against required skills, district, availability, and past performance…</p>
              </div>
            )}
            {results && (
              <div className="space-y-3">
                {results.map((r) => {
                  const v = VOLUNTEERS.find((x) => x.id === r.volunteerId)!;
                  return (
                    <div key={r.volunteerId} className="flex items-start gap-4 rounded-lg border border-border/60 p-4">
                      <Avatar className="h-11 w-11"><AvatarFallback className="bg-primary/10 text-primary">{v.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">{v.name}</div>
                          <div className="flex items-center gap-2">
                            <div className="font-display text-lg font-bold text-accent">{r.score}%</div>
                            <Badge className="bg-accent/15 text-accent hover:bg-accent/15">match</Badge>
                          </div>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{v.district} · {v.hoursContributed}h · ⭐ {v.rating.toFixed(1)}</p>
                        <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs italic text-muted-foreground">"{r.reason}"</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={() => toast.success(`${v.name} assigned`)}>Assign</Button>
                          <Button size="sm" variant="outline">View profile</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

export default SmartMatchPage;
